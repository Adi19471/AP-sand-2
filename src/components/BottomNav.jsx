import { NavLink } from 'react-router-dom';
import { History, LayoutDashboard, Menu, Plus, ScanLine } from 'lucide-react';

/**
 * Thumb-reach navigation for phones: the four screens an operator lives in,
 * with "new receipt" raised in the middle, and the full menu on the right.
 * Hidden on wider screens (styles/layout.css) and never printed.
 */
const BottomNav = ({ onOpenMenu }) => (
  <nav className="bottom-nav no-print" aria-label="Quick navigation">
    <NavLink to="/dashboard" className="bottom-nav__item">
      <LayoutDashboard size={19} />
      Home
    </NavLink>
    <NavLink to="/receipts" end className="bottom-nav__item">
      <History size={19} />
      Receipts
    </NavLink>
    <NavLink to="/receipts/new" className="bottom-nav__item bottom-nav__item--primary">
      <span className="bottom-nav__fab">
        <Plus size={24} strokeWidth={2.6} />
      </span>
      New
    </NavLink>
    <NavLink to="/scan" className="bottom-nav__item">
      <ScanLine size={19} />
      Scan
    </NavLink>
    <button type="button" className="bottom-nav__item" onClick={onOpenMenu}>
      <Menu size={19} />
      Menu
    </button>
  </nav>
);

export default BottomNav;
