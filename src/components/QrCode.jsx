import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PUBLIC_APP_URL } from '../utils/constants';
import { logError } from '../utils/errors';

/**
 * QR code rendered to a PNG data URL.
 *
 * A data URL (rather than a <canvas>) is deliberate: html2canvas captures it
 * reliably when the receipt is exported to PDF, and it survives being cloned
 * into the print layout.
 */
const QrCode = ({ value, size = 118, margin = 1, alt = 'Receipt verification QR code', onReady }) => {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setDataUrl('');
      return undefined;
    }

    QRCode.toDataURL(String(value), {
      errorCorrectionLevel: 'M',
      margin,
      width: size * 2, // Render at 2x so thermal printers stay sharp.
      color: { dark: '#000000ff', light: '#ffffffff' }, // pure black for thermal heads
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setFailed(false);
          onReady?.(true);
        }
      })
      .catch((error) => {
        logError('QrCode', error);
        if (!cancelled) {
          setFailed(true);
          // Still signal readiness: the receipt must remain printable even if
          // the QR could not be produced.
          onReady?.(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // `onReady` is a notification callback; re-running on its identity would
    // regenerate the QR on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size, margin]);

  if (failed || (!dataUrl && !value)) {
    return (
      <div className="receipt-qr__placeholder" style={{ width: size, height: size }}>
        QR unavailable
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="receipt-qr__placeholder" style={{ width: size, height: size }}>
        Generating…
      </div>
    );
  }

  return <img src={dataUrl} alt={alt} width={size} height={size} style={{ width: size, height: size }} />;
};

/** Public page a receipt's QR code opens, e.g. `https://…/v/Ab3…`. */
export const verificationUrl = (token) => `${PUBLIC_APP_URL}/v/${encodeURIComponent(token)}`;

/**
 * Verification payload for the QR code.
 *
 * Receipts with a verification token encode a link, so any phone camera
 * opens the public verification page. Older receipts keep the original text
 * payload - deliberately limited to identifiers and vehicle details, no
 * customer name, mobile numbers or address (spec section 15).
 */
export const buildQrPayload = (receipt) =>
  receipt.verifyToken
    ? verificationUrl(receipt.verifyToken)
    : [
        `AP SAND RECEIPT`,
        `RID:${receipt.receiptId || ''}`,
        `ORD:${receipt.orderId || ''}`,
        `VEH:${receipt.vehicleNo || ''}`,
        `TRIP:${receipt.vehicleTrip || ''}`,
        `QTY:${receipt.sandQuantity ?? ''} ${receipt.sandUnit || ''}`.trim(),
        `DSP:${receipt.dispatchId || ''}`,
      ].join('|');

/**
 * Understand anything the scanner reads.
 *
 * @returns {{ token: string } | { receiptId: string } | { code: string } | null}
 */
export const parseScannedCode = (text) => {
  const value = String(text || '').trim();
  if (!value) return null;

  const link = value.match(/\/v\/([A-Za-z0-9]+)/);
  if (link) return { token: link[1] };

  const legacy = value.match(/RID:([^|]+)/);
  if (legacy) return { receiptId: legacy[1].trim() };

  return { code: value };
};

export default QrCode;
