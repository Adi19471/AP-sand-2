import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import { SkeletonRows } from './Loading';

/**
 * Generic data table.
 *
 * Columns are described declaratively so every screen renders rows, loading
 * skeletons, empty states and the mobile card fallback the same way.
 *
 * @typedef {object} Column
 * @property {string}   key
 * @property {string}   label
 * @property {Function} render     (row) => ReactNode
 * @property {string}   [className]
 * @property {boolean}  [hideOnCard] Omit from the small-screen card layout.
 */
const DataTable = ({
  columns,
  rows,
  loading = false,
  rowKey = (row) => row.id,
  rowClassName = () => '',
  emptyTitle = 'No records found',
  emptyMessage = '',
  emptyIcon,
  emptyAction,
  cardTitle,
  cardBadge,
  cardActions,
  minWidth,
}) => {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="table-wrap">
      {showEmpty ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          message={emptyMessage}
          action={emptyAction}
        />
      ) : (
        <>
          <div className="table-scroll">
            <table
              className="data-table data-table--responsive"
              style={minWidth ? { minWidth } : undefined}
            >
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className={column.className}>
                      <span className="th-inner">{column.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              {loading ? (
                <SkeletonRows rows={6} columns={columns.length} />
              ) : (
                <tbody>
                  {rows.map((row) => (
                    <tr key={rowKey(row)} className={rowClassName(row)}>
                      {columns.map((column) => (
                        <td key={column.key} className={column.className}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>

          {/* Small screens get stacked cards instead of a squeezed table. */}
          <div className="record-cards">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div className="record-card" key={index}>
                    <div className="record-card__body">
                      <div className="skeleton h-3 w-[55%]" />
                      <div className="skeleton h-3 w-4/5" />
                      <div className="skeleton h-3 w-[68%]" />
                    </div>
                  </div>
                ))
              : rows.map((row) => (
                  <article className="record-card" key={`card-${rowKey(row)}`}>
                    {(cardTitle || cardBadge) && (
                      <header className="record-card__head">
                        {cardTitle && <span className="record-card__id">{cardTitle(row)}</span>}
                        {cardBadge && cardBadge(row)}
                      </header>
                    )}
                    <dl className="record-card__body">
                      {columns
                        .filter((column) => !column.hideOnCard)
                        .map((column) => (
                          <div className="record-card__row" key={`${rowKey(row)}-${column.key}`}>
                            <dt>{column.label}</dt>
                            <dd>{column.render(row)}</dd>
                          </div>
                        ))}
                    </dl>
                    {cardActions && (
                      <footer className="record-card__actions">{cardActions(row)}</footer>
                    )}
                  </article>
                ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Footer with record count and cursor-based page controls. */
export const TableFooter = ({
  pageIndex = 0,
  pageSize,
  count = 0,
  hasMore = false,
  canGoPrev = false,
  onPrev,
  onNext,
  pageSizeOptions,
  onPageSizeChange,
  loading = false,
}) => {
  const first = count === 0 ? 0 : pageIndex * pageSize + 1;
  const last = pageIndex * pageSize + count;

  return (
    <div className="table-footer">
      <div className="table-footer__info">
        {count === 0 ? (
          'No records on this page'
        ) : (
          <>
            Showing <strong>{first}</strong>–<strong>{last}</strong>
            {hasMore ? ' of many' : ''}
          </>
        )}
      </div>

      {pageSizeOptions && (
        <label className="page-size">
          Rows
          <select
            className="select"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="pagination">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={onPrev}
          disabled={!canGoPrev || loading}
        >
          <ChevronLeft size={15} />
          Previous
        </button>
        <span className="pagination__page">Page {pageIndex + 1}</span>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={onNext}
          disabled={!hasMore || loading}
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default DataTable;
