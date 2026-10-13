/**
 * Receipt persistence: create, read, paginate, search, correct, cancel, delete.
 *
 * Firestore has no `LIKE`, so every receipt carries a `searchKeys` array of
 * lower-cased tokens and prefixes. That turns "search by customer name /
 * vehicle no / order id / mobile" into a single indexed `array-contains`
 * query instead of a full-collection scan.
 */
import {
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auditLogsCol,
  db,
  receiptDoc,
  receiptsCol,
  snapToArray,
  snapToObject,
  verificationDoc,
} from '../firebase/firestore';
import { AUDIT_ACTIONS, RECEIPT_STATUS, ROLES } from '../utils/constants';
import { combineDateAndTime, toDate } from '../utils/dateUtils';
import { digitsOnly, normaliseVehicleNo } from '../utils/validation';
import { logError } from '../utils/errors';
import {
  buildDispatchId,
  generateVerifyToken,
  reserveReceiptNumber,
} from '../utils/receiptNumber';
import { queueAuditLog } from './auditService';
import {
  queueReceiptCancelled,
  queueReceiptCreated,
  queueReceiptDeleted,
} from './counterService';

const MAX_SEARCH_KEYS = 260;
const MIN_PREFIX = 2;
const MAX_PREFIX = 14;

const requireDb = () => {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  return db;
};

/** Blank form input is stored as null, not 0: "not recorded" is not zero. */
const optionalNumber = (value) =>
  value === '' || value === null || value === undefined ? null : Number(value);

/** ------------------------------------------------------------- searching */

const tokenize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const addWithPrefixes = (set, value) => {
  const clean = String(value ?? '').toLowerCase().replace(/\s+/g, '');
  if (!clean) return;
  set.add(clean);
  for (let len = MIN_PREFIX; len < Math.min(clean.length, MAX_PREFIX); len += 1) {
    set.add(clean.slice(0, len));
  }
};

/** Tokens + prefixes for everything the Search screen is allowed to match on. */
export const buildSearchKeys = (receipt) => {
  const set = new Set();

  [
    receipt.receiptId,
    receipt.orderId,
    receipt.dispatchId,
    receipt.hologramId,
    receipt.tripNo,
    receipt.customerMobile,
    receipt.driverMobile,
    normaliseVehicleNo(receipt.vehicleNo),
    receipt.vehicleTrip,
  ].forEach((value) => addWithPrefixes(set, value));

  [receipt.customerName, receipt.driverName, receipt.supplyPoint, receipt.constructionName]
    .flatMap(tokenize)
    .forEach((token) => addWithPrefixes(set, token));

  // Last four digits of each mobile - how operators usually search on paper.
  [receipt.customerMobile, receipt.driverMobile].forEach((mobile) => {
    const digits = digitsOnly(mobile);
    if (digits.length === 10) set.add(digits.slice(-4));
  });

  return Array.from(set).slice(0, MAX_SEARCH_KEYS);
};

/** Normalise whatever the operator typed into a single searchable token. */
export const normaliseSearchTerm = (term) =>
  String(term ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, MAX_PREFIX);

/** ---------------------------------------------------------- verification */

/**
 * The public copy behind the receipt QR code: everything printed on the
 * receipt, so any scan shows the whole dispatch. This replaces spec section
 * 15's identifiers-only copy at the owner's request (30-09-2026): anybody
 * holding the receipt or a photo of its QR can read these details, the same
 * ones printed on the paper.
 */
const buildVerification = (receipt) => ({
  receiptId: receipt.receiptId,
  orderId: receipt.orderId || '',
  dispatchId: receipt.dispatchId || '',
  hologramId: receipt.hologramId || '',
  tripNo: receipt.tripNo || '',
  customerName: receipt.customerName || '',
  customerMobile: receipt.customerMobile || '',
  sandQuantity: Number(receipt.sandQuantity) || 0,
  sandUnit: receipt.sandUnit || '',
  supplyPoint: receipt.supplyPoint || '',
  availableSand: receipt.availableSand ?? null,
  registrationType: receipt.registrationType || '',
  registrationQuantity: receipt.registrationQuantity ?? null,
  eligibleQuantity: receipt.eligibleQuantity ?? null,
  dispatchAt: receipt.dispatchAt || null,
  dispatchDate: receipt.dispatchDate || '',
  dispatchTime: receipt.dispatchTime || '',
  registrationAt: receipt.registrationAt || null,
  registrationDate: receipt.registrationDate || '',
  registrationTime: receipt.registrationTime || '',
  driverName: receipt.driverName || '',
  driverMobile: receipt.driverMobile || '',
  vehicleNo: receipt.vehicleNo || '',
  vehicleTrip: receipt.vehicleTrip || '',
  address: receipt.address || '',
  registrationAddress: receipt.registrationAddress || '',
  constructionName: receipt.constructionName || '',
  createdByEmail: receipt.createdByEmail || '',
  status: receipt.status || RECEIPT_STATUS.ACTIVE,
  createdBy: receipt.createdBy,
});

/** Public lookup used by the /v/:token page. Works without signing in. */
export const getVerification = async (token) => {
  if (!token) return null;
  requireDb();
  return snapToObject(await getDoc(verificationDoc(token)));
};

/**
 * Bring a verification record saved while it held only identifiers and the
 * vehicle up to the full copy, so its already-printed QR shows every detail.
 * Reads first and writes only when the record is out of date. The rules only
 * let an administrator or the receipt's creator write it.
 *
 * @returns {Promise<boolean>} true when the record was rewritten.
 */
export const refreshVerification = async (receipt) => {
  if (!receipt?.verifyToken) return false;
  const current = await getVerification(receipt.verifyToken);
  if (current && current.customerName !== undefined) return false;

  await setDoc(
    verificationDoc(receipt.verifyToken),
    {
      ...buildVerification(receipt),
      ...(current ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
};

/**
 * Give an older receipt (saved before QR verification existed) a public
 * verification record so a reprint carries a scannable QR.
 */
export const attachVerification = async (receipt) => {
  const database = requireDb();
  if (receipt.verifyToken) return receipt;

  const verifyToken = generateVerifyToken();
  const batch = writeBatch(database);
  batch.update(receiptDoc(receipt.id || receipt.receiptId), {
    verifyToken,
    updatedAt: serverTimestamp(),
  });
  batch.set(verificationDoc(verifyToken), {
    ...buildVerification(receipt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...receipt, verifyToken };
};

/**
 * Find a receipt from whatever an operator typed or scanned: a receipt
 * number (`APS-2026-000001`), a dispatch id (`GCTR...`, or `DSP...` on older
 * receipts) or a hologram id.
 */
export const findReceiptByCode = async (code, viewer) => {
  const value = String(code || '').trim();
  if (!value) return null;

  const upper = value.toUpperCase();
  if (!/^(GCTR|DSP)/.test(upper)) {
    try {
      const byId = await getReceiptById(upper);
      if (byId) return byId;
    } catch (error) {
      // permission-denied means "exists but not yours" - fall through so the
      // caller shows "not found" rather than leaking that it exists.
      logError('findReceiptByCode:id', error);
    }
  }

  for (const field of ['dispatchId', 'hologramId']) {
    const constraints = [where(field, '==', upper)];
    if (viewer?.role !== ROLES.ADMIN) constraints.push(where('createdBy', '==', viewer.uid));
    constraints.push(limit(1));
    const snapshot = await getDocs(query(receiptsCol(), ...constraints));
    const found = snapToArray(snapshot)[0];
    if (found) return found;
  }
  return null;
};

/** ---------------------------------------------------------------- create */

/**
 * @param {object} form      Raw values from ReceiptForm.
 * @param {object} actor     `{ uid, email }` of the signed-in operator.
 * @param {object} settings  App settings (supplies the receipt prefix).
 * @returns {Promise<object>} The stored receipt, with local timestamps so it
 *                            can be previewed and printed immediately.
 */
export const createReceipt = async (form, actor, settings = {}) => {
  const database = requireDb();
  if (!actor?.uid) throw new Error('NOT_AUTHENTICATED');

  const { receiptId } = await reserveReceiptNumber(settings.receiptPrefix);
  const now = new Date();
  const dispatchId = await buildDispatchId(now);

  const dispatchAt = combineDateAndTime(form.dispatchDate, form.dispatchTime);
  const registrationAt = combineDateAndTime(form.registrationDate, form.registrationTime);

  const base = {
    receiptId,
    orderId: String(form.orderId).trim(),
    tripNo: String(form.tripNo ?? '').trim(),
    customerName: String(form.customerName).trim(),
    customerMobile: digitsOnly(form.customerMobile),
    sandQuantity: Number(form.sandQuantity),
    sandUnit: String(form.sandUnit || '').trim(),
    supplyPoint: String(form.supplyPoint ?? '').trim(),
    dispatchDate: form.dispatchDate || '',
    dispatchTime: form.dispatchTime || '',
    dispatchAt: dispatchAt ? Timestamp.fromDate(dispatchAt) : null,
    registrationDate: form.registrationDate || '',
    registrationTime: form.registrationTime || '',
    registrationAt: registrationAt ? Timestamp.fromDate(registrationAt) : null,
    driverName: String(form.driverName).trim(),
    driverMobile: digitsOnly(form.driverMobile),
    vehicleNo: normaliseVehicleNo(form.vehicleNo),
    vehicleTrip: form.vehicleTrip,
    address: String(form.address ?? '').trim(),
    registrationAddress: String(form.registrationAddress ?? '').trim(),
    availableSand: form.availableSand === '' || form.availableSand === null
      ? null
      : Number(form.availableSand),
    registrationType: String(form.registrationType ?? '').trim().toUpperCase(),
    registrationQuantity: optionalNumber(form.registrationQuantity),
    eligibleQuantity: optionalNumber(form.eligibleQuantity),
    constructionName: String(form.constructionName ?? '').trim(),
    dispatchId,
    hologramId: String(form.hologramId ?? '').trim().toUpperCase(),
    status: RECEIPT_STATUS.ACTIVE,
    createdBy: actor.uid,
    createdByEmail: String(actor.email || '').toLowerCase(),
    createdByName: actor.name || '',
    verifyToken: generateVerifyToken(),
  };

  const payload = {
    ...base,
    searchKeys: buildSearchKeys(base),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Receipt document, counters and audit entry all commit together, so a
  // half-written receipt can never skew the dashboard.
  const batch = writeBatch(database);
  batch.set(receiptDoc(receiptId), payload);
  batch.set(verificationDoc(base.verifyToken), {
    ...buildVerification(base),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  queueReceiptCreated(batch, {
    sandQuantity: base.sandQuantity,
    vehicleTrip: base.vehicleTrip,
    createdAt: now,
  });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.CREATE_RECEIPT,
    userId: actor.uid,
    email: actor.email,
    targetId: receiptId,
    metadata: {
      orderId: base.orderId,
      vehicleNo: base.vehicleNo,
      vehicleTrip: base.vehicleTrip,
      sandQuantity: base.sandQuantity,
    },
  });

  await batch.commit();

  return { id: receiptId, ...base, createdAt: now, updatedAt: now };
};

/** ---------------------------------------------------------------- update */

export const updateReceipt = async (receiptId, patch, actor) => {
  const database = requireDb();
  const snapshot = await getDoc(receiptDoc(receiptId));
  if (!snapshot.exists()) throw new Error('not-found');

  const existing = snapshot.data();
  const merged = { ...existing, ...patch };

  const batch = writeBatch(database);
  batch.update(receiptDoc(receiptId), {
    ...patch,
    searchKeys: buildSearchKeys(merged),
    updatedAt: serverTimestamp(),
  });
  if (existing.verifyToken) {
    batch.update(verificationDoc(existing.verifyToken), {
      ...buildVerification(merged),
      updatedAt: serverTimestamp(),
    });
  }
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.UPDATE_RECEIPT,
    userId: actor.uid,
    email: actor.email,
    targetId: receiptId,
    metadata: { fields: Object.keys(patch) },
  });

  await batch.commit();
  return { id: receiptId, ...merged };
};

/** Cancelling keeps the record but removes it from the dispatched totals. */
export const cancelReceipt = async (receipt, actor, reason = '') => {
  const database = requireDb();
  if (receipt.status === RECEIPT_STATUS.CANCELLED) return receipt;

  const batch = writeBatch(database);
  batch.update(receiptDoc(receipt.id || receipt.receiptId), {
    status: RECEIPT_STATUS.CANCELLED,
    cancelledAt: serverTimestamp(),
    cancelledBy: actor.uid,
    cancelledByEmail: String(actor.email || '').toLowerCase(),
    cancelReason: String(reason || '').trim(),
    updatedAt: serverTimestamp(),
  });
  if (receipt.verifyToken) {
    batch.update(verificationDoc(receipt.verifyToken), {
      status: RECEIPT_STATUS.CANCELLED,
      updatedAt: serverTimestamp(),
    });
  }
  queueReceiptCancelled(batch, {
    sandQuantity: receipt.sandQuantity,
    vehicleTrip: receipt.vehicleTrip,
    createdAt: toDate(receipt.createdAt) || new Date(),
  });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.CANCEL_RECEIPT,
    userId: actor.uid,
    email: actor.email,
    targetId: receipt.id || receipt.receiptId,
    metadata: { reason: String(reason || '').trim() },
  });

  await batch.commit();
  return { ...receipt, status: RECEIPT_STATUS.CANCELLED };
};

export const deleteReceipt = async (receipt, actor) => {
  const database = requireDb();
  const batch = writeBatch(database);

  batch.delete(receiptDoc(receipt.id || receipt.receiptId));
  if (receipt.verifyToken) batch.delete(verificationDoc(receipt.verifyToken));
  queueReceiptDeleted(batch, {
    sandQuantity: receipt.sandQuantity,
    vehicleTrip: receipt.vehicleTrip,
    status: receipt.status,
    createdAt: toDate(receipt.createdAt) || new Date(),
  });
  queueAuditLog(batch, doc(auditLogsCol()), {
    action: AUDIT_ACTIONS.DELETE_RECEIPT,
    userId: actor.uid,
    email: actor.email,
    targetId: receipt.id || receipt.receiptId,
    metadata: { orderId: receipt.orderId, receiptId: receipt.receiptId },
  });

  await batch.commit();
};

/** ------------------------------------------------------------------ read */

export const getReceiptById = async (receiptId) => snapToObject(await getDoc(receiptDoc(receiptId)));

/**
 * Compose the Firestore query for the History screen.
 *
 * Non-administrators are always pinned to `createdBy == uid`, which is also
 * what the security rules require for a `list` to be authorised.
 */
export const buildReceiptQuery = ({
  filters = {},
  viewer,
  pageSize = 25,
  cursor = null,
} = {}) => {
  const constraints = [];
  const isAdmin = viewer?.role === ROLES.ADMIN;
  const searchToken = normaliseSearchTerm(filters.search);

  if (!isAdmin) {
    constraints.push(where('createdBy', '==', viewer.uid));
  } else if (filters.createdByEmail) {
    constraints.push(where('createdByEmail', '==', String(filters.createdByEmail).toLowerCase()));
  }

  if (searchToken) {
    // A search term is the most selective filter available; the remaining
    // filters are applied in memory to keep the composite-index count sane.
    constraints.push(where('searchKeys', 'array-contains', searchToken));
  } else {
    if (filters.status) constraints.push(where('status', '==', filters.status));
    if (filters.vehicleTrip) constraints.push(where('vehicleTrip', '==', filters.vehicleTrip));
    if (filters.from) constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.from)));
    if (filters.to) constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.to)));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  // One extra document tells us whether a "Next" page exists.
  constraints.push(limit(pageSize + 1));

  return query(receiptsCol(), ...constraints);
};

/** In-memory pass for the filters that could not be pushed into the query. */
export const applyClientFilters = (rows, filters = {}, { searching = false } = {}) => {
  if (!searching) return rows;
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.vehicleTrip && row.vehicleTrip !== filters.vehicleTrip) return false;
    if (filters.createdByEmail && row.createdByEmail !== String(filters.createdByEmail).toLowerCase())
      return false;
    const created = toDate(row.createdAt);
    if (filters.from && created && created < filters.from) return false;
    if (filters.to && created && created > filters.to) return false;
    return true;
  });
};

/**
 * Live, paginated receipt feed. Returns the unsubscribe function so the
 * caller can tear the listener down on unmount.
 */
export const subscribeReceipts = (options, onChange, onError) => {
  const pageSize = options.pageSize ?? 25;
  const searching = Boolean(normaliseSearchTerm(options.filters?.search));

  return onSnapshot(
    buildReceiptQuery(options),
    (snapshot) => {
      const docs = snapshot.docs;
      const hasMore = docs.length > pageSize;
      const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
      onChange({
        rows: applyClientFilters(
          pageDocs.map((d) => ({ id: d.id, ...d.data() })),
          options.filters,
          { searching },
        ),
        lastDoc: pageDocs[pageDocs.length - 1] || null,
        firstDoc: pageDocs[0] || null,
        hasMore,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    (error) => {
      logError('subscribeReceipts', error);
      onError?.(error);
    },
  );
};

/** One-shot page fetch (used by exports where a listener is unnecessary). */
export const fetchReceiptsPage = async (options) => {
  const pageSize = options.pageSize ?? 25;
  const searching = Boolean(normaliseSearchTerm(options.filters?.search));
  const snapshot = await getDocs(buildReceiptQuery(options));
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  return {
    rows: applyClientFilters(
      pageDocs.map((d) => ({ id: d.id, ...d.data() })),
      options.filters,
      { searching },
    ),
    lastDoc: pageDocs[pageDocs.length - 1] || null,
    hasMore,
  };
};

/**
 * Pull every receipt inside a date range for the Reports screen.
 * Hard-capped so a mis-set range can never download the whole collection.
 */
export const fetchReceiptsInRange = async ({ from, to, viewer, max = 3000 }) => {
  const constraints = [];
  if (viewer?.role !== ROLES.ADMIN) constraints.push(where('createdBy', '==', viewer.uid));
  if (from) constraints.push(where('createdAt', '>=', Timestamp.fromDate(from)));
  if (to) constraints.push(where('createdAt', '<=', Timestamp.fromDate(to)));
  constraints.push(orderBy('createdAt', 'desc'), limit(max + 1));

  const snapshot = await getDocs(query(receiptsCol(), ...constraints));
  const rows = snapToArray(snapshot);
  return { rows: rows.slice(0, max), truncated: rows.length > max };
};

/** Small live feed used by the dashboard's "Latest Receipts" panel. */
export const subscribeLatestReceipts = (viewer, onChange, onError, take = 8) => {
  const constraints = [];
  if (viewer?.role !== ROLES.ADMIN) constraints.push(where('createdBy', '==', viewer.uid));
  constraints.push(orderBy('createdAt', 'desc'), limit(take));

  return onSnapshot(
    query(receiptsCol(), ...constraints),
    (snapshot) => onChange(snapToArray(snapshot)),
    (error) => {
      logError('subscribeLatestReceipts', error);
      onError?.(error);
    },
  );
};
