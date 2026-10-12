import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, LogOut, Menu, ShieldCheck, User, Wifi, WifiOff } from 'lucide-react';
import Emblem from './Emblem';
import { APP_SUBTITLE, ROLES } from '../utils/constants';
import { initials } from '../utils/format';

/**
 * Top bar: brand on the left, live-connection pill and the signed-in account
 * menu on the right.
 */
const Header = ({ profile, email, isAdmin, appName = 'AP SAND', online, onToggleSidebar, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const name = profile?.name || email;
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  /** The Google account's picture when the profile has one, else initials. */
  const avatar = (extraClass = '') =>
    profile?.photoURL ? (
      <img
        src={profile.photoURL}
        alt=""
        className={`avatar${extraClass}`}
        referrerPolicy="no-referrer"
      />
    ) : (
      <span className={`avatar${extraClass}`}>{initials(profile?.name, email)}</span>
    );

  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header__menu"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation menu"
      >
        <Menu size={19} />
      </button>

      <div className="app-header__identity">
        <Emblem size={34} />
        <div className="app-header__title">
          <strong>{appName}</strong>
          <span>{APP_SUBTITLE}</span>
        </div>
      </div>

      <span className="app-header__date">
        <CalendarDays size={15} />
        {today}
      </span>

      <div className="app-header__spacer" />

      <span
        className={`app-header__live${online ? '' : ' app-header__live--offline'}`}
        title={online ? 'Connected to Firestore - dashboard updates live' : 'Offline - showing cached data'}
      >
        <span className="app-header__live-dot" aria-hidden="true" />
        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span>{online ? 'Live' : 'Offline'}</span>
      </span>

      <div className="user-menu" ref={menuRef}>
        <button
          type="button"
          className="user-menu__trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {avatar()}
          <span className="user-menu__meta">
            <span className="user-menu__email">{email}</span>
            <span className="user-menu__role">{isAdmin ? 'Administrator' : 'Operator'}</span>
          </span>
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        {menuOpen && (
          <div className="user-menu__panel" role="menu">
            <div className="user-menu__panel-head">
              {avatar(' avatar--lg')}
              <div className="min-w-0">
                <p className="user-menu__panel-name">{name}</p>
                <p className="user-menu__panel-email">{email}</p>
                <span
                  className={`badge mt-1.5 ${isAdmin ? 'badge--admin' : 'badge--user'}`}
                >
                  {isAdmin ? <ShieldCheck size={11} /> : <User size={11} />}
                  {profile?.role || ROLES.USER}
                </span>
              </div>
            </div>

            <Link
              to="/profile"
              className="user-menu__item"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <User size={16} />
              My Profile
            </Link>

            <button
              type="button"
              className="user-menu__item user-menu__item--danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
