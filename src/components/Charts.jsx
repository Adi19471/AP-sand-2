import { memo } from 'react';
import { formatNumber, formatPercent, percentValue } from '../utils/format';

/**
 * Lightweight SVG charts.
 *
 * Written by hand rather than pulled from a charting library: the whole file
 * is smaller than any dependency would be, it inherits the design tokens, and
 * it renders identically in the print and PDF pipelines.
 */

/** Brand palette, in the order the vehicle trip types are displayed. */
export const TRIP_COLORS = {
  Trucktor: '#1d4ed8',
  '8 Tier': '#3b82f6',
  '10 Tier': '#93c5fd',
  '12 Tier': '#0f766e',
  '14 Tier': '#14b8a6',
  '16 Tier': '#64748b',
};

export const SERIES_COLORS = ['#1d4ed8', '#3b82f6', '#93c5fd', '#0f766e', '#14b8a6', '#64748b'];

export const colorForTrip = (trip, index = 0) =>
  TRIP_COLORS[trip] || SERIES_COLORS[index % SERIES_COLORS.length];

/** ------------------------------------------------------- horizontal bars */

/**
 * The Vehicle Trip Count panel: one labelled bar per trip type with its
 * count and share of the total.
 */
export const TripBars = memo(({ rows, total, showPercent = true }) => {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="trip-list">
      {rows.map((row, index) => {
        const color = colorForTrip(row.trip, index);
        return (
          <div className="trip-row" key={row.trip}>
            <span className="trip-row__label">
              <span className="trip-row__swatch" style={{ background: color }} />
              {row.trip}
            </span>
            <span className="trip-row__track">
              <span
                className="trip-row__fill"
                style={{ width: `${(row.count / max) * 100}%`, background: color }}
              />
            </span>
            <span className="trip-row__value">
              <span className="trip-row__count">{formatNumber(row.count)}</span>
              {showPercent && (
                <span className="trip-row__pct">{formatPercent(row.count, total)}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
});

TripBars.displayName = 'TripBars';

/** ---------------------------------------------------------- column chart */

/**
 * Vertical bar chart for time series (receipts per day / per month).
 * `data`: `[{ label, value }]`
 */
export const BarChart = memo(({ data, height = 220, color = '#2563eb', valueLabel = 'Receipts' }) => {
  if (!data.length) return null;

  const width = Math.max(320, data.length * 46);
  const padding = { top: 16, right: 12, bottom: 28, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  // Round the axis up to a friendly number so gridlines read cleanly.
  const step = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const niceMax = Math.ceil(maxValue / step) * step || 1;

  const bandWidth = plotWidth / data.length;
  const barWidth = Math.min(30, bandWidth * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t));
  const uniqueTicks = Array.from(new Set(ticks));

  // Thin the x labels out when there are too many days to fit.
  const labelStride = Math.ceil(data.length / 14);

  return (
    <div className="overflow-x-auto">
      <svg
        className="bar-chart"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`${valueLabel} chart`}
      >
        {uniqueTicks.map((tick) => {
          const y = padding.top + plotHeight - (tick / niceMax) * plotHeight;
          return (
            <g key={tick}>
              <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text x={padding.left - 7} y={y + 3} textAnchor="end">
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}

        <line
          className="axis-line"
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
        />

        {data.map((item, index) => {
          const barHeight = (item.value / niceMax) * plotHeight;
          const x = padding.left + index * bandWidth + (bandWidth - barWidth) / 2;
          const y = padding.top + plotHeight - barHeight;
          return (
            <g key={item.label + index}>
              <rect
                className="bar"
                x={x}
                y={item.value > 0 ? y : padding.top + plotHeight - 1}
                width={barWidth}
                height={item.value > 0 ? Math.max(2, barHeight) : 1}
                rx="3"
                fill={color}
              >
                <title>{`${item.label}: ${formatNumber(item.value)} ${valueLabel}`}</title>
              </rect>
              {index % labelStride === 0 && (
                <text x={x + barWidth / 2} y={height - 9} textAnchor="middle">
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
});

BarChart.displayName = 'BarChart';

/** ----------------------------------------------------------------- donut */

const polarToCartesian = (cx, cy, radius, angle) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
};

const arcPath = (cx, cy, outer, inner, startAngle, endAngle) => {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polarToCartesian(cx, cy, outer, endAngle);
  const p2 = polarToCartesian(cx, cy, outer, startAngle);
  const p3 = polarToCartesian(cx, cy, inner, startAngle);
  const p4 = polarToCartesian(cx, cy, inner, endAngle);

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
};

/**
 * Donut breakdown with a legend. `data`: `[{ label, value, color }]`
 */
export const DonutChart = memo(({ data, size = 176, centerLabel = 'Total', thickness = 30 }) => {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer - thickness;

  let angle = 0;
  const slices = data
    .filter((item) => Number(item.value) > 0)
    .map((item, index) => {
      const share = (Number(item.value) / total) * 360;
      const slice = {
        ...item,
        color: item.color || SERIES_COLORS[index % SERIES_COLORS.length],
        start: angle,
        // A hair of separation keeps adjacent slices visually distinct.
        end: angle + Math.max(share - 0.6, 0.4),
      };
      angle += share;
      return slice;
    });

  return (
    <div className="donut-wrap">
      <svg
        className="donut"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${centerLabel} breakdown`}
      >
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        ) : (
          slices.map((slice) => (
            <path key={slice.label} d={arcPath(cx, cy, outer, inner, slice.start, slice.end)} fill={slice.color}>
              <title>{`${slice.label}: ${formatNumber(slice.value)}`}</title>
            </path>
          ))
        )}
        <text className="donut__center-value" x={cx} y={cy - 1} textAnchor="middle">
          {formatNumber(total)}
        </text>
        <text className="donut__center-label" x={cx} y={cy + 14} textAnchor="middle">
          {centerLabel}
        </text>
      </svg>

      <div className="donut-legend">
        {data.map((item, index) => (
          <div className="donut-legend__row" key={item.label}>
            <span
              className="legend-item__dot"
              style={{ background: item.color || SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <span>{item.label}</span>
            <span>{formatNumber(item.value)}</span>
            <span>{percentValue(item.value, total).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
});

DonutChart.displayName = 'DonutChart';

export default BarChart;
