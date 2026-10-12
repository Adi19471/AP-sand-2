import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import Emblem from '../components/Emblem';
import { Spinner } from '../components/Loading';
import { parseScannedCode } from '../components/QrCode';
import { useAuth } from '../hooks/useAuth';
import {
  getReceiptById,
  getVerification,
  refreshVerification,
} from '../services/receiptService';
import { RECEIPT_STATUS } from '../utils/constants';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { formatQuantity } from '../utils/format';
import { logError } from '../utils/errors';

/** "Label : VALUE" line of the information card. */
const Row = ({ label, value }) => (
  <div className="sand-info__row">
    <dt>{label}</dt>
    <span aria-hidden="true">:</span>
    <dd>{value === null || value === undefined || value === '' ? '-' : value}</dd>
  </div>
);

/** Same date/time rule as the printed receipt. */
const stamp = (at, date, time) =>
  at ? formatDateTime(at) : `${date ? formatDate(date) : ''} ${time || ''}`.trim();

/** Mobile numbers read with the trunk prefix: 8121533027 -> 08121533027. */
const phone = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `0${digits}` : digits;
};

const quantity = (value) =>
  value === null || value === undefined || value === '' ? '' : formatQuantity(value);

/** "GENERAL SAND CONSUMPTION" -> "GENERAL CONSUMER" for the card badge. */
const consumerBadge = (type) => {
  const value = String(type || 'GENERAL SAND CONSUMPTION').toUpperCase();
  return value.endsWith(' SAND CONSUMPTION')
    ? `${value.replace(/ SAND CONSUMPTION$/, '')} CONSUMER`
    : value;
};

/** The information card, laid out like the department's consumer page. */
const InfoCard = ({ receipt }) => {
  const upper = (value) => String(value || '').toUpperCase();
  const vehicle = [receipt.vehicleNo, receipt.vehicleTrip].filter(Boolean).join(' / ');
  const driver = [upper(receipt.driverName), phone(receipt.driverMobile)].filter(Boolean).join(', ');
  const dispatched = `${quantity(receipt.sandQuantity)} ${receipt.sandUnit || ''}`.trim();

  return (
    <section className="sand-info__card">
      <div className="sand-info__badge">
        <ShoppingCart size={18} />
        {consumerBadge(receipt.registrationType)}
      </div>

      <dl className="sand-info__group">
        <Row label="Registration ID" value={receipt.orderId} />
        <Row label="Consumer Name" value={upper(receipt.customerName)} />
        <Row label="Consumer Mobile" value={phone(receipt.customerMobile)} />
        <Row label="Construction Name" value={receipt.constructionName} />
        <Row
          label="Registration Date"
          value={stamp(receipt.registrationAt, receipt.registrationDate, receipt.registrationTime)}
        />
        <Row label="Registration Type" value={upper(receipt.registrationType)} />
        <Row label="Registration QTY(in MT)" value={quantity(receipt.registrationQuantity)} />
        <Row label="Registration Address" value={receipt.registrationAddress} />
      </dl>

      <dl className="sand-info__group">
        <Row label="Available Sand Qty(in MT)" value={quantity(receipt.availableSand)} />
        <Row label="Eligible Sand QTY(in MT)" value={quantity(receipt.eligibleQuantity)} />
      </dl>

      <dl className="sand-info__group">
        <Row label="Dispatch ID" value={receipt.dispatchId} />
        <Row label="Trip Number" value={receipt.tripNo} />
        <Row label="Vehicle Number/Type" value={vehicle} />
        <Row label="Driver Name/Mobile No" value={driver} />
        <Row label="Dispatch Quantity(in MT)" value={dispatched} />
        <Row
          label="Dispatch Date Time"
          value={stamp(receipt.dispatchAt, receipt.dispatchDate, receipt.dispatchTime)}
        />
        <Row label="Dispatch Address" value={receipt.address} />
      </dl>
    </section>
  );
};

/**
 * Page the receipt QR code opens. Works without signing in, so anyone can
 * check a truck with a phone camera and see every detail of the dispatch
 * (the verification record carries the full copy). Styled after the
 * Department of Mines & Geology "Free Sand Information Details" page.
 *
 * Records saved before that copy existed hold identifiers only. They show
 * what they have until an administrator or the receipt's creator opens the
 * receipt in the app or scans it signed in, which upgrades the record.
 */
const VerifyReceipt = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [record, setRecord] = useState(null);
  const [state, setState] = useState('loading'); // loading | found | missing | error
  const [full, setFull] = useState(null);
  const [search, setSearch] = useState('');
  const [cleared, setCleared] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setState('loading');
    setCleared(false);
    getVerification(token)
      .then((found) => {
        if (!active) return;
        setRecord(found);
        setSearch(found?.orderId || '');
        setState(found ? 'found' : 'missing');
      })
      .catch((error) => {
        logError('VerifyReceipt', error);
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => load(), [load]);

  // An old identifiers-only record, scanned signed in: read the receipt
  // itself (the rules allow it for an administrator or the creator), show
  // it, and upgrade the record so the next scan by anyone shows it all too.
  const receiptId = record?.receiptId;
  const needsUpgrade = Boolean(record) && record.customerName === undefined;
  const uid = user?.uid;
  useEffect(() => {
    setFull(null);
    if (!uid || !receiptId || !needsUpgrade) return undefined;
    let active = true;
    getReceiptById(receiptId)
      .then((found) => {
        if (!active || !found) return;
        setFull(found);
        refreshVerification(found).catch((error) =>
          logError('VerifyReceipt:refreshVerification', error)
        );
      })
      .catch((error) => {
        if (error?.code !== 'permission-denied') logError('VerifyReceipt:full', error);
      });
    return () => {
      active = false;
    };
  }, [uid, receiptId, needsUpgrade]);

  /** Get: a pasted QR link opens that receipt; anything else reloads this one. */
  const handleGet = (event) => {
    event.preventDefault();
    const parsed = parseScannedCode(search);
    if (parsed?.token && parsed.token !== token) {
      navigate(`/v/${parsed.token}`);
      return;
    }
    load();
  };

  const handleClear = () => {
    setSearch('');
    setCleared(true);
  };

  const details = full || record;
  const cancelled = record?.status === RECEIPT_STATUS.CANCELLED;

  return (
    <div className="sand-info">
      <header className="sand-info__header">
        <Emblem size={52} />
        <div className="sand-info__brand">
          <div className="sand-info__title">AP SAND MANAGEMENT SYSTEM</div>
          <div className="sand-info__dept">Department of Mines &amp; Geology</div>
          <div className="sand-info__gov">Government of Andhra Pradesh</div>
        </div>
      </header>

      <div className="sand-info__banner">
        <h1>Free Sand Information Details</h1>
      </div>

      <main className="sand-info__body">
        <form className="sand-info__search" onSubmit={handleGet}>
          <input
            className="sand-info__input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Registration ID"
            placeholder="Registration ID"
          />
          <div className="sand-info__buttons">
            <button type="submit" className="sand-info__btn sand-info__btn--get">
              Get &rarr;
            </button>
            <button type="button" className="sand-info__btn sand-info__btn--clear" onClick={handleClear}>
              Clear &times;
            </button>
          </div>
        </form>

        {!cleared && state === 'loading' && (
          <div className="sand-info__message">
            <Spinner size={22} />
            Loading details…
          </div>
        )}

        {!cleared && state === 'missing' && (
          <div className="sand-info__message sand-info__message--bad">
            No details found for this QR code. Do not accept this dispatch.
          </div>
        )}

        {!cleared && state === 'error' && (
          <div className="sand-info__message sand-info__message--bad">
            Could not load the details. Check the internet connection and tap Get again.
          </div>
        )}

        {!cleared && state === 'found' && (
          <>
            {cancelled && (
              <div className="sand-info__message sand-info__message--bad">
                This dispatch was CANCELLED. Do not accept it.
              </div>
            )}
            <InfoCard receipt={details} />
          </>
        )}

        <p className="sand-info__foot">
          {user && state === 'found' ? (
            <Link to={`/receipts/${encodeURIComponent(record.receiptId)}`}>Open full receipt</Link>
          ) : (
            <Link to="/login" state={{ from: { pathname: `/v/${token}` } }}>
              Operator login
            </Link>
          )}
        </p>
      </main>
    </div>
  );
};

export default VerifyReceipt;
