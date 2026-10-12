import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Download, Eye, FilePlus2, FileText, RotateCcw, ScanLine } from 'lucide-react';
import DataTable, { TableFooter } from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../hooks/useAuth';
import { EMPTY_FILTERS, useReceipts } from '../hooks/useReceipts';
import {
  DATE_PRESETS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  RECEIPT_STATUS,
  VEHICLE_TRIPS,
} from '../utils/constants';
import { fileStamp, formatDate, formatDateTime, formatTime, resolveDateRange } from '../utils/dateUtils';
import { downloadCsv, formatQuantity, maskMobile } from '../utils/format';

export const StatusBadge = ({ status }) =>
  status === RECEIPT_STATUS.CANCELLED ? (
    <span className="badge badge--cancelled">Cancelled</span>
  ) : (
    <span className="badge badge--active">Active</span>
  );

const CSV_COLUMNS = [
  { label: 'Receipt ID', value: (r) => r.receiptId },
  { label: 'Dispatch ID', value: (r) => r.dispatchId },
  { label: 'Order ID', value: (r) => r.orderId },
  { label: 'Trip No', value: (r) => r.tripNo },
  { label: 'Status', value: (r) => r.status },
  { label: 'Customer Name', value: (r) => r.customerName },
  { label: 'Customer Mobile', value: (r) => r.customerMobile },
  { label: 'Driver Name', value: (r) => r.driverName },
  { label: 'Driver Mobile', value: (r) => r.driverMobile },
  { label: 'Vehicle No', value: (r) => r.vehicleNo },
  { label: 'Vehicle Trip', value: (r) => r.vehicleTrip },
  { label: 'Sand Quantity', value: (r) => r.sandQuantity },
  { label: 'Sand Unit', value: (r) => r.sandUnit },
  { label: 'Supply Point', value: (r) => r.supplyPoint },
  { label: 'Dispatch Date', value: (r) => formatDateTime(r.dispatchAt) },
  { label: 'Created At', value: (r) => formatDateTime(r.createdAt) },
  { label: 'Created By', value: (r) => r.createdByEmail },
];

/** Receipt History: search, filter, reprint and export past receipts. */
const ReceiptHistory = () => {
  const { actor, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Vehicles and Customers open this page already searching for one of theirs.
  const [search, setSearch] = useState(() => location.state?.search || '');
  const [status, setStatus] = useState('');
  const [vehicleTrip, setVehicleTrip] = useState('');
  const [preset, setPreset] = useState('ALL');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filters = useMemo(() => {
    const range = resolveDateRange(preset, custom);
    return { ...EMPTY_FILTERS, search, status, vehicleTrip, from: range.from, to: range.to };
  }, [search, status, vehicleTrip, preset, custom]);

  const { rows, loading, error, hasMore, pageIndex, nextPage, prevPage, canGoPrev } = useReceipts({
    viewer: actor,
    pageSize,
    filters,
  });

  const filtered = Boolean(search || status || vehicleTrip || preset !== 'ALL');

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setVehicleTrip('');
    setPreset('ALL');
    setCustom({ from: '', to: '' });
  };

  const open = (row) => navigate(`/receipts/${encodeURIComponent(row.id)}`);

  const columns = [
    {
      key: 'receipt',
      label: 'Receipt',
      render: (row) => (
        <div className="cell-stack">
          <Link to={`/receipts/${encodeURIComponent(row.id)}`} className="cell-stack__main font-mono text-[0.92em]">
            {row.receiptId}
          </Link>
          <span className="cell-stack__sub">
            {formatDate(row.createdAt)} &middot; {formatTime(row.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-stack__main">{row.customerName}</span>
          <span className="cell-stack__sub">{maskMobile(row.customerMobile)}</span>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-stack__main">{row.vehicleNo}</span>
          <span className="cell-stack__sub">{row.vehicleTrip}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      className: 'whitespace-nowrap',
      render: (row) => `${formatQuantity(row.sandQuantity)} ${row.sandUnit || ''}`,
    },
    {
      key: 'dispatch',
      label: 'Dispatch ID',
      render: (row) => <span className="font-mono text-[0.92em]">{row.dispatchId || '-'}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: 'operator',
            label: 'Created By',
            render: (row) => <span className="wrap-anywhere">{row.createdByEmail}</span>,
          },
        ]
      : []),
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: '',
      className: 'cell-actions text-right',
      hideOnCard: true,
      render: (row) => (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => open(row)}>
          <Eye size={14} />
          View / Print
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Receipts</p>
          <h1 className="page-title">Receipt History</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Every receipt generated by every operator. Open one to reprint, cancel or delete it.'
              : 'Receipts you have generated. Open one to view or reprint it.'}
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/scan" className="btn btn--outline">
            <ScanLine size={16} />
            Scan QR
          </Link>
          <Link to="/receipts/new" className="btn btn--primary">
            <FilePlus2 size={16} />
            New Receipt
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Receipt no, dispatch ID, vehicle, customer, mobile…"
          ariaLabel="Search receipts"
        />
        <label className="filter-select">
          <span className="sr-only">Status</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value={RECEIPT_STATUS.ACTIVE}>Active</option>
            <option value={RECEIPT_STATUS.CANCELLED}>Cancelled</option>
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Vehicle trip</span>
          <select
            className="select"
            value={vehicleTrip}
            onChange={(e) => setVehicleTrip(e.target.value)}
          >
            <option value="">All vehicle trips</option>
            {VEHICLE_TRIPS.map((trip) => (
              <option key={trip} value={trip}>
                {trip}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Date range</span>
          <select className="select" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="ALL">All dates</option>
            {DATE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {preset === 'CUSTOM' && (
          <div className="range-inputs">
            <input
              type="date"
              className="input"
              aria-label="From date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              className="input"
              aria-label="To date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}
        <span className="toolbar__spacer" />
        {filtered && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
            <RotateCcw size={14} />
            Clear
          </button>
        )}
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={!rows.length}
          onClick={() => downloadCsv(`AP-SAND-receipts-${fileStamp()}.csv`, CSV_COLUMNS, rows)}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="alert alert--error my-3" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyIcon={FileText}
        emptyTitle={filtered ? 'No receipts match these filters' : 'No receipts yet'}
        emptyMessage={
          filtered
            ? 'Try a different search term or clear the filters.'
            : 'Receipts appear here as soon as they are generated.'
        }
        cardTitle={(row) => row.receiptId}
        cardBadge={(row) => <StatusBadge status={row.status} />}
        cardActions={(row) => (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => open(row)}>
            <Eye size={14} />
            View / Print
          </button>
        )}
        minWidth={isAdmin ? 1040 : 900}
      />

      <TableFooter
        pageIndex={pageIndex}
        pageSize={pageSize}
        count={rows.length}
        hasMore={hasMore}
        canGoPrev={canGoPrev}
        onPrev={prevPage}
        onNext={nextPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
        loading={loading}
      />
    </>
  );
};

export default ReceiptHistory;
