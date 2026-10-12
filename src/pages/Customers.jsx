import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Contact, Download, FilePlus2, FileText, RotateCcw } from 'lucide-react';
import DataTable, { TableFooter } from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../hooks/useAuth';
import { useDirectory, usePaged } from '../hooks/useDirectory';
import { DATE_PRESETS, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../utils/constants';
import { fileStamp, formatDateTime, relativeTime } from '../utils/dateUtils';
import { downloadCsv, formatNumber, formatQuantity, initials, maskMobile } from '../utils/format';

/** Presets that make sense without a custom range picker. */
const PRESETS = DATE_PRESETS.filter((option) => option.value !== 'CUSTOM');

const SORTS = {
  receipts: { label: 'Most receipts', compare: (a, b) => b.receipts - a.receipts },
  quantity: { label: 'Most sand', compare: (a, b) => b.quantity - a.quantity },
  recent: { label: 'Latest dispatch', compare: (a, b) => (b.lastAt || 0) - (a.lastAt || 0) },
  name: {
    label: 'Name',
    compare: (a, b) => String(a.customerName || '').localeCompare(String(b.customerName || '')),
  },
};

const CSV_COLUMNS = [
  { label: 'Customer Name', value: (c) => c.customerName },
  { label: 'Customer Mobile', value: (c) => c.customerMobile },
  { label: 'Receipts', value: (c) => c.receipts },
  { label: 'Sand Quantity', value: (c) => c.quantity },
  { label: 'Vehicles', value: (c) => c.vehicles },
  { label: 'Last Vehicle', value: (c) => c.lastVehicleNo },
  { label: 'Last Supply Point', value: (c) => c.supplyPoint },
  { label: 'Last Dispatch', value: (c) => formatDateTime(c.lastAt) },
];

/**
 * Customers: every consumer sand has been dispatched to, with how much and
 * how often. Read off the receipts - nothing is entered here. Administrators
 * see every customer; an operator sees the customers on their own receipts.
 */
const Customers = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('receipts');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { customers, receipts, quantity, truncated, loading, error, range } = useDirectory(preset);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers
      .filter((customer) => {
        if (!term) return true;
        return [customer.customerName, customer.customerMobile, customer.lastVehicleNo, customer.supplyPoint].some(
          (value) => String(value || '').toLowerCase().includes(term),
        );
      })
      .sort(SORTS[sort].compare);
  }, [customers, search, sort]);

  const { pageRows, pageIndex, hasMore, canGoPrev, nextPage, prevPage } = usePaged(rows, pageSize);

  const filtered = Boolean(search || preset !== 'ALL');
  const clearFilters = () => {
    setSearch('');
    setPreset('ALL');
  };

  /** Receipt History searches by mobile number; the name is the fallback. */
  const openReceipts = (customer) =>
    navigate('/receipts', { state: { search: customer.customerMobile || customer.customerName } });

  const columns = [
    {
      key: 'customer',
      label: 'Customer',
      render: (customer) => (
        <div className="flex min-w-[200px] items-center gap-3">
          <span className="avatar size-9">{initials(customer.customerName)}</span>
          <div className="cell-stack">
            <span className="cell-stack__main">{customer.customerName || '-'}</span>
            <span className="cell-stack__sub">{maskMobile(customer.customerMobile)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'receipts',
      label: 'Receipts',
      className: 'text-right',
      render: (customer) => <strong>{formatNumber(customer.receipts)}</strong>,
    },
    {
      key: 'quantity',
      label: 'Sand Qty',
      className: 'text-right',
      render: (customer) => formatQuantity(customer.quantity),
    },
    {
      key: 'vehicles',
      label: 'Vehicles',
      className: 'text-right',
      render: (customer) => formatNumber(customer.vehicles),
    },
    {
      key: 'point',
      label: 'Last Supply Point',
      render: (customer) => (
        <div className="cell-stack">
          <span className="cell-stack__main">{customer.supplyPoint || '-'}</span>
          <span className="cell-stack__sub font-mono">{customer.lastVehicleNo || ''}</span>
        </div>
      ),
    },
    {
      key: 'last',
      label: 'Last Dispatch',
      render: (customer) => (
        <div className="cell-stack">
          <span className="cell-stack__main whitespace-nowrap">
            {customer.lastAt ? relativeTime(customer.lastAt) : '-'}
          </span>
          <span className="cell-stack__sub">{customer.lastAt ? formatDateTime(customer.lastAt) : ''}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'cell-actions text-right',
      hideOnCard: true,
      render: (customer) => (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => openReceipts(customer)}>
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
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Every consumer sand has been dispatched to, with how much and how often.'
              : 'The customers on the receipts you have generated.'}{' '}
            The list builds itself from the receipts; cancelled receipts are not counted.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={!rows.length}
            onClick={() => downloadCsv(`AP-SAND-customers-${fileStamp()}.csv`, CSV_COLUMNS, rows)}
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
          <p className="kpi__label">Customers ({range.label})</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(customers.length)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Receipts</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(receipts)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Sand Dispatched</p>
          <p className="kpi__value">{loading ? '…' : formatQuantity(quantity)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Avg Sand per Customer</p>
          <p className="kpi__value">
            {loading ? '…' : formatQuantity(customers.length ? quantity / customers.length : 0)}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Name, mobile, vehicle, supply point…"
          ariaLabel="Search customers"
          delay={150}
        />
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
        rowKey={(customer) => customer.key}
        emptyIcon={Contact}
        emptyTitle={filtered ? 'No customers match these filters' : 'No customers yet'}
        emptyMessage={
          filtered
            ? 'Try a different search term or clear the filters.'
            : 'A customer appears here as soon as a receipt is generated for them.'
        }
        cardTitle={(customer) => customer.customerName || maskMobile(customer.customerMobile)}
        cardBadge={(customer) => (
          <span className="badge badge--neutral">{formatNumber(customer.receipts)} receipts</span>
        )}
        cardActions={(customer) => (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => openReceipts(customer)}>
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

export default Customers;
