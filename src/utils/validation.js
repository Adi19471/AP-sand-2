/**
 * Form validation. Pure functions - no React, no Firebase - so the same rules
 * can be reused by the forms, the services and (mirrored) the Firestore rules.
 */
import { VEHICLE_TRIPS } from './constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
/** Indian mobile numbers: exactly 10 digits, first digit 6-9. */
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
/** Reasonably permissive Indian vehicle registration, e.g. AP16TA1234. */
const VEHICLE_NO_RE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;

export const isBlank = (value) =>
  value === null || value === undefined || String(value).trim().length === 0;

export const isEmail = (value) => EMAIL_RE.test(String(value || '').trim());

export const isIndianMobile = (value) => INDIAN_MOBILE_RE.test(digitsOnly(value));

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

export const isPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

export const normaliseVehicleNo = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** ------------------------------------------------------------------ auth */

/** The form an administrator fills in to approve a Google account. */
export const validateAccessGrant = ({ email, name }) => {
  const errors = {};
  if (isBlank(email)) errors.email = 'Google account email is required.';
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.';
  if (!isBlank(name) && String(name).trim().length > 120) errors.name = 'Keep the name under 120 characters.';
  return errors;
};

export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  const errors = {};
  if (isBlank(currentPassword)) errors.currentPassword = 'Current password is required.';
  if (isBlank(newPassword)) errors.newPassword = 'New password is required.';
  else if (String(newPassword).length < 6)
    errors.newPassword = 'New password must be at least 6 characters.';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};

/** --------------------------------------------------------------- receipt */

export const validateReceipt = (form) => {
  const errors = {};

  if (isBlank(form.orderId)) errors.orderId = 'Order ID is required.';

  if (isBlank(form.customerName)) errors.customerName = 'Customer name is required.';

  if (isBlank(form.customerMobile)) errors.customerMobile = 'Customer mobile no is required.';
  else if (!isIndianMobile(form.customerMobile))
    errors.customerMobile = 'Enter a valid 10-digit mobile number.';

  if (isBlank(form.sandQuantity)) errors.sandQuantity = 'Sand quantity is required.';
  else if (!isPositiveNumber(form.sandQuantity))
    errors.sandQuantity = 'Sand quantity must be greater than 0.';

  if (isBlank(form.sandUnit)) errors.sandUnit = 'Sand unit is required.';

  if (isBlank(form.driverName)) errors.driverName = 'Driver name is required.';

  if (isBlank(form.driverMobile)) errors.driverMobile = 'Driver mobile no is required.';
  else if (!isIndianMobile(form.driverMobile))
    errors.driverMobile = 'Enter a valid 10-digit mobile number.';

  if (isBlank(form.vehicleNo)) errors.vehicleNo = 'Vehicle no is required.';
  else if (normaliseVehicleNo(form.vehicleNo).length < 4)
    errors.vehicleNo = 'Enter a valid vehicle registration number.';

  if (isBlank(form.vehicleTrip)) errors.vehicleTrip = 'Vehicle trip is required.';
  else if (!VEHICLE_TRIPS.includes(form.vehicleTrip))
    errors.vehicleTrip = 'Select a valid vehicle trip type.';

  if (isBlank(form.dispatchDate)) errors.dispatchDate = 'Dispatch date is required.';
  if (isBlank(form.dispatchTime)) errors.dispatchTime = 'Dispatch time is required.';

  if (!isBlank(form.availableSand) && Number(form.availableSand) < 0)
    errors.availableSand = 'Available sand cannot be negative.';

  if (!isBlank(form.registrationQuantity) && Number(form.registrationQuantity) < 0)
    errors.registrationQuantity = 'Registration quantity cannot be negative.';

  if (!isBlank(form.eligibleQuantity) && Number(form.eligibleQuantity) < 0)
    errors.eligibleQuantity = 'Eligible quantity cannot be negative.';

  if (!isBlank(form.tripNo) && !/^\d{1,6}$/.test(String(form.tripNo).trim()))
    errors.tripNo = 'Trip no must be a number.';

  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

export const firstError = (errors) => {
  const keys = Object.keys(errors || {});
  return keys.length ? errors[keys[0]] : '';
};
