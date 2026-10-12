import { useEffect, useRef } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Spinner } from './Loading';

const ICONS = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

/**
 * Blocking confirmation used before any destructive action - cancelling a
 * receipt, deleting a record, disabling an account.
 */
const ConfirmDialog = ({
  open,
  tone = 'danger',
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    confirmRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const Icon = ICONS[tone] || ShieldAlert;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog__header">
          <span className={`dialog__icon dialog__icon--${tone}`}>
            <Icon size={20} />
          </span>
          <h2 className="dialog__title" id="confirm-title">
            {title}
          </h2>
        </div>

        <div className="dialog__body">
          {message}
          {children}
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner size={15} />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
