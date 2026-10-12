/**
 * Sign-in orchestration.
 *
 * Firebase Authentication owns the Google credential; this module owns
 * everything that has to happen *around* it - the Firestore profile the
 * Google account maps to, whether an administrator has approved it, the
 * login-session audit trail, the aggregate counters and the audit log.
 *
 * Who gets in is decided by the profile's `status`, which the Firestore rules
 * consult on every read and write:
 *
 *   ACTIVE    approved - by an administrator, or a permanent admin e-mail
 *   PENDING   signed in with Google, still waiting for an administrator
 *   DISABLED  access revoked
 */
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  changePassword,
  currentUser,
  googleRedirectResult,
  loginWithGooglePopup,
  loginWithGoogleRedirect,
  logout as fbLogout,
} from '../firebase/auth';
import {
  COLLECTIONS,
  accessDoc,
  db,
  loginSessionsCol,
  userDoc,
} from '../firebase/firestore';
import { isAdminEmail } from '../firebase/firebaseConfig';
import { AUDIT_ACTIONS, ROLES, USER_STATUS } from '../utils/constants';
import { getDeviceInfo } from '../utils/deviceInfo';
import { logError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { queueLoginRecorded, queueUserRegistered } from './counterService';

const GOOGLE_PROVIDER_ID = 'google.com';

/** The popup could not be shown at all; a full-page redirect still works. */
const POPUP_UNAVAILABLE = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
];

const requireDb = () => {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  return db;
};

/**
 * The approval an administrator recorded for this e-mail before the account
 * had ever signed in (`accessList/{email}`), or null.
 */
const getApproval = async (email) => {
  try {
    const snapshot = await getDoc(accessDoc(email));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    logError('getApproval', error);
    // Fail closed: without proof of approval the account waits for one.
    return null;
  }
};

/** ----------------------------------------------------------------- profile */

/**
 * Create `users/{uid}` for a Google account signing in for the first time.
 *
 * The role and status written here are only a request: the Firestore rules
 * accept ACTIVE solely for a permanent admin e-mail or an e-mail an
 * administrator has approved, with exactly the role they chose. Anything
 * else is created PENDING.
 */
const provisionProfile = async (user) => {
  const database = requireDb();

  const existing = await getDoc(userDoc(user.uid));
  if (existing.exists()) return { profile: existing.data(), created: false };

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw new Error('GOOGLE_EMAIL_MISSING');

  const listedAdmin = isAdminEmail(email);
  const approval = listedAdmin ? null : await getApproval(email);
  const approved = approval?.status === USER_STATUS.ACTIVE;

  const granted = listedAdmin || approved;
  const role = listedAdmin ? ROLES.ADMIN : approved ? approval.role : ROLES.USER;
  const status = granted ? USER_STATUS.ACTIVE : USER_STATUS.PENDING;
  // The name the administrator typed wins; otherwise the Google account's own.
  const name = String(approval?.name || user.displayName || email.split('@')[0])
    .trim()
    .slice(0, 120);

  // Step 1 - the profile. This has to commit before anything else because every other rule in the
  // system authorises the caller by reading users/{uid}.
  const profile = {
    uid: user.uid,
    name,
    email,
    mobile: '',
    photoURL: user.photoURL || '',
    provider: GOOGLE_PROVIDER_ID,
    role,
    status,
    loginCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: null,
    lastActiveAt: null,
  };
  if (approved) {
    profile.approvedBy = approval.addedBy || '';
    profile.approvedByEmail = approval.addedByEmail || '';
    profile.approvedAt = serverTimestamp();
  }

  const profileBatch = writeBatch(database);
  profileBatch.set(userDoc(user.uid), profile);

  // The approval has done its job: from here on the account is managed
  // through its profile, like every other user.
  if (approved) profileBatch.delete(accessDoc(email));

  await profileBatch.commit();

  // Step 2 - counters + audit. Non-critical: a failure here must not undo a
  // successful registration, so it is logged and swallowed. An account still
  // waiting for approval is counted when an administrator approves it.
  if (granted) {
    try {
      const statsBatch = writeBatch(database);
      queueUserRegistered(statsBatch);
      await statsBatch.commit();
    } catch (error) {
      logError('provisionProfile:counters', error);
    }
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.SIGNUP,
    userId: user.uid,
    email,
    targetId: user.uid,
    metadata: { role, status, provider: GOOGLE_PROVIDER_ID, ...getDeviceInfo() },
  });

  return { profile, created: true };
};

/** One provisioning run per account, however many callers ask at once. */
const provisioning = new Map();

/**
 * Find - or, on a first sign-in, create - the profile a Google account maps
 * to. Safe to call from the sign-in button and the auth listener together.
 *
 * @returns {Promise<{ profile: object, created: boolean }>}
 */
export const ensureProfile = (user) => {
  const running = provisioning.get(user.uid);
  if (running) return running;

  const task = provisionProfile(user).finally(() => provisioning.delete(user.uid));
  provisioning.set(user.uid, task);
  return task;
};

/** ----------------------------------------------------------------- login */

/** Everything that follows a successful Google sign-in. */
const finishSignIn = async (user) => {
  const email = String(user.email || '').trim().toLowerCase();
  const { profile, created } = await ensureProfile(user);

  if (profile.status === USER_STATUS.DISABLED) {
    await fbLogout();
    throw new Error('ACCOUNT_DISABLED');
  }

  let { role, status } = profile;

  // Allow-listed administrators who signed in before being listed are
  // promoted - and, if they were still waiting, approved - on their next login.
  if ((role !== ROLES.ADMIN || status === USER_STATUS.PENDING) && isAdminEmail(email)) {
    try {
      const promoteBatch = writeBatch(requireDb());
      promoteBatch.update(userDoc(user.uid), {
        role: ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
        updatedAt: serverTimestamp(),
        bootstrappedAt: serverTimestamp(),
      });
      await promoteBatch.commit();

      if (status === USER_STATUS.PENDING) {
        try {
          const statsBatch = writeBatch(requireDb());
          queueUserRegistered(statsBatch);
          await statsBatch.commit();
        } catch (error) {
          logError('finishSignIn:counters', error);
        }
      }
      role = ROLES.ADMIN;
      status = USER_STATUS.ACTIVE;
    } catch (error) {
      logError('finishSignIn:promoteListedAdmin', error);
    }
  }

  const pending = status === USER_STATUS.PENDING;

  await recordLoginSession(user, { isFirstLogin: !profile.loginCount, countable: !pending });
  await linkGoogleAccount(user, profile);

  await writeAuditLog({
    action: AUDIT_ACTIONS.LOGIN,
    userId: user.uid,
    email,
    targetId: user.uid,
    metadata: { provider: GOOGLE_PROVIDER_ID, ...getDeviceInfo() },
  });

  return { user, profile: { ...profile, role, status }, pending, created };
};

/**
 * Sign in with Google.
 *
 * @returns {Promise<object|null>} The signed-in account, or null when the
 *   browser would not open the popup and the page is leaving for Google's
 *   own sign-in screen instead (`completeRedirectSignIn` picks it up on
 *   the way back).
 */
export const signInWithGoogle = async () => {
  requireDb();

  let credential;
  try {
    credential = await loginWithGooglePopup();
  } catch (error) {
    if (!POPUP_UNAVAILABLE.includes(error?.code)) throw error;
    await loginWithGoogleRedirect();
    return null;
  }

  return finishSignIn(credential.user);
};

/** Finish a sign-in that went through the full-page redirect. */
export const completeRedirectSignIn = async () => {
  const credential = await googleRedirectResult();
  return credential?.user ? finishSignIn(credential.user) : null;
};

/**
 * Write `loginSessions/{id}`, refresh `users/{uid}.lastLoginAt` and bump the
 * login counters. Split into three writes because the Firestore rules only
 * permit a narrow field list on each.
 *
 * @param {boolean} [options.countable] False for an account still waiting
 *   for approval: its sign-in is logged, but it is not a user of the
 *   system yet and may not write the counters.
 */
export const recordLoginSession = async (user, { isFirstLogin = false, countable = true } = {}) => {
  const database = requireDb();
  const info = getDeviceInfo();

  try {
    const sessionBatch = writeBatch(database);
    const sessionRef = doc(loginSessionsCol());

    sessionBatch.set(sessionRef, {
      userId: user.uid,
      email: (user.email || '').toLowerCase(),
      loginAt: serverTimestamp(),
      device: info.device,
      browser: info.browser,
      platform: info.platform,
      screen: info.screen,
      timezone: info.timezone,
    });

    await sessionBatch.commit();
  } catch (error) {
    logError('recordLoginSession:session', error);
  }

  try {
    const profileBatch = writeBatch(database);
    profileBatch.update(userDoc(user.uid), {
      lastLoginAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      loginCount: increment(1),
      lastDevice: `${info.device} - ${info.browser}`,
      updatedAt: serverTimestamp(),
    });
    await profileBatch.commit();
  } catch (error) {
    logError('recordLoginSession:profile', error);
  }

  if (!countable) return;

  try {
    const counterBatch = writeBatch(database);
    queueLoginRecorded(counterBatch, { isFirstLogin });
    await counterBatch.commit();
  } catch (error) {
    logError('recordLoginSession:counters', error);
  }
};

/**
 * Keep the profile pointing at the Google account it belongs to. An account
 * created with e-mail and password before the move to Google sign-in is
 * linked here the first time its owner signs in with Google.
 */
const linkGoogleAccount = async (user, profile) => {
  const photoURL = user.photoURL || '';
  if (profile.provider === GOOGLE_PROVIDER_ID && (profile.photoURL || '') === photoURL) return;

  try {
    const linkBatch = writeBatch(requireDb());
    linkBatch.update(userDoc(user.uid), {
      provider: GOOGLE_PROVIDER_ID,
      photoURL,
      updatedAt: serverTimestamp(),
    });
    await linkBatch.commit();
  } catch (error) {
    logError('linkGoogleAccount', error);
  }
};

/** ---------------------------------------------------------------- logout */

export const signOutUser = async (profile) => {
  const user = currentUser();
  if (user) {
    await writeAuditLog({
      action: AUDIT_ACTIONS.LOGOUT,
      userId: user.uid,
      email: user.email || profile?.email || '',
      targetId: user.uid,
    });
  }
  await fbLogout();
};

/** -------------------------------------------------------------- password */

/** Only for an account that still has an e-mail/password credential. */
export const updateOwnPassword = ({ currentPassword, newPassword }) =>
  changePassword(currentPassword, newPassword);

/** ---------------------------------------------------------------- helper */

/** Live profile document path helper, re-exported for the auth hook. */
export const profileRef = (uid) => userDoc(uid);
export const USERS_COLLECTION = COLLECTIONS.USERS;
