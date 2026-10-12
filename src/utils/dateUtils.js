/**
 * Date / time helpers.
 *
 * Firestore returns `Timestamp` objects, the forms produce `YYYY-MM-DD` and
 * `HH:mm` strings, and the receipts must be printed as `DD-MM-YYYY HH:mm:ss`.
 * Everything funnels through `toDate()` so the rest of the app never has to
 * care which of those three shapes it is holding.
 */

const pad = (value, length = 2) => String(value).padStart(length, '0');

/** Normalise Firestore Timestamp | Date | number | ISO string -> Date | null. */
export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

/** `DD-MM-YYYY` */
export const formatDate = (value, fallback = '-') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** `HH:mm:ss` */
export const formatTime = (value, fallback = '-') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** `DD-MM-YYYY HH:mm:ss` - the canonical display format for this system. */
export const formatDateTime = (value, fallback = '-') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${formatTime(d)}`;
};

/** `DD-MM-YYYY HH:mm` */
export const formatDateTimeShort = (value, fallback = '-') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** `YYYY-MM-DD` - the value shape used by `<input type="date">`. */
export const toInputDate = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** `HH:mm` - the value shape used by `<input type="time">`. */
export const toInputTime = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** The `YYYY-MM-DD` bucket key used by the daily counter documents. */
export const dateKey = (value = new Date()) => toInputDate(value);

/** Merge a `YYYY-MM-DD` and a `HH:mm` field pair back into a Date. */
export const combineDateAndTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh = 0, mm = 0] = (timeStr || '00:00').split(':').map(Number);
  const result = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
};

export const startOfDay = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export const endOfDay = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

export const addDays = (value, days) => {
  const d = toDate(value) || new Date();
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfMonth = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

export const endOfMonth = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

/**
 * Resolve one of the report presets into a concrete `{ from, to, label }`
 * range. `custom` supplies the two `YYYY-MM-DD` strings for `CUSTOM`.
 */
export const resolveDateRange = (preset, custom = {}) => {
  const now = new Date();
  switch (preset) {
    case 'TODAY':
      return { from: startOfDay(now), to: endOfDay(now), label: 'Today' };
    case 'YESTERDAY': {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y), label: 'Yesterday' };
    }
    case 'LAST_7':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now), label: 'Last 7 Days' };
    case 'THIS_MONTH':
      return { from: startOfMonth(now), to: endOfDay(now), label: 'This Month' };
    case 'LAST_MONTH': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
        label: 'Last Month',
      };
    }
    case 'CUSTOM': {
      const from = custom.from ? startOfDay(new Date(`${custom.from}T00:00:00`)) : null;
      const to = custom.to ? endOfDay(new Date(`${custom.to}T00:00:00`)) : null;
      return { from, to, label: 'Custom Range' };
    }
    case 'ALL':
    default:
      return { from: null, to: null, label: 'All Time' };
  }
};

/** "3 minutes ago" style label used in activity lists. */
export const relativeTime = (value) => {
  const d = toDate(value);
  if (!d) return '-';
  const diff = Date.now() - d.getTime();
  const seconds = Math.round(diff / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(d);
};

export const isToday = (value) => {
  const d = toDate(value);
  if (!d) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

/** File-name friendly stamp, e.g. `20260815-142233`. */
export const fileStamp = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
};

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
