/**
 * Firebase bootstrap.
 *
 * Every value is read from Vite environment variables so no project
 * credentials are ever hard-coded inside a component. Copy `.env.example`
 * to `.env.local` and fill in the values from the Firebase console.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

/** True when `.env.local` has actually been filled in. */
export const isFirebaseConfigured = REQUIRED_KEYS.every(
  (key) => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim().length > 0,
);

export const missingFirebaseKeys = REQUIRED_KEYS.filter(
  (key) => !firebaseConfig[key] || !String(firebaseConfig[key]).trim(),
).map((key) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  auth = getAuth(app);
  // Keep the session inside this browser only; never mirror credentials into
  // our own storage. Firebase manages the refresh token securely for us.
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('[firebase] Unable to set auth persistence:', error);
  });

  // Offline cache keeps the dashboard responsive and survives brief network
  // drops at the sand supply point. Multi-tab manager keeps tabs in sync.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn('[firebase] Persistent cache unavailable, falling back to memory cache.', error);
    db = initializeFirestore(app, {});
  }
} else {
  console.error(
    '[firebase] Configuration missing. Create a .env.local file (see .env.example). Missing:',
    missingFirebaseKeys.join(', '),
  );
}

/**
 * E-mails that always receive the ADMIN role, on sign-up or on their next
 * login. Keep this list in sync with `adminEmails()` in `firestore.rules`,
 * which is what actually grants the role server-side.
 */
export const ADMIN_EMAILS = [
  'jangambharath017@gmail.com',
  'akumatha@gmail.com',
];

export const isAdminEmail = (email) =>
  ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());

export { app, auth, db, firebaseConfig };
export default app;
