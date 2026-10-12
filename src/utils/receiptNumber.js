/**
 * Receipt / dispatch identifier generation.
 *
 * Receipt numbers must be unique even when several operators press
 * "Generate Receipt" at the same instant on different machines, so the
 * sequence lives in a Firestore document (`counters/receiptSeq_{year}`) and is
 * advanced inside a transaction. Firestore retries the transaction on
 * contention, which gives us a gap-free, collision-free sequence.
 */
import { runTransaction } from 'firebase/firestore';
import { db, counterDoc, COUNTER_IDS } from '../firebase/firestore';
import { DEFAULT_RECEIPT_PREFIX } from './constants';

const SEQUENCE_WIDTH = 6;

/** `APS-2026-000001` */
export const formatReceiptId = (prefix, year, sequence) =>
  `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_WIDTH, '0')}`;

/**
 * Atomically reserve the next receipt number for the given year.
 *
 * @param {string} prefix   Receipt prefix from settings, e.g. `APS`.
 * @param {number} [year]   Defaults to the current calendar year.
 * @returns {Promise<{ receiptId: string, sequence: number, year: number }>}
 */
export const reserveReceiptNumber = async (prefix = DEFAULT_RECEIPT_PREFIX, year) => {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');

  const targetYear = year || new Date().getFullYear();
  const ref = counterDoc(COUNTER_IDS.receiptSeq(targetYear));
  const cleanPrefix = String(prefix || DEFAULT_RECEIPT_PREFIX)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || DEFAULT_RECEIPT_PREFIX;

  const sequence = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const next = (snapshot.exists() ? Number(snapshot.data().seq) || 0 : 0) + 1;
    tx.set(ref, { seq: next, year: targetYear, updatedAt: new Date() }, { merge: true });
    return next;
  });

  return {
    receiptId: formatReceiptId(cleanPrefix, targetYear, sequence),
    sequence,
    year: targetYear,
  };
};

/**
 * Dispatch identifier - derived from the receipt number so the two are always
 * traceable to each other, with a short random suffix for scanning.
 */
export const buildDispatchId = (receiptId) => {
  const compact = String(receiptId || '').replace(/[^A-Z0-9]/gi, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DSP${compact}${suffix}`;
};

/**
 * Unguessable key for the public QR verification page. Receipt numbers are
 * sequential, so they must never be what the public URL is keyed on.
 */
export const generateVerifyToken = (length = 20) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

/** Dispatch id pre-filled in the form, e.g. `DSP20260929K7Q2X9`. */
export const suggestDispatchId = () => {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `DSP${stamp}${suffix}`;
};

/** Fallback order id offered in the form when the operator has none to hand. */
export const suggestOrderId = () => {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD${stamp}${random}`;
};
