import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Contact,
  FilePlus2,
  History,
  LayoutDashboard,
  LogIn,
  ScanLine,
  Settings as SettingsIcon,
  Truck,
  Users,
} from 'lucide-react';
import Emblem from './Emblem';
import { APP_SUBTITLE } from '../utils/constants';
import { initials } from '../utils/format';

/** Menu available to every signed-in operator. */
const CORE_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/receipts/new', label: 'Generate Receipt', icon: FilePlus2 },
  { to: '/receipts', label: 'Receipt History', icon: History },
  { to: '/scan', label: 'Scan QR', icon: ScanLine },
];

/** Lists read off the receipts; each user sees what their receipts cover. */
const DIRECTORY_LINKS = [
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/customers', label: 'Customers', icon: Contact },
];

/** Administrator-only menu (spec section 29). */
const ADMIN_LINKS = [
  { to: '/users', label: 'Users & Access', icon: Users },
  { to: '/login-activity', label: 'Login Activity', icon: LogIn },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const NavGroup = ({ label, links, onNavigate }) => (
  <>
    <p className="sidebar__group-label">{label}</p>
    <ul>
      {links.map(({ to, label: text, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/receipts'}
            className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
            onClick={onNavigate}
          >
            <span className="sidebar__link-icon">
              <Icon size={17} />
            </span>
            <span className="sidebar__link-label">{text}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </>
);

const Sidebar = ({ open, isAdmin, appName = 'AP SAND', profile, email = '', onNavigate }) => (
  <>
    {open && (
      <button
        type="button"
        className="sidebar__scrim"
        aria-label="Close navigation menu"
        onClick={onNavigate}
      />
    )}

    <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar__brand">
        <Emblem size={34} />
        <div className="sidebar__brand-text">
          <div className="sidebar__brand-title">{appName}</div>
          <div className="sidebar__brand-sub">{APP_SUBTITLE}</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        <NavGroup label="Workspace" links={CORE_LINKS} onNavigate={onNavigate} />
        <NavGroup label="Directory" links={DIRECTORY_LINKS} onNavigate={onNavigate} />
        {isAdmin && <NavGroup label="Administration" links={ADMIN_LINKS} onNavigate={onNavigate} />}
      </nav>

      <div className="sidebar__footer">
        <NavLink to="/profile" className="sidebar__user" onClick={onNavigate}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar">{initials(profile?.name, email)}</span>
          )}
          <span className="min-w-0">
            <span className="sidebar__user-name">{profile?.name || email}</span>
            <span className="sidebar__user-role">{isAdmin ? 'Administrator' : 'Operator'}</span>
          </span>
        </NavLink>
        <p className="sidebar__version">
          <strong>{appName}</strong> &middot; v1.0.0
        </p>
      </div>
    </aside>
  </>
);

export default Sidebar;
