import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileSearch, ListChecks, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Loading } from '../components/Loading';
import ReceiptPreview from '../components/ReceiptPreview';
import ReceiptSummary from '../components/ReceiptSummary';
import { StatusBadge } from './ReceiptHistory';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import {
  attachVerification,
  cancelReceipt,
  deleteReceipt,
  getReceiptById,
  refreshVerification,
} from '../services/receiptService';
import { RECEIPT_STATUS } from '../utils/constants';
import { friendlyError, logError } from '../utils/errors';

/** One receipt: reprint it, and (administrators) cancel or delete it. */
const ReceiptDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { actor, isAdmin } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // 'cancel' | 'delete' | null
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getReceiptById(id)
      .then(async (found) => {
        if (!active) return;
        if (!found) {
          setReceipt(null);
          return;
        }
        setReceipt(found);
        // Receipts saved before QR verification existed get a verification
        // record now, so a reprint carries a QR that opens the details page.
        if (!found.verifyToken) {
          try {
            const upgraded = await attachVerification(found);
            if (active) setReceipt(upgraded);
          } catch (err) {
            logError('ReceiptDetails:attachVerification', err);
          }
        } else if (isAdmin || found.createdBy === actor?.uid) {
          // Receipts printed while the QR page showed only identifiers get
          // the full copy now, so their existing QR shows every detail.
          refreshVerification(found).catch((err) =>
            logError('ReceiptDetails:refreshVerification', err)
          );
        }
      })
      .catch((err) => {
        if (active) setError(friendlyError(err, 'Unable to load this receipt.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setReason('');
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      const updated = await cancelReceipt(receipt, actor, reason);
      setReceipt({ ...updated, cancelReason: reason, cancelledAt: new Date() });
      toast.success(`Receipt ${receipt.receiptId} cancelled.`);
      setDialog(null);
      setReason('');
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to cancel this receipt.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteReceipt(receipt, actor);
      toast.success(`Receipt ${receipt.receiptId} deleted.`);
      navigate('/receipts', { replace: true });
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to delete this receipt.'));
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Loading receipt…" />;

  if (error || !receipt) {
    return (
      <EmptyState
        icon={FileSearch}
        title={error ? 'Receipt unavailable' : 'Receipt not found'}
        message={error || `No receipt with the number ${id} exists, or it is not yours to view.`}
        action={
          <Link to="/receipts" className="btn btn--outline">
            <ArrowLeft size={16} />
            Back to Receipt History
          </Link>
        }
      />
    );
  }

  const cancelled = receipt.status === RECEIPT_STATUS.CANCELLED;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <p className="breadcrumb">
            <Link to="/receipts">Receipts</Link> / {receipt.receiptId}
          </p>
          <h1 className="page-title">
            {receipt.receiptId} <StatusBadge status={receipt.status} />
          </h1>
          <p className="page-subtitle">
            {receipt.vehicleNo} &middot; {receipt.vehicleTrip} &middot; {receipt.customerName}
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/receipts" className="btn btn--outline">
            <ArrowLeft size={16} />
            Back
          </Link>
          {isAdmin && !cancelled && (
            <button type="button" className="btn btn--outline" onClick={() => setDialog('cancel')}>
              <Ban size={16} />
              Cancel Receipt
            </button>
          )}
          {isAdmin && (
            <button type="button" className="btn btn--danger" onClick={() => setDialog('delete')}>
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="preview-layout">
        <ReceiptPreview receipt={receipt} settings={settings} />

        <aside className="preview-summary no-print">
          <section className="card">
            <div className="card__header">
              <h2 className="section-title">
                <ListChecks size={16} />
                Receipt Details
              </h2>
            </div>
            <div className="card__body">
              <ReceiptSummary receipt={receipt} />
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        tone="warning"
        title={`Cancel receipt ${receipt.receiptId}?`}
        message="The receipt stays on record but is removed from dispatch totals, and its QR code will show CANCELLED when scanned."
        confirmLabel="Cancel Receipt"
        cancelLabel="Keep"
        busy={busy}
        onConfirm={handleCancel}
        onCancel={closeDialog}
      >
        <label className="field mt-3.5">
          <span className="field__label">Reason (optional)</span>
          <textarea
            className="textarea"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        tone="danger"
        title={`Delete receipt ${receipt.receiptId}?`}
        message="This permanently removes the receipt and its QR verification. This cannot be undone - prefer Cancel if you only need to void it."
        confirmLabel="Delete Permanently"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={closeDialog}
      />
    </>
  );
};

export default ReceiptDetails;
