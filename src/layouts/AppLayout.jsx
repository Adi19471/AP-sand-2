import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { friendlyError } from '../utils/errors';

/** Signed-in application shell: sidebar, header and the routed page. */
const AppLayout = () => {
  const { profile, user, isAdmin, logout } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('You have been logged out.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(friendlyError(error, 'Unable to log out. Please try again.'));
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }, [logout, navigate, toast]);

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        isAdmin={isAdmin}
        appName={settings.appName}
        profile={profile}
        email={user?.email || profile?.email || ''}
        onNavigate={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Header
          profile={profile}
          email={user?.email || profile?.email || ''}
          isAdmin={isAdmin}
          appName={settings.appName}
          online={online}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onLogout={() => setConfirmLogout(true)}
        />

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <BottomNav onOpenMenu={() => setSidebarOpen(true)} />

      <ConfirmDialog
        open={confirmLogout}
        tone="warning"
        title="Log out of AP SAND?"
        message="You will need to sign in again to generate or view receipts."
        confirmLabel="Logout"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};

export default AppLayout;
