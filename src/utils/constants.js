/** Shared, immutable domain constants. */

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AP SAND';
export const APP_SUBTITLE = 'SAND MANAGEMENT SYSTEM';
export const DEFAULT_RECEIPT_PREFIX = import.meta.env.VITE_RECEIPT_PREFIX || 'APS';

/** Exact Vehicle Trip options required by the specification. */
export const VEHICLE_TRIPS = ['Trucktor', '8 Tier', '10 Tier', '12 Tier', '14 Tier', '16 Tier'];

/** Approximate carrying capacity in cubic metres, used for helper hints only. */
export const VEHICLE_TRIP_CAPACITY = {
  Trucktor: 2,
  '8 Tier': 8,
  '10 Tier': 10,
  '12 Tier': 12,
  '14 Tier': 14,
  '16 Tier': 16,
};

export const SAND_UNITS = ['Cubic Meter', 'Ton', 'Tractor Load', 'Cubic Feet'];
export const DEFAULT_SAND_UNIT = 'Cubic Meter';

export const PAPER_SIZES = [
  { value: 'TVS_MLP_3120', label: 'TVS MLP 3120 (3 inch)' },
  { value: 'THERMAL_76', label: '76 mm Thermal Roll' },
  { value: 'THERMAL_80', label: '80 mm Thermal Roll' },
  { value: 'A4', label: 'A4 Sheet' },
];
export const DEFAULT_PAPER_SIZE = 'TVS_MLP_3120';

/**
 * Public site the receipt QR code points at. Derived from the Firebase
 * project so a receipt printed from a dev machine still scans to the live app.
 */
export const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_URL ||
  (import.meta.env.VITE_FIREBASE_PROJECT_ID
    ? `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}.web.app`
    : window.location.origin)
).replace(/\/+$/, '');

export const ROLES = { ADMIN: 'ADMIN', USER: 'USER' };
export const ROLE_LABELS = { ADMIN: 'Administrator', USER: 'Operator' };
/** PENDING: signed in with Google, waiting for an administrator's approval. */
export const USER_STATUS = { ACTIVE: 'ACTIVE', DISABLED: 'DISABLED', PENDING: 'PENDING' };
export const USER_STATUS_LABELS = {
  ACTIVE: 'Active',
  DISABLED: 'Inactive',
  PENDING: 'Pending approval',
};
export const RECEIPT_STATUS = { ACTIVE: 'ACTIVE', CANCELLED: 'CANCELLED' };

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SIGNUP: 'SIGNUP',
  CREATE_RECEIPT: 'CREATE_RECEIPT',
  UPDATE_RECEIPT: 'UPDATE_RECEIPT',
  CANCEL_RECEIPT: 'CANCEL_RECEIPT',
  DELETE_RECEIPT: 'DELETE_RECEIPT',
  UPDATE_USER: 'UPDATE_USER',
  GRANT_ACCESS: 'GRANT_ACCESS',
  REVOKE_ACCESS: 'REVOKE_ACCESS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
};

/** Options for the "Dashboard Field" selector. */
export const DASHBOARD_FIELDS = [
  { value: 'ALL', label: 'All Fields' },
  { value: 'registeredEmails', label: 'Registered Email IDs' },
  { value: 'loginSessions', label: 'Total Login Sessions' },
  { value: 'uniqueUsers', label: 'Unique Logged-in Users' },
  { value: 'totalReceipts', label: 'Total Receipts' },
  { value: 'todayReceipts', label: "Today's Receipts" },
  { value: 'vehicleTrips', label: 'Total Vehicle Trips' },
  { value: 'todaySand', label: "Today's Sand Quantity" },
];

export const DATE_PRESETS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'LAST_7', label: 'Last 7 Days' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'CUSTOM', label: 'Custom Date Range' },
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
