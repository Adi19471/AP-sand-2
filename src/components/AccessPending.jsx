import { useState } from 'react';
import { Hourglass, LogOut } from 'lucide-react';
import Emblem from './Emblem';
import GoogleMark from './GoogleMark';
import { Spinner } from './Loading';
import { APP_NAME, APP_SUBTITLE } from '../utils/constants';
import { logError } from '../utils/errors';

/**
 * Shown to a Google account that has signed in but has not been approved by
 * an administrator yet. The profile is watched live, so this screen gives
 * way to the app by itself the moment access is granted.
 */
const AccessPending = ({ email, name, onSignOut }) => {
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    try {
      await onSignOut();
    } catch (error) {
      logError('AccessPending:signOut', error);
      setLeaving(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="auth-card text-center">
        <div className="mb-7 flex items-center justify-center gap-3 text-left">
          <Emblem size={44} />
          <div>
            <div className="text-[19px] leading-none font-extrabold tracking-[0.14em] text-slate-900">
              {APP_NAME}
            </div>
            <div className="mt-1.5 text-[10.5px] font-semibold tracking-[0.22em] text-brand-700 uppercase">
              {APP_SUBTITLE}
            </div>
          </div>
        </div>

        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
          <Hourglass size={28} />
        </span>

        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Waiting for approval</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
          {name ? `${name}, your` : 'Your'} Google account is signed in, but an administrator has
          not approved it yet. This page opens the app by itself as soon as access is given.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left">
          <GoogleMark size={20} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
              Signed in as
            </p>
            <p className="text-[13.5px] font-semibold text-slate-900 wrap-anywhere">{email}</p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Ask your administrator to approve this address under <strong>Users &amp; Access</strong>.
        </p>

        <button
          type="button"
          className="btn btn--outline btn--block mt-5"
          onClick={signOut}
          disabled={leaving}
        >
          {leaving ? <Spinner size={15} /> : <LogOut size={16} />}
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
};

export default AccessPending;
