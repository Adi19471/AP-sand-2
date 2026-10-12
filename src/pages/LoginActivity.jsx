import { useEffect, useMemo, useState } from 'react';
import { Download, LogIn, Monitor, Smartphone } from 'lucide-react';
import DataTable from '../components/DataTable';
import { useAuth } from '../hooks/useAuth';
import { subscribeLoginSessions, subscribeUsers } from '../services/userService';
import { summariseLoginSessions } from '../services/reportService';
import { DATE_PRESETS } from '../utils/constants';
import { fileStamp, formatDateTime, relativeTime, resolveDateRange } from '../utils/dateUtils';
import { downloadCsv, formatNumber } from '../utils/format';
import { friendlyError } from '../utils/errors';

const MAX_SESSIONS = 500;

const CSV_COLUMNS = [
  { label: 'Email', value: (s) => s.email },
  { label: 'Login At', value: (s) => formatDateTime(s.loginAt) },
  { label: 'Device', value: (s) => s.device },
  { label: 'Browser', value: (s) => s.browser },
  { label: 'Platform', value: (s) => s.platform },
  { label: 'Screen', value: (s) => s.screen },
  { label: 'Timezone', value: (s) => s.timezone },
];

/** Append-only sign-in audit trail for every operator. */
const LoginActivity = () => {
  const { actor } = useAuth();

  const [preset, setPreset] = useState('LAST_7');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => resolveDateRange(preset, custom), [preset, custom]);

  // The account list feeds the "user" filter.
  useEffect(
    () =>
      subscribeUsers(
        (rows) => setEmails(rows.map((u) => u.email).filter(Boolean).sort()),
        () => setEmails([]),
      ),
    [],
  );

  useEffect(() => {
    if (!actor?.uid) return undefined;
    setLoading(true);
    setError('');
    return subscribeLoginSessions(
      { viewer: actor, email, from: range.from, to: range.to, take: MAX_SESSIONS },
      (rows) => {
        setSessions(rows);
        setLoading(false);
      },
      (err) => {
        setError(friendlyError(err, 'Unable to load login activity.'));
        setSessions([]);
        setLoading(false);
      },
    );
  }, [actor, email, range]);

  const summary = useMemo(() => summariseLoginSessions(sessions), [sessions]);
  const topUser = summary.byUser[0];
  const topDevice = summary.byDevice[0];

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (s) => <span className="font-semibold text-slate-900 wrap-anywhere">{s.email}</span>,
    },
    {
      key: 'when',
      label: 'Login Time',
      render: (s) => (
        <div className="cell-stack">
          <span className="cell-stack__main">{formatDateTime(s.loginAt)}</span>
          <span className="cell-stack__sub">{relativeTime(s.loginAt)}</span>
        </div>
      ),
    },
    {
      key: 'device',
      label: 'Device',
      render: (s) => (
        <span className="flex items-center gap-2">
          {s.device === 'Mobile' ? <Smartphone size={14} /> : <Monitor size={14} />}
          {s.device || '-'}
        </span>
      ),
    },
    { key: 'browser', label: 'Browser', render: (s) => s.browser || '-' },
    { key: 'platform', label: 'Platform', render: (s) => s.platform || '-' },
    { key: 'screen', label: 'Screen', hideOnCard: true, render: (s) => s.screen || '-' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Administration</p>
          <h1 className="page-title">Login Activity</h1>
          <p className="page-subtitle">
            Every successful sign-in, newest first. Records cannot be edited or deleted.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={!sessions.length}
            onClick={() => downloadCsv(`AP-SAND-logins-${fileStamp()}.csv`, CSV_COLUMNS, sessions)}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <p className="kpi__label">Sign-ins ({range.label})</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(summary.total)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Unique Users</p>
          <p className="kpi__value">{loading ? '…' : formatNumber(summary.uniqueUsers)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Most Active</p>
          <p className="kpi__value text-[15px] wrap-anywhere">
            {topUser ? `${topUser.email} (${topUser.count})` : '-'}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Top Device</p>
          <p className="kpi__value text-[15px]">
            {topDevice ? `${topDevice.device} (${topDevice.count})` : '-'}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <label className="filter-select">
          <span className="sr-only">User</span>
          <select className="select" value={email} onChange={(e) => setEmail(e.target.value)}>
            <option value="">All users</option>
            {emails.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Date range</span>
          <select className="select" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {DATE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="ALL">All time</option>
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
        {sessions.length >= MAX_SESSIONS && (
          <span className="text-xs text-slate-500">
            Showing the latest {MAX_SESSIONS} - narrow the date range to see more.
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert--error my-3" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={sessions}
        loading={loading}
        emptyIcon={LogIn}
        emptyTitle="No sign-ins in this period"
        emptyMessage="Choose a wider date range or a different user."
        cardTitle={(s) => s.email}
        minWidth={820}
      />
    </>
  );
};

export default LoginActivity;
