import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Loading } from './Loading';
import AccessPending from './AccessPending';
import EmptyState from './EmptyState';
import { useAuth } from '../hooks/useAuth';

/**
 * Route guard.
 *
 * The role and approval checks here are a UX convenience only - the
 * authoritative check is in `firestore.rules`, so a tampered client gains
 * nothing by rendering a screen it should not see: every query behind it
 * would be rejected.
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, isPending, initialising, user, profile, profileError, logout } =
    useAuth();
  const location = useLocation();

  if (initialising) {
    return <Loading label="Checking your session…" size={30} />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileError) {
    return (
      <div className="app-content">
        <EmptyState
          icon={ShieldAlert}
          title="Profile unavailable"
          message={
            typeof profileError === 'string' && profileError !== 'PROFILE_MISSING'
              ? profileError
              : 'Your user profile could not be loaded. Please contact your administrator.'
          }
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Loading label="Loading your profile…" size={30} />;
  }

  // Signed in with Google, but no administrator has approved the account yet.
  if (isPending) {
    return (
      <AccessPending
        email={profile.email || user.email || ''}
        name={profile.name ? profile.name.split(' ')[0] : ''}
        onSignOut={logout}
      />
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="app-content">
        <EmptyState
          icon={ShieldAlert}
          title="Administrator access required"
          message="You do not have permission to view this page. Contact your administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
