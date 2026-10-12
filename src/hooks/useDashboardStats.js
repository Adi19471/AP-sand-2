/**
 * Real-time dashboard metrics.
 *
 * Two `onSnapshot` listeners on two counter documents - that is the entire
 * read cost of the live dashboard, no matter how many receipts exist. When
 * an operator on another machine saves a receipt, Firestore pushes the new
 * counter values here and the cards re-render on their own.
 */
import { useEffect, useMemo, useState } from 'react';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import {
  EMPTY_DAILY_COUNTERS,
  EMPTY_GLOBAL_COUNTERS,
  subscribeDailyCounters,
  subscribeGlobalCounters,
} from '../services/counterService';
import { VEHICLE_TRIPS } from '../utils/constants';
import { friendlyError } from '../utils/errors';

export const useDashboardStats = (enabled = true) => {
  const [global, setGlobal] = useState(EMPTY_GLOBAL_COUNTERS);
  const [daily, setDaily] = useState(EMPTY_DAILY_COUNTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let globalReady = false;
    let dailyReady = false;
    const markReady = () => {
      if (globalReady && dailyReady) setLoading(false);
    };

    const handleError = (err) =>
      setError(friendlyError(err, 'Unable to load live dashboard statistics.'));

    const unsubGlobal = subscribeGlobalCounters((data) => {
      setGlobal(data);
      globalReady = true;
      markReady();
    }, handleError);

    const unsubDaily = subscribeDailyCounters((data) => {
      setDaily(data);
      dailyReady = true;
      markReady();
    }, handleError);

    // Always tear both listeners down - leaking them would keep billing reads
    // alive after the dashboard unmounts.
    return () => {
      unsubGlobal();
      unsubDaily();
    };
  }, [enabled]);

  const stats = useMemo(
    () => ({
      registeredEmails: global.totalUsers || 0,
      activeUsers: global.activeUsers || 0,
      disabledUsers: global.disabledUsers || 0,
      loginSessions: global.totalLoginSessions || 0,
      uniqueUsers: global.uniqueLoginUsers || 0,
      totalReceipts: global.totalReceipts || 0,
      activeReceipts: global.activeReceipts || 0,
      cancelledReceipts: global.cancelledReceipts || 0,
      totalVehicleTrips: global.totalVehicleTrips || 0,
      totalSandQuantity: global.totalSandQuantity || 0,
      todayReceipts: daily.receipts || 0,
      todaySandQuantity: daily.sandQuantity || 0,
      todayLogins: daily.logins || 0,
      vehicleTrips: global.vehicleTrips || {},
      todayVehicleTrips: daily.vehicleTrips || {},
    }),
    [global, daily],
  );

  const vehicleTripRows = useMemo(
    () =>
      VEHICLE_TRIPS.map((trip) => ({
        trip,
        count: stats.vehicleTrips[trip] || 0,
        today: stats.todayVehicleTrips[trip] || 0,
      })),
    [stats],
  );

  return { stats, vehicleTripRows, loading, error };
};

export default useDashboardStats;
