
/**
 * Receipt / Dispatch Identifier Generation
 *
 * Receipt ID:
 * APS-2026-000001
 *
 * Dispatch ID:
 * GCTR20261013001
 * GCTR20261013002
 *
 * Features:
 * - Atomic Firestore sequence allocation
 * - Unique daily dispatch sequence
 * - Secure QR verification tokens
 * - Fallback order ID generation
 */

import { runTransaction } from 'firebase/firestore';
import { db, counterDoc, COUNTER_IDS } from '../firebase/firestore';
import { DEFAULT_RECEIPT_PREFIX } from './constants';

const SEQUENCE_WIDTH = 6;
const DISPATCH_SEQUENCE_WIDTH = 3;

/**
 * Format receipt ID.
 * Example: APS-2026-000001
 */
export const formatReceiptId = (prefix, year, sequence) =>
  `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_WIDTH, '0')}`;

/**
 * Atomically reserve the next receipt number for the year.
 */
export const reserveReceiptNumber = async (
  prefix = DEFAULT_RECEIPT_PREFIX,
  year
) => {
  if (!db) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }

  const targetYear = year || new Date().getFullYear();
  const ref = counterDoc(COUNTER_IDS.receiptSeq(targetYear));

  const cleanPrefix =
    String(prefix || DEFAULT_RECEIPT_PREFIX)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || DEFAULT_RECEIPT_PREFIX;

  const sequence = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);

    const current = snapshot.exists()
      ? Number(snapshot.data().seq) || 0
      : 0;

    const next = current + 1;

    tx.set(
      ref,
      {
        seq: next,
        year: targetYear,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return next;
  });

  return {
    receiptId: formatReceiptId(cleanPrefix, targetYear, sequence),
    sequence,
    year: targetYear,
  };
};

/**
 * Generate a unique Dispatch ID.
 *
 * Format: GCTR + YYYYMMDD + 3-digit sequence
 * Example: GCTR20261013001
 *
 * The sequence is stored in a daily Firestore counter.
 *
 * IMPORTANT:
 * This is async and reserves the number immediately, so always `await` it
 * and call it once, when the receipt is saved - never while rendering.
 */
export const buildDispatchId = async (date = new Date()) => {
  if (!db) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const dateStamp = `${year}${month}${day}`;
  const ref = counterDoc(`dispatchSeq_${dateStamp}`);

  const sequence = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);

    const current = snapshot.exists()
      ? Number(snapshot.data().seq) || 0
      : 0;

    const next = current + 1;

    tx.set(
      ref,
      {
        seq: next,
        date: dateStamp,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return next;
  });

  return `GCTR${dateStamp}${String(sequence).padStart(
    DISPATCH_SEQUENCE_WIDTH,
    '0'
  )}`;
};

/**
 * Generate a secure public QR verification token.
 */
export const generateVerifyToken = (length = 20) => {
  if (!Number.isInteger(length) || length < 1 || length > 256) {
    throw new Error('INVALID_VERIFY_TOKEN_LENGTH');
  }

  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length]
  ).join('');
};

/**
 * Generate a fallback Order ID.
 * Example: ORD202610131234
 */
export const suggestOrderId = () => {
  const now = new Date();

  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;

  const random = Math.floor(1000 + Math.random() * 9000);

  return `ORD${stamp}${random}`;
};
