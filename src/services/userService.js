/**
 * User directory, access management and login-activity queries
 * (administrator surface).
 *
 * An account is a `users/{uid}` profile, created the first time a Google
 * account signs in. Until then, an administrator's approval of an e-mail
 * address is held in `accessList/{email}`; signing in turns it into the
 * profile and removes it.
 */
import {
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import {
  accessCol,
  accessDoc,
  auditLogsCol,
  db,
  loginSessionsCol,
  snapToArray,
  userDoc,
  usersCol,
} from '../firebase/firestore';
import { AUDIT_ACTIONS, ROLES, USER_STATUS } from '../utils/constants';
import { logError } from '../utils/errors';
import { queueAuditLog } from './auditService';
import { queueUserDeleted, queueUserStatusChanged } from './counterService';

const requireDb = () => {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  return db;
};

/** Live directory of every registered account. Administrators only. */
export const subscribeUsers = (onChange, onError, take = 500) =>
  onSnapshot(
    query(usersCol(), orderBy('createdAt', 'desc'), limit(take)),
    (snapshot) => onChange(snapToArray(snapshot)),
    (error) => {
      logError('subscribeUsers', error);
      onError?.(error);
    },
  );

export const fetchUsers = async (take = 500) =>
  snapToArray(await getDocs(query(usersCol(), orderBy('createdAt', 'desc'), limit(take))));

/** Promote / demote. Guarded again by the Firestore rules. */
export const setUserRole = async (target, role, actor) => {
  if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role.');
  const database = requireDb();

  const batch = writeBatch(database);
  batch.update(userDoc(target.id || target.uid), { role, updatedAt: serverTimestamp() });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.UPDATE_USER,
    userId: actor.uid,
    email: actor.email,
    targetId: target.id || target.uid,
    metadata: { field: 'role', from: target.role, to: role },
  });
  await batch.commit();
};

/**
 * Enable / disable an account.
 *
 * Note: this flips the Firestore profile flag, which every security rule
 * consults, so a disabled account immediately loses read and write access.
 * Revoking the Firebase Auth credential itself requires the Admin SDK and is
 * done from the Firebase console - see README, "Disabling an account".
 */
export const setUserStatus = async (target, status, actor) => {
  if (!Object.values(USER_STATUS).includes(status)) throw new Error('Invalid status.');
  const database = requireDb();

  const batch = writeBatch(database);
  batch.update(userDoc(target.id || target.uid), { status, updatedAt: serverTimestamp() });
  queueUserStatusChanged(batch, { from: target.status, to: status });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.UPDATE_USER,
    userId: actor.uid,
    email: actor.email,
    targetId: target.id || target.uid,
    metadata: { field: 'status', from: target.status, to: status },
  });
  await batch.commit();
};

/**
 * Approve a Google account that signed in and has been waiting (PENDING),
 * giving it the chosen role. Guarded again by the Firestore rules.
 */
export const approveUser = async (target, role, actor) => {
  if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role.');
  const database = requireDb();
  const id = target.id || target.uid;

  const batch = writeBatch(database);
  batch.update(userDoc(id), {
    role,
    status: USER_STATUS.ACTIVE,
    approvedBy: actor.uid,
    approvedByEmail: actor.email,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  queueUserStatusChanged(batch, { from: target.status, to: USER_STATUS.ACTIVE });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.GRANT_ACCESS,
    userId: actor.uid,
    email: actor.email,
    targetId: id,
    metadata: { email: target.email, role, from: target.status, to: USER_STATUS.ACTIVE },
  });
  await batch.commit();
};

/** ---------------------------------------------------- approved in advance */

/** Live list of e-mails approved before their Google account has signed in. */
export const subscribeAccessList = (onChange, onError, take = 500) =>
  onSnapshot(
    query(accessCol(), orderBy('addedAt', 'desc'), limit(take)),
    (snapshot) => onChange(snapToArray(snapshot)),
    (error) => {
      logError('subscribeAccessList', error);
      onError?.(error);
    },
  );

/**
 * Approve a Google account by its e-mail address before it has ever signed
 * in. Its first sign-in creates the profile with this role, already active.
 */
export const grantAccess = async ({ email, name = '', role = ROLES.USER }, actor) => {
  if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role.');
  const database = requireDb();
  const cleanEmail = String(email).trim().toLowerCase();

  const batch = writeBatch(database);
  batch.set(accessDoc(cleanEmail), {
    email: cleanEmail,
    name: String(name).trim().slice(0, 120),
    role,
    status: USER_STATUS.ACTIVE,
    addedBy: actor.uid,
    addedByEmail: actor.email,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.GRANT_ACCESS,
    userId: actor.uid,
    email: actor.email,
    targetId: cleanEmail,
    metadata: { email: cleanEmail, role, before: 'first sign-in' },
  });
  await batch.commit();
};

/** Change the role an approved e-mail will receive on its first sign-in. */
export const setAccessRole = async (entry, role, actor) => {
  if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role.');
  const database = requireDb();

  const batch = writeBatch(database);
  batch.update(accessDoc(entry.email), { role, updatedAt: serverTimestamp() });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.GRANT_ACCESS,
    userId: actor.uid,
    email: actor.email,
    targetId: entry.email,
    metadata: { field: 'role', from: entry.role, to: role },
  });
  await batch.commit();
};

/** Withdraw an approval that has not been used yet. */
export const revokeAccess = async (entry, actor) => {
  const database = requireDb();

  const batch = writeBatch(database);
  batch.delete(accessDoc(entry.email));
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.REVOKE_ACCESS,
    userId: actor.uid,
    email: actor.email,
    targetId: entry.email,
    metadata: { email: entry.email, role: entry.role },
  });
  await batch.commit();
};

/** Remove the Firestore profile. The Auth credential is deleted from console. */
export const deleteUserProfile = async (target, actor) => {
  const database = requireDb();
  const batch = writeBatch(database);

  batch.delete(userDoc(target.id || target.uid));
  queueUserDeleted(batch, { status: target.status });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.UPDATE_USER,
    userId: actor.uid,
    email: actor.email,
    targetId: target.id || target.uid,
    metadata: { field: 'deleted', email: target.email },
  });

  await batch.commit();
};

/** Update the signed-in operator's own profile fields. */
export const updateOwnProfile = async (uid, { name, mobile }) => {
  const database = requireDb();
  const batch = writeBatch(database);
  const patch = { updatedAt: serverTimestamp() };
  if (name !== undefined) patch.name = String(name).trim();
  if (mobile !== undefined) patch.mobile = String(mobile).replace(/\D/g, '');
  batch.update(userDoc(uid), patch);
  await batch.commit();
};

/** ------------------------------------------------------- login sessions */

/**
 * Live login-activity feed.
 *
 * Non-administrators are pinned to their own sessions, which is also what the
 * security rules require for the query to be authorised.
 */
export const subscribeLoginSessions = (
  { viewer, email = '', from = null, to = null, take = 200 },
  onChange,
  onError,
) => {
  const constraints = [];
  const isAdmin = viewer?.role === ROLES.ADMIN;

  if (!isAdmin) constraints.push(where('userId', '==', viewer.uid));
  else if (email) constraints.push(where('email', '==', String(email).toLowerCase()));

  if (from) constraints.push(where('loginAt', '>=', Timestamp.fromDate(from)));
  if (to) constraints.push(where('loginAt', '<=', Timestamp.fromDate(to)));

  constraints.push(orderBy('loginAt', 'desc'), limit(take));

  return onSnapshot(
    query(loginSessionsCol(), ...constraints),
    (snapshot) => onChange(snapToArray(snapshot)),
    (error) => {
      logError('subscribeLoginSessions', error);
      onError?.(error);
    },
  );
};

export const fetchLoginSessionsPage = async ({ viewer, email, from, to, take = 50, cursor }) => {
  const constraints = [];
  const isAdmin = viewer?.role === ROLES.ADMIN;

  if (!isAdmin) constraints.push(where('userId', '==', viewer.uid));
  else if (email) constraints.push(where('email', '==', String(email).toLowerCase()));
  if (from) constraints.push(where('loginAt', '>=', Timestamp.fromDate(from)));
  if (to) constraints.push(where('loginAt', '<=', Timestamp.fromDate(to)));

  constraints.push(orderBy('loginAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(take + 1));

  const snapshot = await getDocs(query(loginSessionsCol(), ...constraints));
  const docs = snapshot.docs;
  const hasMore = docs.length > take;
  const pageDocs = hasMore ? docs.slice(0, take) : docs;

  return {
    rows: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: pageDocs[pageDocs.length - 1] || null,
    hasMore,
  };
};
