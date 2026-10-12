/** Spinners and skeletons - every Firebase read shows one of these. */

export const Spinner = ({ size = 18, className = '' }) => (
  <span
    className={`spinner ${className}`}
    style={{ width: size, height: size, borderWidth: Math.max(2, size / 8) }}
    aria-hidden="true"
  />
);

export const Loading = ({ label = 'Loading…', size = 26 }) => (
  <div className="loading-block" role="status" aria-live="polite">
    <Spinner size={size} />
    <span>{label}</span>
  </div>
);

export const LoadingInline = ({ label = 'Loading…' }) => (
  <span className="loading-inline" role="status">
    <Spinner size={14} />
    {label}
  </span>
);

/** Card-shaped placeholders for the dashboard grid. */
export const SkeletonCards = ({ count = 6 }) => (
  <div className="stat-grid" aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <div className="stat-card" key={index}>
        <div className="skeleton size-12 shrink-0 rounded-xl" />
        <div className="stat-card__body">
          <div className="skeleton h-2.5 w-[62%]" />
          <div className="skeleton stat-card__skeleton" />
        </div>
      </div>
    ))}
  </div>
);

/** Row placeholders sized to the data tables. */
export const SkeletonRows = ({ rows = 6, columns = 7 }) => (
  <tbody aria-hidden="true">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: columns }).map((__, colIndex) => (
          <td key={colIndex}>
            <div
              className="skeleton h-[11px]"
              style={{ width: colIndex === 0 ? '80%' : `${45 + ((colIndex * 13) % 45)}%` }}
            />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

export const SkeletonBlock = ({ height = 16, width = '100%', radius = 6 }) => (
  <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />
);

export default Loading;
