/**
 * Paginated, filtered, live receipt list.
 *
 * Only one page of documents is ever held in memory and the `onSnapshot`
 * listener is swapped - never stacked - when the filters or the page change.
 * Pagination uses real Firestore cursors (`startAfter`), so page 40 costs the
 * same as page 1.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeReceipts } from '../services/receiptService';
import { DEFAULT_PAGE_SIZE } from '../utils/constants';
import { friendlyError } from '../utils/errors';

export const EMPTY_FILTERS = {
  search: '',
  status: '',
  vehicleTrip: '',
  createdByEmail: '',
  from: null,
  to: null,
};

export const useReceipts = ({ viewer, pageSize = DEFAULT_PAGE_SIZE, filters = EMPTY_FILTERS }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState({ index: 0, cursor: null });

  /** Cursors for the pages already visited, so "Previous" is free. */
  const history = useRef([null]);
  /** Last document of the page currently on screen - the next page's cursor. */
  const tail = useRef(null);

  // A stable primitive key: the effect must not re-subscribe just because the
  // parent re-rendered and handed us a new `filters` object identity.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        s: filters.search || '',
        st: filters.status || '',
        vt: filters.vehicleTrip || '',
        cb: filters.createdByEmail || '',
        f: filters.from ? filters.from.getTime() : 0,
        t: filters.to ? filters.to.getTime() : 0,
        ps: pageSize,
        uid: viewer?.uid || '',
        role: viewer?.role || '',
      }),
    [filters, pageSize, viewer],
  );

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Any filter change invalidates every cursor we were holding.
  useEffect(() => {
    history.current = [null];
    tail.current = null;
    setPage({ index: 0, cursor: null });
  }, [filterKey]);

  useEffect(() => {
    if (!viewer?.uid) {
      setLoading(false);
      setRows([]);
      return undefined;
    }

    setLoading(true);
    setError('');

    const unsubscribe = subscribeReceipts(
      { filters: filtersRef.current, viewer, pageSize, cursor: page.cursor },
      (result) => {
        tail.current = result.lastDoc;
        setRows(result.rows);
        setHasMore(result.hasMore);
        setLoading(false);
      },
      (err) => {
        setError(friendlyError(err, 'Unable to load receipt history.'));
        setRows([]);
        setHasMore(false);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [filterKey, page, viewer, pageSize]);

  const nextPage = useCallback(() => {
    if (!hasMore || !tail.current) return;
    const cursor = tail.current;
    setPage((current) => {
      history.current = [...history.current.slice(0, current.index + 1), cursor];
      return { index: current.index + 1, cursor };
    });
  }, [hasMore]);

  const prevPage = useCallback(() => {
    setPage((current) => {
      if (current.index === 0) return current;
      const index = current.index - 1;
      return { index, cursor: history.current[index] ?? null };
    });
  }, []);

  const firstPage = useCallback(() => {
    history.current = [null];
    setPage({ index: 0, cursor: null });
  }, []);

  return {
    rows,
    loading,
    error,
    hasMore,
    pageIndex: page.index,
    nextPage,
    prevPage,
    firstPage,
    canGoPrev: page.index > 0,
  };
};

export default useReceipts;
