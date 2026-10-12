/**
 * Append-only action log. Audit writes must never break the action they are
 * recording, so every failure is swallowed after being logged.
 */
import { addDoc, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { auditLogsCol } from '../firebase/firestore';
import { logError } from '../utils/errors';

/**
 * @param {object} entry
 * @param {string} entry.action    One of AUDIT_ACTIONS.
 * @param {string} entry.userId
 * @param {string} entry.email
 * @param {string} [entry.targetId]
 * @param {object} [entry.metadata]
 */
export const writeAuditLog = async ({ action, userId, email, targetId = null, metadata = {} }) => {
  if (!userId) return;
  try {
    await addDoc(auditLogsCol(), {
      action,
      userId,
      email: email || '',
      targetId,
      metadata,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    logError(`writeAuditLog(${action})`, error);
  }
};

/** Queue an audit entry onto an existing batch so it lands atomically. */
export const queueAuditLog = (batch, ref, { action, userId, email, targetId = null, metadata = {} }) => {
  batch.set(ref, {
    action,
    userId,
    email: email || '',
    targetId,
    metadata,
    timestamp: serverTimestamp(),
  });
};

/** Admin-only live feed of the most recent actions. */
export const subscribeRecentAudit = (onChange, onError, take = 25) =>
  onSnapshot(
    query(auditLogsCol(), orderBy('timestamp', 'desc'), limit(take)),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      logError('subscribeRecentAudit', error);
      onError?.(error);
    },
  );

export const subscribeAuditByAction = (action, onChange, onError, take = 50) =>
  onSnapshot(
    query(auditLogsCol(), where('action', '==', action), orderBy('timestamp', 'desc'), limit(take)),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      logError('subscribeAuditByAction', error);
      onError?.(error);
    },
  );
