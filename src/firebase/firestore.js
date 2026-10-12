/**
 * Central place for Firestore collection references and the small helpers
 * shared by every service. Keeping the collection names in one module avoids
 * typo-driven bugs and makes the data model easy to audit.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export const COLLECTIONS = {
  USERS: 'users',
  LOGIN_SESSIONS: 'loginSessions',
  RECEIPTS: 'receipts',
  SETTINGS: 'settings',
  COUNTERS: 'counters',
  AUDIT_LOGS: 'auditLogs',
  /** Public, read-only copy of a receipt's non-personal fields for QR scans. */
  VERIFICATIONS: 'verifications',
  /** Google accounts an administrator has approved before their first sign-in. */
  ACCESS_LIST: 'accessList',
};

export const COUNTER_IDS = {
  GLOBAL: 'global',
  /** counters/daily_YYYY-MM-DD */
  daily: (dateKey) => `daily_${dateKey}`,
  /** counters/receiptSeq_YYYY */
  receiptSeq: (year) => `receiptSeq_${year}`,
};

export const SETTINGS_IDS = {
  APP: 'app',
};

const requireDb = () => {
  if (!db) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  return db;
};

export const usersCol = () => collection(requireDb(), COLLECTIONS.USERS);
export const loginSessionsCol = () => collection(requireDb(), COLLECTIONS.LOGIN_SESSIONS);
export const receiptsCol = () => collection(requireDb(), COLLECTIONS.RECEIPTS);
export const settingsCol = () => collection(requireDb(), COLLECTIONS.SETTINGS);
export const countersCol = () => collection(requireDb(), COLLECTIONS.COUNTERS);
export const auditLogsCol = () => collection(requireDb(), COLLECTIONS.AUDIT_LOGS);
export const accessCol = () => collection(requireDb(), COLLECTIONS.ACCESS_LIST);

export const userDoc = (uid) => doc(requireDb(), COLLECTIONS.USERS, uid);
export const receiptDoc = (id) => doc(requireDb(), COLLECTIONS.RECEIPTS, id);
export const counterDoc = (id) => doc(requireDb(), COLLECTIONS.COUNTERS, id);
export const settingsDoc = (id) => doc(requireDb(), COLLECTIONS.SETTINGS, id);
export const verificationDoc = (token) => doc(requireDb(), COLLECTIONS.VERIFICATIONS, token);
/** Keyed by the lower-cased e-mail, so the security rules can look it up directly. */
export const accessDoc = (email) =>
  doc(requireDb(), COLLECTIONS.ACCESS_LIST, String(email).trim().toLowerCase());

export { db, serverTimestamp, Timestamp, getDoc, getDocs, doc, collection };

/** Convert a Firestore snapshot into a plain object carrying its id. */
export const snapToObject = (snapshot) =>
  snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

/** Convert a query snapshot into an array of plain objects. */
export const snapToArray = (querySnapshot) =>
  querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
