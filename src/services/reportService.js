/**
 * Reporting aggregation.
 *
 * Reports run over a bounded date range (never the whole collection) and the
 * roll-up happens in memory, which keeps read counts predictable while still
 * giving exact numbers rather than approximations.
 */
import { RECEIPT_STATUS, VEHICLE_TRIPS } from '../utils/constants';
import { MONTH_LABELS, dateKey, toDate } from '../utils/dateUtils';
import { fetchReceiptsInRange } from './receiptService';

const zeroTripMap = () => VEHICLE_TRIPS.reduce((acc, t) => ({ ...acc, [t]: 0 }), {});

/**
 * @param {object} params
 * @param {Date|null} params.from
 * @param {Date|null} params.to
 * @param {object} params.viewer  `{ uid, role }`
 */
export const buildReceiptReport = async ({ from, to, viewer }) => {
  const { rows, truncated } = await fetchReceiptsInRange({ from, to, viewer });

  const summary = {
    totalReceipts: rows.length,
    activeReceipts: 0,
    cancelledReceipts: 0,
    totalSandQuantity: 0,
    totalVehicleTrips: 0,
    uniqueVehicles: 0,
    uniqueCustomers: 0,
    uniqueOperators: 0,
    averageQuantity: 0,
    vehicleTrips: zeroTripMap(),
    byDay: new Map(),
    byMonth: new Map(),
    byOperator: new Map(),
    bySupplyPoint: new Map(),
    truncated,
    rows,
  };

  const vehicles = new Set();
  const customers = new Set();
  const operators = new Set();
  const todayKey = dateKey(new Date());

  rows.forEach((row) => {
    const cancelled = row.status === RECEIPT_STATUS.CANCELLED;
    if (cancelled) summary.cancelledReceipts += 1;
    else summary.activeReceipts += 1;

    if (row.vehicleNo) vehicles.add(row.vehicleNo);
    if (row.customerMobile) customers.add(row.customerMobile);
    if (row.createdByEmail) operators.add(row.createdByEmail);

    // Cancelled dispatches are excluded from volume and trip counts so the
    // report reflects sand that actually moved.
    if (cancelled) return;

    const qty = Number(row.sandQuantity) || 0;
    summary.totalSandQuantity += qty;
    summary.totalVehicleTrips += 1;

    if (row.vehicleTrip && summary.vehicleTrips[row.vehicleTrip] !== undefined) {
      summary.vehicleTrips[row.vehicleTrip] += 1;
    }

    const created = toDate(row.createdAt);
    if (created) {
      const dKey = dateKey(created);
      const day = summary.byDay.get(dKey) || { key: dKey, receipts: 0, quantity: 0 };
      day.receipts += 1;
      day.quantity += qty;
      summary.byDay.set(dKey, day);

      const mKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      const month = summary.byMonth.get(mKey) || {
        key: mKey,
        label: `${MONTH_LABELS[created.getMonth()]} ${created.getFullYear()}`,
        receipts: 0,
        quantity: 0,
      };
      month.receipts += 1;
      month.quantity += qty;
      summary.byMonth.set(mKey, month);
    }

    const opKey = row.createdByEmail || 'unknown';
    const op = summary.byOperator.get(opKey) || { key: opKey, receipts: 0, today: 0, quantity: 0 };
    op.receipts += 1;
    if (created && dateKey(created) === todayKey) op.today += 1;
    op.quantity += qty;
    summary.byOperator.set(opKey, op);

    const spKey = row.supplyPoint || 'Not specified';
    const sp = summary.bySupplyPoint.get(spKey) || { key: spKey, receipts: 0, quantity: 0 };
    sp.receipts += 1;
    sp.quantity += qty;
    summary.bySupplyPoint.set(spKey, sp);
  });

  summary.uniqueVehicles = vehicles.size;
  summary.uniqueCustomers = customers.size;
  summary.uniqueOperators = operators.size;
  summary.averageQuantity = summary.totalVehicleTrips
    ? summary.totalSandQuantity / summary.totalVehicleTrips
    : 0;

  return {
    ...summary,
    byDay: Array.from(summary.byDay.values()).sort((a, b) => a.key.localeCompare(b.key)),
    byMonth: Array.from(summary.byMonth.values()).sort((a, b) => a.key.localeCompare(b.key)),
    byOperator: Array.from(summary.byOperator.values()).sort((a, b) => b.receipts - a.receipts),
    bySupplyPoint: Array.from(summary.bySupplyPoint.values()).sort((a, b) => b.receipts - a.receipts),
    vehicleTripRows: VEHICLE_TRIPS.map((trip) => ({
      trip,
      count: summary.vehicleTrips[trip] || 0,
    })),
  };
};

/** Roll login sessions up per day / per user for the activity report. */
export const summariseLoginSessions = (sessions = []) => {
  const byDay = new Map();
  const byUser = new Map();
  const byDevice = new Map();

  sessions.forEach((session) => {
    const at = toDate(session.loginAt);
    if (at) {
      const key = dateKey(at);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    const email = session.email || 'unknown';
    byUser.set(email, (byUser.get(email) || 0) + 1);
    const device = session.device || 'Unknown';
    byDevice.set(device, (byDevice.get(device) || 0) + 1);
  });

  return {
    total: sessions.length,
    uniqueUsers: byUser.size,
    byDay: Array.from(byDay.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    byUser: Array.from(byUser.entries())
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count),
    byDevice: Array.from(byDevice.entries())
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count),
  };
};
