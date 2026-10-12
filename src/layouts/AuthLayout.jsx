import { Outlet } from 'react-router-dom';
import { Activity, FileText, ShieldCheck, Truck } from 'lucide-react';
import Emblem from '../components/Emblem';
import { APP_NAME, APP_SUBTITLE } from '../utils/constants';

const FEATURES = [
  {
    icon: FileText,
    title: 'Instant dispatch receipts',
    text: 'Consumer and driver copies with a verification QR, ready to print on a 3 inch thermal printer.',
  },
  {
    icon: Activity,
    title: 'Live operations dashboard',
    text: 'Counts update the moment another operator saves a receipt - no refresh needed.',
  },
  {
    icon: Truck,
    title: 'Vehicle trip tracking',
    text: 'Trucktor through 16 Tier, counted and reported across every supply point.',
  },
  {
    icon: ShieldCheck,
    title: 'Access by approval',
    text: 'Sign in with Google. An administrator approves each account and sets its role.',
  },
];

/** Split-screen shell used by the sign-in screen. */
const AuthLayout = () => (
  <div className="auth-page">
    <aside className="auth-aside">
      <div className="auth-aside__brand">
        <Emblem size={54} />
        <div>
          <div className="auth-aside__brand-title">{APP_NAME}</div>
          <div className="auth-aside__brand-sub">{APP_SUBTITLE}</div>
        </div>
      </div>

      <div>
        <h1 className="auth-aside__headline">Sand dispatch, end to end.</h1>
        <p className="auth-aside__lede">
          Register consumers, generate tamper-evident dispatch receipts, and watch every trip roll
          up into live reports - all backed by Cloud Firestore.
        </p>

        <div className="auth-aside__features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div className="auth-feature" key={title}>
              <span className="auth-feature__icon">
                <Icon size={17} />
              </span>
              <div>
                <p className="auth-feature__title">{title}</p>
                <p className="auth-feature__text">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="auth-aside__footer">
        {APP_NAME} &middot; {APP_SUBTITLE} &middot; v1.0.0
      </p>
    </aside>

    <section className="auth-panel">
      <Outlet />
    </section>
  </div>
);

export default AuthLayout;
