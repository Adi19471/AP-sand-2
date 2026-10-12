import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, MapPin, Truck, UserCheck } from 'lucide-react';
import { BarChart, TripBars } from '../components/Charts';
import EmptyState from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { buildReceiptReport } from '../services/reportService';
import { DATE_PRESETS } from '../utils/constants';
import { fileStamp, formatDateTime, resolveDateRange } from '../utils/dateUtils';
import { downloadCsv, formatNumber, formatQuantity } from '../utils/format';
import { friendlyError } from '../utils/errors';

const CSV_COLUMNS = [
  { label: 'Receipt ID', value: (r) => r.receiptId },
  { label: 'Dispatch ID', value: (r) => r.dispatchId },
  { label: 'Order ID', value: (r) => r.orderId },
  { label: 'Status', value: (r) => r.status },
  { label: 'Customer Name', value: (r) => r.customerName },
  { label: 'Customer Mobile', value: (r) => r.customerMobile },
  { label: 'Vehicle No', value: (r) => r.vehicleNo },
  { label: 'Vehicle Trip', value: (r) => r.vehicleTrip },
  { label: 'Sand Quantity', value: (r) => r.sandQuantity },
  { label: 'Sand Unit', value: (r) => r.sandUnit },
  { label: 'Supply Point', value: (r) => r.supplyPoint },
  { label: 'Created At', value: (r) => formatDateTime(r.createdAt) },
  { label: 'Created By', value: (r) => r.createdByEmail },
];

const shortDay = (key) => {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
};

/** Breakdown table used for operators and supply points. */
const RollupTable = ({ rows, keyLabel }) =>
  rows.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{keyLabel}</th>
            <th className="text-right">Receipts</th>
            <th className="text-right">Sand Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="wrap-anywhere">{row.key}</td>
              <td className="text-right">{formatNumber(row.receipts)}</td>
              <td className="text-right">{formatQuantity(row.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="p-5 text-slate-500">
      No dispatches in this period.
    </p>
  );

/** Date-range dispatch and vehicle-trip reports with CSV export. */
const Reports = () => {
  const { actor } = useAuth();

  const [preset, setPreset] = useState('THIS_MONTH');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => resolveDateRange(preset, custom), [preset, custom]);
  const customIncomplete = preset === 'CUSTOM' && (!custom.from || !custom.to);

  useEffect(() => {
    if (!actor?.uid || customIncomplete) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    buildReceiptReport({ from: range.from, to: range.to, viewer: actor })
      .then((result) => active && setReport(result))
      .catch((err) => active && setError(friendlyError(err, 'Unable to build the report.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [actor, range, customIncomplete]);

  const dayData = useMemo(
    () => (report?.byDay || []).map((d) => ({ label: shortDay(d.key), value: d.receipts })),
    [report],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Administration</p>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Dispatch volume, vehicle trips, operators and supply points for any date range.
            Cancelled receipts are excluded from quantities and trips.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={!report?.rows?.length}
            onClick={() =>
              downloadCsv(`AP-SAND-report-${fileStamp()}.csv`, CSV_COLUMNS, report.rows)
            }
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="card report-toolbar">
        <div className="preset-tabs" role="tablist" aria-label="Date range">
          {DATE_PRESETS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={preset === option.value}
              className={`preset-tab${preset === option.value ? ' is-active' : ''}`}
              onClick={() => setPreset(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
      </div>

      {customIncomplete ? (
        <EmptyState icon={BarChart3} title="Pick a date range" message="Choose both a start and an end date." />
      ) : loading ? (
        <Loading label="Building report…" />
      ) : error ? (
        <div className="alert alert--error" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {report.truncated && (
            <div className="alert alert--warning">
              <AlertTriangle size={17} className="alert__icon" />
              <div className="alert__body">
                This range has more than {formatNumber(report.rows.length)} receipts; only the most
                recent ones are included. Choose a shorter range for exact totals.
              </div>
            </div>
          )}

          <div className="kpi-strip">
            <div className="kpi">
              <p className="kpi__label">Receipts</p>
              <p className="kpi__value">{formatNumber(report.totalReceipts)}</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">Active / Cancelled</p>
              <p className="kpi__value">
                {formatNumber(report.activeReceipts)} / {formatNumber(report.cancelledReceipts)}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi__label">Sand Dispatched</p>
              <p className="kpi__value">{formatQuantity(report.totalSandQuantity)}</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">Vehicle Trips</p>
              <p className="kpi__value">{formatNumber(report.totalVehicleTrips)}</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">Unique Vehicles</p>
              <p className="kpi__value">{formatNumber(report.uniqueVehicles)}</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">Avg per Trip</p>
              <p className="kpi__value">{formatQuantity(report.averageQuantity)}</p>
            </div>
          </div>

          {report.totalReceipts === 0 ? (
            <EmptyState
              icon={BarChart3}
              title={`No receipts for ${range.label.toLowerCase()}`}
              message="Pick a different date range."
            />
          ) : (
            <>
              <div className="dash-grid">
                <section className="card">
                  <div className="card__header">
                    <h2 className="section-title">
                      <BarChart3 size={16} />
                      Receipts per Day
                    </h2>
                  </div>
                  <div className="card__body">
                    {dayData.length ? (
                      <BarChart data={dayData} valueLabel="Receipts" />
                    ) : (
                      <p className="text-slate-500">Only cancelled receipts in this period.</p>
                    )}
                  </div>
                </section>

                <section className="card">
                  <div className="card__header">
                    <h2 className="section-title">
                      <Truck size={16} />
                      Vehicle Trips
                    </h2>
                  </div>
                  <div className="card__body">
                    <TripBars rows={report.vehicleTripRows} total={report.totalVehicleTrips} />
                  </div>
                </section>
              </div>

              <div className="dash-grid dash-grid--even">
                <section className="card">
                  <div className="card__header">
                    <h2 className="section-title">
                      <UserCheck size={16} />
                      By Operator
                    </h2>
                  </div>
                  <div className="card__body card__body--flush">
                    <RollupTable rows={report.byOperator} keyLabel="Operator" />
                  </div>
                </section>

                <section className="card">
                  <div className="card__header">
                    <h2 className="section-title">
                      <MapPin size={16} />
                      By Supply Point
                    </h2>
                  </div>
                  <div className="card__body card__body--flush">
                    <RollupTable rows={report.bySupplyPoint} keyLabel="Supply Point" />
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default Reports;
