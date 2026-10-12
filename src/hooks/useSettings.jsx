/** App settings context - one shared `settings/app` listener for the whole UI. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { DEFAULT_SETTINGS, subscribeSettings } from '../services/settingsService';
import { useAuth } from './useAuth';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !isAuthenticated) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = subscribeSettings(
      (next) => {
        setSettings(next);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [isAuthenticated]);

  const value = useMemo(() => ({ settings, loading }), [settings, loading]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return context;
};

export default useSettings;
