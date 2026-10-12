import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FilePlus2, FileText, RotateCcw, Truck } from 'lucide-react';
import DataTable, { TableFooter } from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../hooks/useAuth';
import { useDirectory, usePaged } from '../hooks/useDirectory';
import { DATE_PRESETS, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, VEHICLE_TRIPS } from '../utils/constants';
import { fileStamp, formatDateTime, relativeTime } from '../utils/dateUtils';
import { downloadCsv, formatNumber, formatQuantity, maskMobile } from '../utils/format';

/** Presets that make sense without a custom range picker. */
const PRESETS = DATE_PRESETS.filter((option) => option.value !== 'CUSTOM');

const SORTS = {
  trips: { label: 'Most trips', compare: (a, b) => b.trips - a.trips },
  quantity: { label: 'Most sand', compare: (a, b) => b.quantity - a.quantity },
  recent: { label: 'Latest dispatch', compare: (a, b) => (b.lastAt || 0) - (a.lastAt || 0) },
  name: { label: 'Vehicle number', compare: (a, b) => a.key.localeCompare(b.key) },
};

const CSV_COLUMNS = [
  { label: 'Vehicle No', value: (v) => v.vehicleNo },
  { label: 'Vehicle Trip', value: (v) => v.vehicleTrip },
  { label: 'Driver Name', value: (v) => v.driverName },
  { label: 'Driver Mobile', value: (v) => v.driverMobile },
  { label: 'Trips', value: (v) => v.trips },
  { label: 'Sand Quantity', value: (v) => v.quantity },
  { label: 'Customers', value: (v) => v.customers },
  { label: 'Last Supply Point', value: (v) => v.supplyPoint },
  { label: 'Last Dispatch', value: (v) => formatDateTime(v.lastAt) },
];

/**
 * Vehicles: every vehicle that has carried sand, with its trips and volume.
 * Read off the receipts - nothing is entered here. Administrators see every
 * vehicle; an operator sees the vehicles on their own receipts.
 */
const Vehicles = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('ALL');
  const [search, setSearch] = useState('');
  const [tripType, setTripType] = useState('');
  const [sort, setSort] = useState('trips');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { vehicles, receipts, quantity, truncated, loading, error, range } = useDirectory(preset);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles
      .filter((vehicle) => {
        if (tripType && vehicle.vehicleTrip !== tripType) return false;
        if (!term) return true;
        return [vehicle.vehicleNo, vehicle.driverName, vehicle.driverMobile, vehicle.supplyPoint].some(
          (value) => String(value || '').toLowerCase().includes(term),
        );
      })
      .sort(SORTS[sort].compare);
  }, [vehicles, search, tripType, sort]);

  const { pageRows, pageIndex, hasMore, canGoPrev, nextPage, prevPage } = usePaged(rows, pageSize);

  const filtered = Boolean(search || tripType || preset !== 'ALL');
  const clearFilters = () => {
    setSearch('');
    setTripType('');
    setPreset('ALL');
  };

  const openReceipts = (vehicle) => navigate('/receipts', { state: { search: vehicle.vehicleNo } });

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (vehicle) => (
        <div className="flex min-w-[170px] items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            <Truck size={17} />
          </span>
          <div className="cell-stack">
            <span className="cell-stack__main font-mono text-[0.95em] tracking-wide">
              {vehicle.vehicleNo}
            </span>
            <span className="cell-stack__sub">{vehicle.vehicleTrip || '-'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'driver',
      label: 'Last Driver',
      render: (vehicle) => (
        <div className="cell-stack">
          <span className="cell-stack__main">{vehicle.driverName || '-'}</span>
          <span className="cell-stack__sub">{maskMobile(vehicle.driverMobile)}</span>
        </div>
      ),
    },
    {
      key: 'trips',
      label: 'Trips',
      className: 'text-right',
      render: (vehicle) => <strong>{formatNumber(vehicle.trips)}</strong>,
    },
    {
      key: 'quantity',
      label: 'Sand Qty',
      className: 'text-right',
      render: (vehicle) => formatQuantity(vehicle.quantity),
    },
    {
      key: 'customers',
      label: 'Customers',
      className: 'text-right',
      render: (vehicle) => formatNumber(vehicle.customers),
    },
    {
      key: 'last',
      label: 'Last Dispatch',
      render: (vehicle) => (
        <div className="cell-stack">
          <span className="cell-stack__main whitespace-nowrap">
            {vehicle.lastAt ? relativeTime(vehicle.lastAt) : '-'}
          </span>
          <span className="cell-stack__sub">
            {vehicle.lastAt ? formatDateTime(vehicle.lastAt) : ''}
            {vehicle.supplyPoint ? ` · ${vehicle.supplyPoint}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'cell-actions text-right',
      hideOnCard: true,
      render: (vehicle) => (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => openReceipts(vehicle)}>
          <FileText size={14} />
          Receipts
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Directory</p>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Every vehicle that has carried sand, with its trips and volume.'
              : 'The vehicles on the receipts you have generated.'}{' '}
            The list builds itself from the receipts; cancelled receipts are not counted.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={!rows.length}
            onClick={() => downloadCsv(`AP-SAND-vehicles-${fileStamp()}.csv`, CSV_COLUMNS, rows)}
          >
            <Download size={16} />
            Export CSV
          </button>
          <Link to="/receipts/new" className="btn btn--primary">
            <FilePlus2 size={16} />
            New Receipt
          </Link>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <p className="kpi__label">Vehicles ({range.label})</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(vehicles.length)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Trips</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(receipts)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Sand Dispatched</p>
          <p className="kpi__value">{loading ? '…' : formatQuantity(quantity)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Avg Trips per Vehicle</p>
          <p className="kpi__value">
            {loading ? '…' : formatNumber(vehicles.length ? receipts / vehicles.length : 0, 1)}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Vehicle no, driver, mobile, supply point…"
          ariaLabel="Search vehicles"
          delay={150}
        />
        <label className="filter-select">
          <span className="sr-only">Vehicle trip</span>
          <select className="select" value={tripType} onChange={(e) => setTripType(e.target.value)}>
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
            {PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Sort by</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar__spacer" />
        {filtered && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
            <RotateCcw size={14} />
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert--error my-3" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      )}

      {truncated && (
        <div className="alert alert--warning my-3">
          <div className="alert__body">
            Counted from the latest 3,000 receipts. Choose a shorter date range for exact totals.
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={pageRows}
        loading={loading}
        rowKey={(vehicle) => vehicle.key}
        emptyIcon={Truck}
        emptyTitle={filtered ? 'No vehicles match these filters' : 'No vehicles yet'}
        emptyMessage={
          filtered
            ? 'Try a different search term or clear the filters.'
            : 'A vehicle appears here as soon as a receipt is generated for it.'
        }
        cardTitle={(vehicle) => vehicle.vehicleNo}
        cardBadge={(vehicle) => <span className="badge badge--neutral">{vehicle.vehicleTrip}</span>}
        cardActions={(vehicle) => (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => openReceipts(vehicle)}>
            <FileText size={14} />
            Receipts
          </button>
        )}
        minWidth={900}
      />

      <TableFooter
        pageIndex={pageIndex}
        pageSize={pageSize}
        count={pageRows.length}
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

export default Vehicles;
