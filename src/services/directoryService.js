/**
 * Vehicle and customer directories.
 *
 * There is no separate master list of vehicles or customers: both are read
 * off the receipts themselves, so a vehicle or a consumer appears here the
 * moment its first receipt is saved. Cancelled receipts stay out of the
 * totals, exactly as they do in Reports.
 */
import { fetchReceiptsInRange } from './receiptService';
import { RECEIPT_STATUS } from '../utils/constants';
import { toDate } from '../utils/dateUtils';
import { digitsOnly } from '../utils/validation';

const vehicleKey = (vehicleNo) => String(vehicleNo || '').toUpperCase().replace(/[\s-]+/g, '');

/** A consumer is identified by mobile number; the name is the fallback. */
const customerKey = (row) =>
  digitsOnly(row.customerMobile) || String(row.customerName || '').trim().toLowerCase();

/**
 * @returns {Promise<{ vehicles: object[], customers: object[], receipts: number,
 *                     quantity: number, truncated: boolean }>}
 */
export const buildDirectory = async ({ from = null, to = null, viewer }) => {
  const { rows, truncated } = await fetchReceiptsInRange({ from, to, viewer });

  const vehicles = new Map();
  const customers = new Map();
  let receipts = 0;
  let quantity = 0;

  // Rows arrive newest first, so the first receipt seen for a vehicle or a
  // customer carries its most recent details.
  rows.forEach((row) => {
    if (row.status === RECEIPT_STATUS.CANCELLED) return;

    const qty = Number(row.sandQuantity) || 0;
    const at = toDate(row.dispatchAt) || toDate(row.createdAt);
    const vKey = vehicleKey(row.vehicleNo);
    const cKey = customerKey(row);
    receipts += 1;
    quantity += qty;

    if (vKey) {
      const vehicle = vehicles.get(vKey) || {
        key: vKey,
        vehicleNo: row.vehicleNo,
        vehicleTrip: row.vehicleTrip,
        driverName: row.driverName,
        driverMobile: row.driverMobile,
        supplyPoint: row.supplyPoint,
        lastAt: at,
        trips: 0,
        quantity: 0,
        customerKeys: new Set(),
      };
      vehicle.trips += 1;
      vehicle.quantity += qty;
      if (cKey) vehicle.customerKeys.add(cKey);
      vehicles.set(vKey, vehicle);
    }

    if (cKey) {
      const customer = customers.get(cKey) || {
        key: cKey,
        customerName: row.customerName,
        customerMobile: row.customerMobile,
        supplyPoint: row.supplyPoint,
        lastVehicleNo: row.vehicleNo,
        lastAt: at,
        receipts: 0,
        quantity: 0,
        vehicleKeys: new Set(),
      };
      customer.receipts += 1;
      customer.quantity += qty;
      if (vKey) customer.vehicleKeys.add(vKey);
      customers.set(cKey, customer);
    }
  });

  return {
    vehicles: Array.from(vehicles.values()).map(({ customerKeys, ...vehicle }) => ({
      ...vehicle,
      customers: customerKeys.size,
    })),
    customers: Array.from(customers.values()).map(({ vehicleKeys, ...customer }) => ({
      ...customer,
      vehicles: vehicleKeys.size,
    })),
    receipts,
    quantity,
    truncated,
  };
};
