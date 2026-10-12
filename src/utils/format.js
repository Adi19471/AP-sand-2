/** Presentation helpers for numbers, text and CSV export. */

export const formatNumber = (value, fractionDigits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/** Sand quantities print with up to two decimals but drop trailing zeros. */
export const formatQuantity = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export const formatPercent = (part, total, fractionDigits = 1) => {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return '0.0%';
  return `${((p / t) * 100).toFixed(fractionDigits)}%`;
};

export const percentValue = (part, total) => {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return (p / t) * 100;
};

export const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name, email) => {
  const source = String(name || '').trim() || String(email || '').split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const maskMobile = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length !== 10) return mobile || '-';
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

/** Build and trigger a CSV download from an array of row objects. */
export const downloadCsv = (filename, columns, rows) => {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(','))
    .join('\n');

  // BOM keeps Excel happy with UTF-8 accented characters.
  const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
