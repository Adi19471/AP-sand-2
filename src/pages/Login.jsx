import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import Emblem from '../components/Emblem';
import GoogleMark from '../components/GoogleMark';
import { Spinner } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { APP_NAME, APP_SUBTITLE, USER_STATUS } from '../utils/constants';
import { friendlyError } from '../utils/errors';

/** Closing the Google window is a change of mind, not a failure. */
const DISMISSED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

/**
 * Sign in with a Google account - there is no password to type.
 *
 * Access is decided after Google has confirmed who the person is: an
 * approved account goes straight in, a new one waits for an administrator.
 */
const Login = () => {
  const { user, profile, notice, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  // Already signed in, or just back from Google's full-page sign-in.
  if (!submitting && user && profile && profile.status !== USER_STATUS.DISABLED) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleGoogle = async () => {
    setSubmitting(true);
    setFormError('');
    try {
      const result = await loginWithGoogle();
      // null: the browser is leaving for Google's own sign-in page.
      if (!result) return;

      if (result.pending) {
        toast.info('Signed in. An administrator still has to approve this Google account.');
      } else {
        toast.success('Welcome back to AP SAND.');
      }
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (!DISMISSED.includes(error?.code)) {
        setFormError(friendlyError(error, 'Unable to sign in with Google. Please try again.'));
      }
      setSubmitting(false);
    }
  };

  const message = formError || notice;

  return (
    <div className="auth-card">
      <div className="auth-card__mobile-brand">
        <Emblem size={44} />
        <div>
          <div className="auth-aside__brand-title">{APP_NAME}</div>
          <div className="auth-aside__brand-sub">{APP_SUBTITLE}</div>
        </div>
      </div>

      <h1 className="auth-card__title">Sign in</h1>
      <p className="auth-card__subtitle">
        Use your Google account to open the sand management system. There is no separate password
        to remember.
      </p>

      {message && (
        <div className="alert alert--error mb-4" role="alert">
          <AlertCircle size={17} className="alert__icon" />
          <div className="alert__body">{message}</div>
        </div>
      )}

      <button
        type="button"
        className="btn btn--outline btn--lg btn--block"
        onClick={handleGoogle}
        disabled={submitting}
      >
        {submitting ? <Spinner size={18} /> : <GoogleMark size={20} />}
        {submitting ? 'Waiting for Google…' : 'Continue with Google'}
      </button>

      <div className="auth-card__switch flex items-start gap-2.5 text-left">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-700" />
        <span>
          Access is given by an administrator. If your Google account has not been approved yet,
          you can still sign in - it then waits here until it is.
        </span>
      </div>
    </div>
  );
};

export default Login;
