import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  Contact,
  FilePlus2,
  FileText,
  Files,
  Layers,
  LogIn,
  Mail,
  Radio,
  RefreshCw,
  ScanLine,
  Truck,
  UserCheck,
  Users as UsersIcon,
  Weight,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { SkeletonCards } from '../components/Loading';
import { DonutChart, TripBars, colorForTrip } from '../components/Charts';
import { useAuth } from '../hooks/useAuth';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { subscribeLatestReceipts } from '../services/receiptService';
import { buildReceiptReport } from '../services/reportService';
import { DASHBOARD_FIELDS, VEHICLE_TRIPS } from '../utils/constants';
import { endOfDay, formatDate, formatDateTime, relativeTime, startOfDay } from '../utils/dateUtils';
import { formatNumber, formatQuantity } from '../utils/format';
import { friendlyError } from '../utils/errors';

/** Shortcut tiles under the welcome banner. */
const QUICK_LINKS = [
  { to: '/scan', label: 'Scan QR', hint: 'Open a receipt from its QR code', icon: ScanLine },
  { to: '/vehicles', label: 'Vehicles', hint: 'Trips and volume per vehicle', icon: Truck },
  { to: '/customers', label: 'Customers', hint: 'Who the sand was dispatched to', icon: Contact },
  { to: '/reports', label: 'Reports', hint: 'Totals for any date range', icon: BarChart3, adminOnly: true },
];

/** Definition of each option in the "Dashboard Field" selector. */
const FIELD_DEFS = {
  registeredEmails: {
    label: 'Registered Email IDs',
    icon: Mail,
    hint: 'Distinct email IDs that have signed up.',
    get: (s) => s.registeredEmails,
  },
  loginSessions: {
    label: 'Total Login Sessions',
    icon: LogIn,
    hint: 'Every successful sign-in ever recorded.',
    get: (s) => s.loginSessions,
  },
  uniqueUsers: {
    label: 'Unique Logged-in Users',
    icon: UserCheck,
    hint: 'Accounts that have signed in at least once.',
    get: (s) => s.uniqueUsers,
  },
  totalReceipts: {
    label: 'Total Receipts',
    icon: Files,
    hint: 'All receipts generated across every operator.',
    get: (s) => s.totalReceipts,
  },
  todayReceipts: {
    label: "Today's Receipts",
    icon: CalendarCheck,
    hint: 'Receipts generated since midnight.',
    get: (s) => s.todayReceipts,
  },
  vehicleTrips: {
    label: 'Total Vehicle Trips',
    icon: Truck,
    hint: 'One trip is counted per active receipt.',
    get: (s) => s.totalVehicleTrips,
  },
  todaySand: {
    label: "Today's Sand Quantity",
    icon: Weight,
    hint: 'Total sand dispatched today.',
    get: (s) => s.todaySandQuantity,
    decimals: 2,
  },
};

/**
 * The operator card's date filter: nothing picked is all time, one date is
 * that day, both are the range between them (in whichever order entered).
 * Dates are when the receipt was generated, as on the Reports page.
 */
const resolveOperatorRange = ({ from, to }) => {
  if (!from && !to) return { from: null, to: null, label: 'All time' };
  const [first, last] = [from || to, to || from].sort();
  const start = startOfDay(new Date(`${first}T00:00:00`));
  const end = endOfDay(new Date(`${last}T00:00:00`));
  return {
    from: start,
    to: end,
    label: first === last ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`,
  };
};

/**
 * Receipts per operator for the chosen period. Administrators see every
 * operator; an operator's query is pinned to their own receipts
 * (firestore.rules), so they see their own row.
 */
const OperatorTable = ({ rows, loading, error, truncated, showToday, emptyText }) => {
  if (error) {
    return (
      <div className="card__body">
        <div className="alert alert--error" role="alert">
          <Activity size={17} className="alert__icon" />
          <div className="alert__body">{error}</div>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="card__body skeleton-stack">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="skeleton h-9" key={index} />
        ))}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <p className="p-5 text-slate-500">
        {emptyText}
      </p>
    );
  }

  const total = rows.reduce(
    (sum, row) => ({
      today: sum.today + row.today,
      receipts: sum.receipts + row.receipts,
      quantity: sum.quantity + row.quantity,
    }),
    { today: 0, receipts: 0, quantity: 0 },
  );

  return (
    <div className="table-scroll">
      <table className="data-table data-table--fit">
        <thead>
          <tr>
            <th>Operator</th>
            {showToday && <th className="text-right">Today</th>}
            <th className="text-right">Receipts</th>
            <th className="text-right">Sand Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="wrap-anywhere">{row.key}</td>
              {showToday && <td className="text-right">{formatNumber(row.today)}</td>}
              <td className="text-right">
                <strong>{formatNumber(row.receipts)}</strong>
              </td>
              <td className="text-right">{formatQuantity(row.quantity)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr>
              <th>Total</th>
              {showToday && <th className="text-right">{formatNumber(total.today)}</th>}
              <th className="text-right">{formatNumber(total.receipts)}</th>
              <th className="text-right">{formatQuantity(total.quantity)}</th>
            </tr>
          </tfoot>
        )}
      </table>
      {truncated && (
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          Counted from the latest 3,000 receipts.
        </p>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { actor, isAdmin, profile } = useAuth();
  const { stats, vehicleTripRows, loading, error } = useDashboardStats(true);

  const [operators, setOperators] = useState({ rows: [], truncated: false });
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [operatorsError, setOperatorsError] = useState('');
  const [operatorDates, setOperatorDates] = useState({ from: '', to: '' });
  const operatorRange = useMemo(() => resolveOperatorRange(operatorDates), [operatorDates]);
  const allTime = !operatorRange.from;
  // Skeleton only when the period changes, not on every live recount.
  const changeOperatorDates = (update) => {
    setOperatorsLoading(true);
    setOperatorDates(update);
  };

  // Active receipts per operator in the chosen period. Recounted whenever the
  // live counters say a receipt was added or cancelled, so the table keeps
  // up without a listener on the whole receipts collection.
  useEffect(() => {
    if (!actor?.uid || loading) return undefined;
    let active = true;
    buildReceiptReport({ from: operatorRange.from, to: operatorRange.to, viewer: actor })
      .then((report) => {
        if (!active) return;
        setOperators({ rows: report.byOperator, truncated: report.truncated });
        setOperatorsError('');
      })
      .catch((err) => {
        if (active) setOperatorsError(friendlyError(err, 'Unable to load receipts by operator.'));
      })
      .finally(() => {
        if (active) setOperatorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [actor, loading, operatorRange, stats.totalReceipts, stats.cancelledReceipts]);

  const [field, setField] = useState('ALL');
  const [latest, setLatest] = useState([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  // Live feed of the newest receipts. Unsubscribed on unmount so no listener
  // is left running behind the user's back.
  useEffect(() => {
    if (!actor?.uid) return undefined;

    setLatestLoading(true);
    const unsubscribe = subscribeLatestReceipts(
      actor,
      (rows) => {
        setLatest(rows);
        setLatestLoading(false);
        setUpdatedAt(new Date());
      },
      (err) => {
        setLatestError(friendlyError(err, 'Unable to load recent receipts.'));
        setLatestLoading(false);
      },
      8,
    );

    return unsubscribe;
  }, [actor]);

  useEffect(() => {
    if (!loading) setUpdatedAt(new Date());
  }, [stats, loading]);

  const donutData = useMemo(
    () =>
      VEHICLE_TRIPS.map((trip, index) => ({
        label: trip,
        value: stats.vehicleTrips[trip] || 0,
        color: colorForTrip(trip, index),
      })),
    [stats.vehicleTrips],
  );

  const focus = field !== 'ALL' ? FIELD_DEFS[field] : null;
  const FocusIcon = focus?.icon || Activity;

  return (
    <>
      <section className="dash-hero">
        <div className="dash-hero__text">
          <p className="dash-hero__eyebrow">
            <Radio size={12} /> Live &middot; updates automatically
          </p>
          <h1 className="dash-hero__title">
            Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="dash-hero__sub">Here is the current state of sand dispatch operations.</p>
        </div>
        <div className="dash-hero__actions">
          <Link to="/receipts/new" className="btn btn--light btn--lg">
            <FilePlus2 size={18} />
            Generate Receipt
          </Link>
          <Link to="/receipts" className="btn btn--glass btn--lg">
            <FileText size={18} />
            Receipt History
          </Link>
        </div>
      </section>

      <nav className="quick-grid" aria-label="Shortcuts">
        {QUICK_LINKS.filter((link) => !link.adminOnly || isAdmin).map(
          ({ to, label, hint, icon: Icon }) => (
            <Link to={to} className="quick-tile" key={to}>
              <span className="quick-tile__icon">
                <Icon size={19} />
              </span>
              <span className="quick-tile__text">
                <span className="quick-tile__label">{label}</span>
                <span className="quick-tile__hint">{hint}</span>
              </span>
              <ArrowUpRight size={16} className="quick-tile__arrow" />
            </Link>
          ),
        )}
      </nav>

      {error && (
        <div className="alert alert--error mb-4" role="alert">
          <Activity size={17} className="alert__icon" />
          <div className="alert__body">{error}</div>
        </div>
      )}

      {/* ------------------------------------------------- by operator */}
      <section className="card mb-5">
        <div className="card__header">
          <div>
            <h2 className="section-title">
              <UserCheck size={16} />
              Receipts by Operator
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              {operatorRange.label}
            </p>
          </div>
          <div className="range-inputs">
            <input
              type="date"
              className="input"
              aria-label="From date"
              value={operatorDates.from}
              onChange={(e) => changeOperatorDates((d) => ({ ...d, from: e.target.value }))}
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              className="input"
              aria-label="To date"
              value={operatorDates.to}
              onChange={(e) => changeOperatorDates((d) => ({ ...d, to: e.target.value }))}
            />
            {!allTime && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => changeOperatorDates({ from: '', to: '' })}
              >
                All time
              </button>
            )}
            {isAdmin && (
              <Link to="/reports" className="btn btn--ghost btn--sm">
                Full report
              </Link>
            )}
          </div>
        </div>
        <div className="card__body card__body--flush">
          <OperatorTable
            rows={operators.rows}
            truncated={operators.truncated}
            loading={operatorsLoading}
            error={operatorsError}
            showToday={allTime}
            emptyText={allTime ? 'No receipts yet.' : `No receipts for ${operatorRange.label}.`}
          />
        </div>
      </section>

      {/* ------------------------------------------ Dashboard Field selector */}
      <div className="field-select-bar">
        <label className="field-select-bar__label" htmlFor="dashboardField">
          <Layers size={15} />
          Dashboard Field
        </label>
        <select
          id="dashboardField"
          className="select"
          value={field}
          onChange={(event) => setField(event.target.value)}
        >
          {DASHBOARD_FIELDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="field-select-bar__spacer" />
        <span className="field-select-bar__stamp">
          <RefreshCw size={13} />
          Updated {relativeTime(updatedAt)}
        </span>
      </div>

      {/* ------------------------------------------------- featured metric */}
      {focus && (
        <section className="metric-focus">
          <span className="metric-focus__icon">
            <FocusIcon size={30} />
          </span>
          <div>
            <p className="metric-focus__label">{focus.label}</p>
            <p className="metric-focus__value">
              {formatNumber(focus.get(stats), focus.decimals || 0)}
              {field === 'todaySand' && <small>units</small>}
            </p>
            <p className="metric-focus__hint">{focus.hint}</p>
          </div>
          <span className="metric-focus__spacer" />
          <div className="metric-focus__aside">
            <div className="metric-focus__aside-item">
              <strong>{formatNumber(stats.totalReceipts)}</strong>
              Total receipts
            </div>
            <div className="metric-focus__aside-item">
              <strong>{formatNumber(stats.todayReceipts)}</strong>
              Today
            </div>
            <div className="metric-focus__aside-item">
              <strong>{formatNumber(stats.registeredEmails)}</strong>
              Registered emails
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ stat cards */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="stat-grid">
          <StatCard
            icon={Mail}
            tone="amber"
            label="Registered Email IDs"
            value={stats.registeredEmails}
            hint={`${formatNumber(stats.activeUsers)} active · ${formatNumber(stats.disabledUsers)} disabled`}
          />
          <StatCard
            icon={LogIn}
            tone="blue"
            label="Total Login Sessions"
            value={stats.loginSessions}
            hint={`${formatNumber(stats.uniqueUsers)} unique users · ${formatNumber(stats.todayLogins)} today`}
          />
          <StatCard
            icon={Files}
            tone="green"
            label="Total Receipts"
            value={stats.totalReceipts}
            hint={`${formatNumber(stats.activeReceipts)} active · ${formatNumber(stats.cancelledReceipts)} cancelled`}
          />
          <StatCard
            icon={Truck}
            tone="amber"
            label="Total Vehicle Trips"
            value={stats.totalVehicleTrips}
            hint="Counted from active receipts"
          />
          <StatCard
            icon={CalendarCheck}
            tone="green"
            label="Today's Receipts"
            value={stats.todayReceipts}
            hint={`${formatNumber(stats.todayLogins)} logins today`}
          />
          <StatCard
            icon={Weight}
            tone="slate"
            label="Today's Sand Quantity"
            value={formatQuantity(stats.todaySandQuantity)}
            hint={`${formatQuantity(stats.totalSandQuantity)} dispatched all time`}
          />
        </div>
      )}

      {/* ------------------------------------------------ charts and feeds */}
      <div className="dash-grid">
        <section className="card">
          <div className="card__header">
            <h2 className="section-title">
              <Truck size={16} />
              Vehicle Trip Count
            </h2>
            <span className="badge badge--neutral">
              {formatNumber(stats.totalVehicleTrips)} trips
            </span>
          </div>
          <div className="card__body">
            <TripBars rows={vehicleTripRows} total={stats.totalVehicleTrips} />

            <div className="chart-card__legend">
              {vehicleTripRows.map((row, index) => (
                <span className="legend-item" key={row.trip}>
                  <span
                    className="legend-item__dot"
                    style={{ background: colorForTrip(row.trip, index) }}
                  />
                  {row.trip} today: <strong>{formatNumber(row.today)}</strong>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2 className="section-title">
              <Layers size={16} />
              Trip Distribution
            </h2>
          </div>
          <div className="card__body">
            <DonutChart data={donutData} centerLabel="Trips" />
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card__header">
            <h2 className="section-title">
              <FileText size={16} />
              Latest Receipts
            </h2>
            <Link to="/receipts" className="btn btn--ghost btn--sm">
              View all
            </Link>
          </div>

          {latestError ? (
            <div className="card__body">
              <div className="alert alert--error" role="alert">
                <Activity size={17} className="alert__icon" />
                <div className="alert__body">{latestError}</div>
              </div>
            </div>
          ) : latestLoading ? (
            <div className="card__body skeleton-stack">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="skeleton h-10" key={index} />
              ))}
            </div>
          ) : latest.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No receipts found."
              message="Generated receipts will appear here in real time."
              action={
                <Link to="/receipts/new" className="btn btn--primary btn--sm">
                  <FilePlus2 size={15} />
                  Generate the first receipt
                </Link>
              }
            />
          ) : (
            <div className="feed">
              {latest.map((receipt) => (
                <div className="feed__item" key={receipt.id}>
                  <span className="feed__icon">
                    <FileText size={15} />
                  </span>
                  <div className="feed__body">
                    <p className="feed__title">
                      {receipt.receiptId} &middot; {receipt.customerName}
                    </p>
                    <p className="feed__meta">
                      {receipt.vehicleNo} · {receipt.vehicleTrip} ·{' '}
                      {formatQuantity(receipt.sandQuantity)} {receipt.sandUnit}
                      {receipt.status === 'CANCELLED' && ' · CANCELLED'}
                    </p>
                  </div>
                  <span className="feed__time" title={formatDateTime(receipt.createdAt)}>
                    {relativeTime(receipt.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <h2 className="section-title">
              <UsersIcon size={16} />
              Access Summary
            </h2>
          </div>
          <div className="card__body">
            <div className="kpi-strip mb-0">
              <div className="kpi">
                <p className="kpi__label">Registered Emails</p>
                <p className="kpi__value">{formatNumber(stats.registeredEmails)}</p>
              </div>
              <div className="kpi">
                <p className="kpi__label">Unique Logged-in</p>
                <p className="kpi__value">{formatNumber(stats.uniqueUsers)}</p>
              </div>
              <div className="kpi">
                <p className="kpi__label">Active Users</p>
                <p className="kpi__value">{formatNumber(stats.activeUsers)}</p>
              </div>
              <div className="kpi">
                <p className="kpi__label">Login Sessions</p>
                <p className="kpi__value">{formatNumber(stats.loginSessions)}</p>
              </div>
            </div>

            {isAdmin && (
              <div className="btn-group mt-4">
                <Link to="/users" className="btn btn--outline btn--sm">
                  <UsersIcon size={15} />
                  Manage users
                </Link>
                <Link to="/login-activity" className="btn btn--outline btn--sm">
                  <LogIn size={15} />
                  Login activity
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default Dashboard;
