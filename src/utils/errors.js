/**
 * Firebase errors are precise but unfriendly ("auth/invalid-credential").
 * Everything user-facing goes through here; the raw error is only ever logged
 * to the console for developers.
 */

const AUTH_MESSAGES = {
  // --- Google sign-in
  'auth/popup-blocked':
    'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before it finished.',
  'auth/cancelled-popup-request': 'The Google sign-in window was closed before it finished.',
  'auth/account-exists-with-different-credential':
    'This email already has an account with a different sign-in method. Please contact your administrator.',
  'auth/unauthorized-domain':
    'This web address is not authorised for Google sign-in. Add it under Authentication > Settings > Authorised domains in the Firebase console.',
  'auth/user-disabled': 'This account has been disabled. Please contact your administrator.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem. Please check your internet connection.',
  'auth/operation-not-allowed':
    'Google sign-in is not enabled for this Firebase project yet. Enable it under Authentication > Sign-in method in the Firebase console.',
  // Returned when Authentication has never been set up on the project at all,
  // which reads identically to a broken app unless we say so.
  'auth/configuration-not-found':
    'Firebase Authentication is not set up for this project yet. Enable Google sign-in in the Firebase console.',
  // --- Changing the password of an account that still has one
  'auth/invalid-credential': 'The current password is not correct.',
  'auth/invalid-login-credentials': 'The current password is not correct.',
  'auth/wrong-password': 'The current password is not correct.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/requires-recent-login': 'Please log out and log in again before changing your password.',
  'auth/missing-password': 'Password is required.',
};

const FIRESTORE_MESSAGES = {
  'permission-denied': 'You do not have permission to perform this action.',
  unavailable: 'Service temporarily unavailable. Please check your connection and try again.',
  'deadline-exceeded': 'The request took too long. Please try again.',
  'failed-precondition':
    'This query needs a Firestore index. Ask your administrator to deploy firestore.indexes.json.',
  'resource-exhausted': 'Daily quota exceeded. Please try again later.',
  'not-found': 'The requested record no longer exists.',
  'already-exists': 'That record already exists.',
  unauthenticated: 'Your session has expired. Please log in again.',
  cancelled: 'The operation was cancelled.',
};

const LOCAL_MESSAGES = {
  FIREBASE_NOT_CONFIGURED:
    'Firebase is not configured. Copy .env.example to .env.local and add your project keys.',
  NOT_AUTHENTICATED: 'Your session has expired. Please log in again.',
  ACCOUNT_DISABLED: 'This account has been disabled. Please contact your administrator.',
  PROFILE_MISSING: 'Your user profile could not be loaded. Please contact your administrator.',
  GOOGLE_EMAIL_MISSING:
    'That Google account did not share an email address. Please choose a different account.',
};

/**
 * @param {unknown} error   The caught error.
 * @param {string} fallback Domain-specific default, e.g. "Unable to save receipt."
 */
export const friendlyError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;

  const code = error.code || error.message || '';

  if (LOCAL_MESSAGES[code]) return LOCAL_MESSAGES[code];
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];

  const bare = String(code).replace(/^firestore\//, '');
  if (FIRESTORE_MESSAGES[bare]) return FIRESTORE_MESSAGES[bare];

  return fallback;
};

/** Log the technical detail for developers without leaking it to the UI. */
export const logError = (scope, error) => {
  // eslint-disable-next-line no-console
  console.error(`[AP SAND] ${scope}:`, error);
};

/** Run an async Firebase call with consistent logging + friendly messaging. */
export const guard = async (scope, fallbackMessage, fn) => {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    logError(scope, error);
    return { ok: false, error, message: friendlyError(error, fallbackMessage) };
  }
};
