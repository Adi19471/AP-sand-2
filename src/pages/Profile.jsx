import { useEffect, useState } from 'react';
import { KeyRound, Save, ShieldCheck, User } from 'lucide-react';
import GoogleMark from '../components/GoogleMark';
import { TextField } from '../components/FormField';
import { Spinner } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { updateOwnProfile } from '../services/userService';
import { ROLE_LABELS, ROLES } from '../utils/constants';
import { formatDateTime } from '../utils/dateUtils';
import { formatNumber } from '../utils/format';
import { friendlyError } from '../utils/errors';
import { digitsOnly, hasErrors, isIndianMobile, validatePasswordChange } from '../utils/validation';

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * The signed-in user's own name and mobile number. Sign-in is with Google,
 * so there is no password here - except for an account created before that,
 * which can still change the one it has.
 */
const Profile = () => {
  const { actor, profile, hasPassword, changeOwnPassword } = useAuth();
  const toast = useToast();

  const [details, setDetails] = useState({ name: '', mobile: '' });
  const [detailsErrors, setDetailsErrors] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);

  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setDetails({ name: profile?.name || '', mobile: profile?.mobile || '' });
  }, [profile?.name, profile?.mobile]);

  const saveDetails = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!details.name.trim()) errors.name = 'Name is required.';
    if (!isIndianMobile(details.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.';
    setDetailsErrors(errors);
    if (hasErrors(errors)) return;

    setSavingDetails(true);
    try {
      await updateOwnProfile(actor.uid, { name: details.name, mobile: details.mobile });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to update your profile.'));
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    const errors = validatePasswordChange(passwords);
    setPasswordErrors(errors);
    if (hasErrors(errors)) return;

    setSavingPassword(true);
    try {
      await changeOwnPassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords(EMPTY_PASSWORDS);
      toast.success('Password changed.');
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to change your password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const setPassword = (field) => (event) =>
    setPasswords((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Account</p>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">{profile?.email}</p>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <p className="kpi__label">Role</p>
          <p className="kpi__value flex items-center gap-1.5 text-base">
            {profile?.role === ROLES.ADMIN && <ShieldCheck size={16} className="shrink-0 text-brand-600" />}
            {ROLE_LABELS[profile?.role] || ROLE_LABELS.USER}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Member Since</p>
          <p className="kpi__value text-base">{formatDateTime(profile?.createdAt)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Last Login</p>
          <p className="kpi__value text-base">{formatDateTime(profile?.lastLoginAt)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Total Logins</p>
          <p className="kpi__value">{formatNumber(profile?.loginCount || 0)}</p>
        </div>
      </div>

      <div className="dash-grid dash-grid--even">
        <form className="card" onSubmit={saveDetails} noValidate>
          <div className="card__header">
            <h2 className="section-title">
              <User size={16} />
              Personal Details
            </h2>
          </div>
          <div className="card__body flex flex-col gap-4">
            <TextField
              id="profileName"
              label="Full Name"
              required
              value={details.name}
              maxLength={120}
              onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
              error={detailsErrors.name}
            />
            <TextField
              id="profileMobile"
              label="Mobile Number"
              required
              inputMode="numeric"
              value={details.mobile}
              maxLength={10}
              onChange={(e) =>
                setDetails((d) => ({ ...d, mobile: digitsOnly(e.target.value).slice(0, 10) }))
              }
              error={detailsErrors.mobile}
            />
            <TextField id="profileEmail" label="Email" value={profile?.email || ''} readOnly />
          </div>
          <div className="card__footer">
            <button type="submit" className="btn btn--primary" disabled={savingDetails}>
              {savingDetails ? <Spinner size={15} /> : <Save size={16} />}
              Save Details
            </button>
          </div>
        </form>

        {!hasPassword && (
          <section className="card">
            <div className="card__header">
              <h2 className="section-title">
                <ShieldCheck size={16} />
                Sign-in
              </h2>
            </div>
            <div className="card__body flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <GoogleMark size={22} />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-slate-900">Google account</p>
                  <p className="text-[12.5px] text-slate-500 wrap-anywhere">{profile?.email}</p>
                </div>
                <span className="badge badge--active ml-auto">Linked</span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-500">
                You sign in to AP SAND with this Google account, so there is no separate password
                here. Your password and 2-step verification are managed in your Google account.
              </p>
            </div>
          </section>
        )}

        {hasPassword && (
          <form className="card" onSubmit={savePassword} noValidate>
            <div className="card__header">
              <h2 className="section-title">
                <KeyRound size={16} />
                Change Password
              </h2>
            </div>
            <div className="card__body flex flex-col gap-4">
              <TextField
                id="currentPassword"
                label="Current Password"
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={setPassword('currentPassword')}
                error={passwordErrors.currentPassword}
              />
              <TextField
                id="newPassword"
                label="New Password"
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={setPassword('newPassword')}
                error={passwordErrors.newPassword}
                hint="At least 6 characters."
              />
              <TextField
                id="confirmPassword"
                label="Confirm New Password"
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={setPassword('confirmPassword')}
                error={passwordErrors.confirmPassword}
              />
            </div>
            <div className="card__footer">
              <button type="submit" className="btn btn--primary" disabled={savingPassword}>
                {savingPassword ? <Spinner size={15} /> : <KeyRound size={16} />}
                Change Password
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default Profile;
