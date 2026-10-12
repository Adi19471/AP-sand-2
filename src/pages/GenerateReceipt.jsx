import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FilePlus2, FileText, Info, ListChecks } from 'lucide-react';
import ReceiptForm from '../components/ReceiptForm';
import ReceiptPreview from '../components/ReceiptPreview';
import ReceiptSummary from '../components/ReceiptSummary';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { createReceipt } from '../services/receiptService';
import { friendlyError } from '../utils/errors';

/**
 * "Enter Receipt Details" -> save to Firestore -> receipt preview.
 *
 * The generated receipt stays on screen until the operator explicitly starts
 * a new one, so it can never be wiped before it has been printed.
 */
const GenerateReceipt = () => {
  const { actor } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError('');
    try {
      const saved = await createReceipt(form, actor, settings);
      setReceipt(saved);
      toast.success(`Receipt ${saved.receiptId} generated successfully.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message = friendlyError(err, 'Unable to save receipt. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    setReceipt(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* -------------------------------------------------------- preview mode */
  if (receipt) {
    return (
      <>
        <div className="page-head no-print">
          <div>
            <p className="breadcrumb">Generate Receipt / Preview</p>
            <h1 className="page-title">Receipt Preview</h1>
            <p className="page-subtitle">
              Consumer Copy and Driver Copy print together on one roll.
            </p>
          </div>
          <div className="page-head__actions">
            <button type="button" className="btn btn--primary" onClick={startNew}>
              <FilePlus2 size={16} />
              Create New Receipt
            </button>
            <Link to="/receipts" className="btn btn--outline">
              <FileText size={16} />
              Receipt History
            </Link>
          </div>
        </div>

        <div className="success-banner no-print mb-5">
          <span className="success-banner__icon">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <p className="success-banner__title">Receipt saved to Firestore</p>
            <p className="success-banner__text">
              Receipt <strong>{receipt.receiptId}</strong> was stored successfully and is already
              counted on every open dashboard.
            </p>
          </div>
        </div>

        <div className="preview-layout">
          <ReceiptPreview receipt={receipt} settings={settings} />

          <aside className="preview-summary no-print">
            <section className="card">
              <div className="card__header">
                <h2 className="section-title">
                  <ListChecks size={16} />
                  Saved Details
                </h2>
              </div>
              <div className="card__body">
                <ReceiptSummary receipt={receipt} />
              </div>
            </section>

            <div className="alert alert--info">
              <Info size={17} className="alert__icon" />
              <div className="alert__body">
                Printing sends only the receipt to paper. The sidebar, header, buttons and form are
                excluded automatically.
              </div>
            </div>
          </aside>
        </div>
      </>
    );
  }

  /* ----------------------------------------------------------- form mode */
  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Receipts / New</p>
          <h1 className="page-title">Enter Receipt Details</h1>
          <p className="page-subtitle">
            Fields marked <span className="font-semibold text-red-600">*</span> are required. The
            receipt number is allocated automatically when you save.
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/receipts" className="btn btn--outline">
            <FileText size={16} />
            Receipt History
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert--error mb-4" role="alert">
          <Info size={17} className="alert__icon" />
          <div className="alert__body">{error}</div>
        </div>
      )}

      <ReceiptForm settings={settings} submitting={submitting} onSubmit={handleSubmit} />
    </>
  );
};

export default GenerateReceipt;
