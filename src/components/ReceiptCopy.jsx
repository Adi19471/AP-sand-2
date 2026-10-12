import Emblem from './Emblem';
import QrCode, { buildQrPayload } from './QrCode';
import { APP_SUBTITLE, DEFAULT_SAND_UNIT } from '../utils/constants';
import { formatDate, formatDateTime, formatTime } from '../utils/dateUtils';
import { formatQuantity, maskMobile } from '../utils/format';

/** Label left, value right - a plain receipt line. */
const Row = ({ label, value }) => (
  <div className="receipt-row">
    <span className="receipt-row__label">{label}</span>
    <span className="receipt-row__value">{value || '-'}</span>
  </div>
);

/** Cubic Meter is the standard unit, so the receipt leaves its name off. */
const printedUnit = (unit) => (!unit || unit === DEFAULT_SAND_UNIT ? '' : unit);

/** "Label: value" on a line of its own, for free text that needs room to wrap. */
const BlockRow = ({ label, value }) =>
  value ? (
    <div className="receipt-row receipt-row--block">
      <span className="receipt-row__label">{label}:</span>{' '}
      <span className="receipt-row__value">{value}</span>
    </div>
  ) : null;

/**
 * One receipt copy - Consumer or Driver.
 *
 * Both carry the same information (spec section 14); the Driver copy adds the
 * QR verification block and the "Thank You" line.
 *
 * Deliberately plain: emblem beside the title, the copy name underlined, then
 * label / value lines in groups separated by space alone - no boxes, rules or
 * leaders. Paper sizes re-lay it out in styles/print.css.
 */
const ReceiptCopy = ({
  receipt,
  copy = 'CONSUMER',
  showQr = false,
  footerNote = 'Thank You',
  appName = 'AP SAND',
}) => {
  const isDriver = copy === 'DRIVER';
  const dispatchStamp = receipt.dispatchAt
    ? formatDateTime(receipt.dispatchAt)
    : `${formatDate(receipt.dispatchDate)} ${receipt.dispatchTime || ''}`.trim();
  const registrationStamp = receipt.registrationAt
    ? formatDateTime(receipt.registrationAt)
    : `${formatDate(receipt.registrationDate)} ${receipt.registrationTime || ''}`.trim();
  const hasAddressBlock = Boolean(
    receipt.address || receipt.registrationAddress || receipt.constructionName,
  );

  return (
    <section className="receipt-copy" aria-label={`${isDriver ? 'Driver' : 'Consumer'} copy`}>
      <header className="receipt-head">
        <Emblem size={48} printable className="receipt-seal" />
        <div className="receipt-head__text">
          <div className="receipt-head__title">{appName}</div>
          <div className="receipt-head__subtitle">{APP_SUBTITLE}</div>
        </div>
      </header>

      <div className="receipt-copy-title">{isDriver ? 'Driver Copy' : 'Consumer Copy'}</div>

      <div className="receipt-rows">
        <div className="receipt-group">
          <Row label="Receipt ID" value={receipt.receiptId} />
          <Row label="Order ID" value={receipt.orderId} />
          <Row label="Dispatch ID" value={receipt.dispatchId} />
          <Row label="Trip No" value={receipt.tripNo} />
        </div>

        <div className="receipt-group">
          <Row label="Customer Name" value={receipt.customerName} />
          <Row label="Customer Mobile" value={maskMobile(receipt.customerMobile)} />
          <Row
            label="Sand Quantity"
            value={`${formatQuantity(receipt.sandQuantity)} ${printedUnit(receipt.sandUnit)}`.trim()}
          />
          <Row label="Sand Supply Point" value={receipt.supplyPoint} />
          {receipt.availableSand !== null && receipt.availableSand !== undefined && receipt.availableSand !== '' && (
            <Row label="Available Sand" value={formatQuantity(receipt.availableSand)} />
          )}
          <Row label="Dispatch Date" value={dispatchStamp} />
          {registrationStamp && registrationStamp !== '-' && (
            <Row label="Registration" value={registrationStamp} />
          )}
        </div>

        <div className="receipt-group">
          <Row label="Driver Name" value={receipt.driverName} />
          <Row label="Driver Mobile" value={maskMobile(receipt.driverMobile)} />
          <Row label="Vehicle No" value={receipt.vehicleNo} />
          <Row label="Vehicle Trip" value={receipt.vehicleTrip} />
        </div>

        {hasAddressBlock && (
          <div className="receipt-group">
            <BlockRow label="Address" value={receipt.address} />
            <BlockRow label="Registration Address" value={receipt.registrationAddress} />
            <BlockRow label="Construction Name" value={receipt.constructionName} />
          </div>
        )}
      </div>

      {receipt.status === 'CANCELLED' && <div className="receipt-status-stamp">CANCELLED</div>}

      {showQr && (
        <>
          <div className="receipt-qr">
            <div className="receipt-qr__frame">
              <QrCode value={buildQrPayload(receipt)} size={118} />
            </div>
            <p className="receipt-qr__caption">Scan to verify this dispatch</p>
          </div>
          <p className="receipt-thanks">{footerNote || 'Thank You'}</p>
        </>
      )}

      <p className="receipt-foot">
        Issued by {receipt.createdByEmail || 'system'}
        <br />
        Printed on {formatDate(new Date())} at {formatTime(new Date())}
        <br />
        This is a computer generated receipt.
      </p>
    </section>
  );
};

export default ReceiptCopy;
