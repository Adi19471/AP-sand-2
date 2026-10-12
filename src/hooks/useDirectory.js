/** Loads the vehicle and customer directories for a date preset. */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { buildDirectory } from '../services/directoryService';
import { resolveDateRange } from '../utils/dateUtils';
import { friendlyError } from '../utils/errors';

const EMPTY = { vehicles: [], customers: [], receipts: 0, quantity: 0, truncated: false };

export const useDirectory = (preset = 'ALL') => {
  const { actor } = useAuth();
  const range = useMemo(() => resolveDateRange(preset), [preset]);

  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!actor?.uid) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    buildDirectory({ from: range.from, to: range.to, viewer: actor })
      .then((result) => active && setData(result))
      .catch((err) => active && setError(friendlyError(err, 'Unable to load this list.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [actor, range]);

  return { ...data, loading, error, range };
};

/** Client-side paging over a list that is already in memory. */
export const usePaged = (rows, pageSize) => {
  const [pageIndex, setPageIndex] = useState(0);

  // A new filter or page size starts again from the first page.
  useEffect(() => {
    setPageIndex(0);
  }, [rows, pageSize]);

  const start = pageIndex * pageSize;
  return {
    pageIndex,
    pageRows: rows.slice(start, start + pageSize),
    hasMore: start + pageSize < rows.length,
    canGoPrev: pageIndex > 0,
    nextPage: () => setPageIndex((index) => index + 1),
    prevPage: () => setPageIndex((index) => Math.max(0, index - 1)),
  };
};

export default useDirectory;
