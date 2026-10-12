/**
 * Aggregate counters.
 *
 * The dashboard has to update in real time for every operator, but reading
 * thousands of receipt documents just to show a number would be slow and
 * expensive. Instead every write bumps two tiny documents:
 *
 *   counters/global               all-time totals
 *   counters/daily_YYYY-MM-DD     one bucket per day
 *
 * The dashboard then keeps a single `onSnapshot` listener on each of those,
 * so a receipt created on one machine changes the totals on every other
 * machine within milliseconds while reading only two documents.
 */
import { increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { counterDoc, COUNTER_IDS } from '../firebase/firestore';
import { dateKey } from '../utils/dateUtils';
import { VEHICLE_TRIPS } from '../utils/constants';
import { logError } from '../utils/errors';

export const emptyVehicleTripMap = () =>
  VEHICLE_TRIPS.reduce((acc, trip) => ({ ...acc, [trip]: 0 }), {});

export const EMPTY_GLOBAL_COUNTERS = {
  totalReceipts: 0,
  activeReceipts: 0,
  cancelledReceipts: 0,
  totalSandQuantity: 0,
  totalVehicleTrips: 0,
  totalUsers: 0,
  activeUsers: 0,
  disabledUsers: 0,
  totalLoginSessions: 0,
  uniqueLoginUsers: 0,
  vehicleTrips: emptyVehicleTripMap(),
};

export const EMPTY_DAILY_COUNTERS = {
  date: dateKey(),
  receipts: 0,
  sandQuantity: 0,
  logins: 0,
  vehicleTrips: emptyVehicleTripMap(),
};

/** Merge a snapshot over the defaults so missing fields read as 0, not NaN. */
const withDefaults = (data, defaults) => ({
  ...defaults,
  ...(data || {}),
  vehicleTrips: { ...emptyVehicleTripMap(), ...(data?.vehicleTrips || {}) },
});

/** Live listener on `counters/global`. Returns the unsubscribe function. */
export const subscribeGlobalCounters = (onChange, onError) =>
  onSnapshot(
    counterDoc(COUNTER_IDS.GLOBAL),
    (snapshot) => onChange(withDefaults(snapshot.data(), EMPTY_GLOBAL_COUNTERS)),
    (error) => {
      logError('subscribeGlobalCounters', error);
      onError?.(error);
    },
  );

/** Live listener on today's bucket (or any other day). */
export const subscribeDailyCounters = (onChange, onError, day = new Date()) =>
  onSnapshot(
    counterDoc(COUNTER_IDS.daily(dateKey(day))),
    (snapshot) =>
      onChange(withDefaults(snapshot.data(), { ...EMPTY_DAILY_COUNTERS, date: dateKey(day) })),
    (error) => {
      logError('subscribeDailyCounters', error);
      onError?.(error);
    },
  );

/** ------------------------------------------------------------- mutations */

/**
 * Queue the counter updates for a newly created receipt onto an existing
 * `writeBatch`, so the receipt and its counters land atomically.
 */
export const queueReceiptCreated = (batch, { sandQuantity, vehicleTrip, createdAt = new Date() }) => {
  const qty = Number(sandQuantity) || 0;
  const key = dateKey(createdAt);

  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalReceipts: increment(1),
      activeReceipts: increment(1),
      totalSandQuantity: increment(qty),
      totalVehicleTrips: increment(1),
      vehicleTrips: { [vehicleTrip]: increment(1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    counterDoc(COUNTER_IDS.daily(key)),
    {
      date: key,
      receipts: increment(1),
      sandQuantity: increment(qty),
      vehicleTrips: { [vehicleTrip]: increment(1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

/**
 * Cancelling keeps the receipt (it stays auditable) but removes it from the
 * active totals so the dashboard reflects real dispatched volume.
 */
export const queueReceiptCancelled = (batch, { sandQuantity, vehicleTrip, createdAt }) => {
  const qty = Number(sandQuantity) || 0;
  const key = dateKey(createdAt || new Date());

  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      activeReceipts: increment(-1),
      cancelledReceipts: increment(1),
      totalSandQuantity: increment(-qty),
      totalVehicleTrips: increment(-1),
      vehicleTrips: { [vehicleTrip]: increment(-1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    counterDoc(COUNTER_IDS.daily(key)),
    {
      date: key,
      sandQuantity: increment(-qty),
      vehicleTrips: { [vehicleTrip]: increment(-1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

/** A hard delete removes the receipt from every total, including the all-time one. */
export const queueReceiptDeleted = (batch, receipt) => {
  const qty = Number(receipt.sandQuantity) || 0;
  const key = dateKey(receipt.createdAt || new Date());
  const wasActive = receipt.status !== 'CANCELLED';

  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalReceipts: increment(-1),
      activeReceipts: increment(wasActive ? -1 : 0),
      cancelledReceipts: increment(wasActive ? 0 : -1),
      totalSandQuantity: increment(wasActive ? -qty : 0),
      totalVehicleTrips: increment(wasActive ? -1 : 0),
      vehicleTrips: { [receipt.vehicleTrip]: increment(wasActive ? -1 : 0) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    counterDoc(COUNTER_IDS.daily(key)),
    {
      date: key,
      receipts: increment(-1),
      sandQuantity: increment(wasActive ? -qty : 0),
      vehicleTrips: { [receipt.vehicleTrip]: increment(wasActive ? -1 : 0) },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const queueUserRegistered = (batch) => {
  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalUsers: increment(1),
      activeUsers: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

/**
 * An account waiting for approval (PENDING) is not a user yet: it joins
 * `totalUsers` the moment an administrator decides on it.
 */
const isCountedUser = (status) => status === 'ACTIVE' || status === 'DISABLED';
const flag = (condition) => (condition ? 1 : 0);

export const queueUserStatusChanged = (batch, { from, to }) => {
  if (from === to) return;
  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalUsers: increment(flag(isCountedUser(to)) - flag(isCountedUser(from))),
      activeUsers: increment(flag(to === 'ACTIVE') - flag(from === 'ACTIVE')),
      disabledUsers: increment(flag(to === 'DISABLED') - flag(from === 'DISABLED')),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const queueUserDeleted = (batch, { status }) => {
  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalUsers: increment(-flag(isCountedUser(status))),
      activeUsers: increment(status === 'ACTIVE' ? -1 : 0),
      disabledUsers: increment(status === 'DISABLED' ? -1 : 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

/**
 * @param {boolean} isFirstLogin  Bumps `uniqueLoginUsers` only the first time
 *                                a given account ever signs in.
 */
export const queueLoginRecorded = (batch, { isFirstLogin, at = new Date() }) => {
  const key = dateKey(at);

  batch.set(
    counterDoc(COUNTER_IDS.GLOBAL),
    {
      totalLoginSessions: increment(1),
      uniqueLoginUsers: increment(isFirstLogin ? 1 : 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    counterDoc(COUNTER_IDS.daily(key)),
    { date: key, logins: increment(1), updatedAt: serverTimestamp() },
    { merge: true },
  );
};

/**
 * Best-effort standalone counter write (used where there is no batch to join).
 * Counter drift is never fatal - Reports recomputes from the receipts
 * collection - so failures are logged rather than surfaced.
 */
export const bumpCounter = async (counterId, payload) => {
  try {
    await setDoc(
      counterDoc(counterId),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    logError('bumpCounter', error);
  }
};
