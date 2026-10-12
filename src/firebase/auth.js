/**
 * Thin wrapper over Firebase Authentication.
 *
 * Sign-in is with a Google account: the app never sees or stores a password.
 * The password helpers at the bottom only serve accounts created before the
 * move to Google sign-in that still carry an e-mail/password credential.
 */
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

const requireAuth = () => {
  if (!auth) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  return auth;
};

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  // Always offer the account chooser: on a shared computer at the supply
  // point the next operator must not be signed in as the previous one.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const loginWithGooglePopup = () => signInWithPopup(requireAuth(), googleProvider());

/** Full-page fallback for browsers that refuse to open the popup. */
export const loginWithGoogleRedirect = () => signInWithRedirect(requireAuth(), googleProvider());

/** The credential of a redirect sign-in that has just come back, or null. */
export const googleRedirectResult = () => getRedirectResult(requireAuth());

export const logout = () => fbSignOut(requireAuth());

/** True for an account that still has an e-mail/password credential. */
export const hasPasswordLogin = (user) =>
  Boolean(user?.providerData?.some((provider) => provider.providerId === 'password'));

/** Firebase requires a fresh credential before a password can be replaced. */
export const changePassword = async (currentPassword, newPassword) => {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user || !user.email) throw new Error('NOT_AUTHENTICATED');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

export const watchAuthState = (callback) => onAuthStateChanged(requireAuth(), callback);

export const currentUser = () => (auth ? auth.currentUser : null);

export { auth };
