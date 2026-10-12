import { useEffect, useState } from 'react';
import { AlertCircle, Mail, UserCheck } from 'lucide-react';
import GoogleMark from './GoogleMark';
import { SelectField, TextField } from './FormField';
import { Spinner } from './Loading';
import { ROLE_LABELS, ROLES } from '../utils/constants';
import { hasErrors, validateAccessGrant } from '../utils/validation';

const EMPTY = { email: '', name: '', role: ROLES.USER };

const ROLE_OPTIONS = [
  { value: ROLES.USER, label: ROLE_LABELS.USER },
  { value: ROLES.ADMIN, label: ROLE_LABELS.ADMIN },
];

const ROLE_HINTS = {
  [ROLES.USER]: 'Generates receipts and sees only the receipts they created.',
  [ROLES.ADMIN]: 'Sees every receipt and manages users, reports and settings.',
};

/**
 * The form an administrator uses to approve a Google account by its e-mail
 * address, before that account has ever signed in.
 *
 * @param {string} [error] A failure reported by the caller, e.g. the address
 *                         already has access.
 */
const GrantAccessDialog = ({ open, busy = false, error = '', onSubmit, onCancel }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  // A fresh form every time the dialog opens.
  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const set = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateAccessGrant(form);
    setErrors(validation);
    if (hasErrors(validation)) return;
    onSubmit({
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
      role: form.role,
    });
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="dialog__header">
          <span className="dialog__icon border border-slate-200 bg-white shadow-xs">
            <GoogleMark size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="dialog__title" id="grant-title">
              Add a Google account
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              The person signs in with this Google account - no password is created here.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
          <TextField
            id="grantEmail"
            type="email"
            label="Google account email"
            required
            icon={Mail}
            value={form.email}
            onChange={set('email')}
            error={errors.email}
            placeholder="name@gmail.com"
            autoComplete="off"
            autoFocus
          />
          <TextField
            id="grantName"
            label="Name"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
            hint="Optional. Shown in the list until they sign in for the first time."
            maxLength={120}
            autoComplete="off"
          />
          <SelectField
            id="grantRole"
            label="Role"
            value={form.role}
            onChange={set('role')}
            options={ROLE_OPTIONS}
            hint={ROLE_HINTS[form.role]}
          />

          {error && (
            <div className="alert alert--error" role="alert">
              <AlertCircle size={17} className="alert__icon" />
              <div className="alert__body">{error}</div>
            </div>
          )}
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner size={15} /> : <UserCheck size={16} />}
            {busy ? 'Saving…' : 'Approve Account'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GrantAccessDialog;
