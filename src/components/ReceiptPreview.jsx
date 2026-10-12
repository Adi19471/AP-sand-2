import { useEffect, useRef, useState } from 'react';
import { Download, ImageDown, Printer } from 'lucide-react';
import ReceiptCopy from './ReceiptCopy';
import { Spinner } from './Loading';
import { useToast } from '../hooks/useToast';
import { DEFAULT_PAPER_SIZE, PAPER_SIZES } from '../utils/constants';
import {
  exportElementToPdf,
  preloadExportTools,
  printReceipt,
  shareThermalImage,
} from '../utils/pdf';
import { fileStamp } from '../utils/dateUtils';
import { friendlyError } from '../utils/errors';

/**
 * The printable receipt: Consumer Copy, a dotted separator, then the Driver
 * Copy with the QR code. `#receipt-print-area` is the only element the print
 * stylesheet lets through to paper.
 */
const ReceiptPreview = ({
  receipt,
  settings = {},
  showActions = true,
  onAfterPrint,
  extraActions = null,
}) => {
  const sheetRef = useRef(null);
  const toast = useToast();
  const [paperSize, setPaperSize] = useState(settings.paperSize || DEFAULT_PAPER_SIZE);
  const [exporting, setExporting] = useState(false);
  const [imaging, setImaging] = useState(false);

  // The share sheet only opens while the tap is still "fresh", so have the
  // capture library ready before anyone taps Printer Image.
  useEffect(() => {
    if (receipt) preloadExportTools();
  }, [receipt]);

  if (!receipt) return null;

  const appName = settings.appName || 'AP SAND';
  const footerNote = settings.receiptFooterNote || 'Thank You';
  const isThermal = paperSize !== 'A4';

  const handlePrint = () => {
    printReceipt(paperSize, sheetRef.current);
    onAfterPrint?.();
  };

  const handlePrinterImage = async () => {
    setImaging(true);
    try {
      const result = await shareThermalImage(sheetRef.current, {
        paperSize,
        fileName: `AP-SAND-${receipt.receiptId || 'receipt'}-${fileStamp()}.png`,
        title: `AP SAND ${receipt.receiptId || 'Receipt'}`,
      });
      if (result === 'downloaded') {
        toast.success('Printer image saved. Open it in your printer app to print.');
      }
    } catch (error) {
      toast.error(friendlyError(error, 'Unable to create the printer image. Please try again.'));
    } finally {
      setImaging(false);
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const name = `AP-SAND-${receipt.receiptId || 'receipt'}-${fileStamp()}.pdf`;
      await exportElementToPdf(sheetRef.current, { fileName: name, paperSize });
      toast.success('Receipt PDF downloaded.');
    } catch (error) {
      toast.error(friendlyError(error, 'Unable to generate the PDF. Please try printing instead.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="receipt-stage">
      {showActions && (
        <div className="receipt-actions no-print">
          <button type="button" className="btn btn--primary" onClick={handlePrint}>
            <Printer size={16} />
            Print Receipt
          </button>
          {isThermal && (
            <button
              type="button"
              className="btn btn--outline"
              onClick={handlePrinterImage}
              disabled={imaging}
            >
              {imaging ? <Spinner size={15} /> : <ImageDown size={16} />}
              {imaging ? 'Preparing…' : 'Printer Image'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleDownload}
            disabled={exporting}
          >
            {exporting ? <Spinner size={15} /> : <Download size={16} />}
            {exporting ? 'Preparing…' : 'Download PDF'}
          </button>
          <select
            className="select"
            value={paperSize}
            aria-label="Paper size"
            onChange={(event) => setPaperSize(event.target.value)}
          >
            {PAPER_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
          {extraActions}
        </div>
      )}

      {showActions && isThermal && (
        <p className="receipt-hint no-print">
          <strong>Phone + Bluetooth printer:</strong> tap <strong>Printer Image</strong> and share it
          to your printer app - it is made at the TVS MLP 3120&apos;s own 576-dot width, so set the
          app&apos;s paper to 3 inch / 72 mm and print it without cropping or resizing.{' '}
          <strong>Computer:</strong> in the print dialog pick the
          thermal printer, paper 3 inch / 72 mm, <strong>Margins: None</strong>,{' '}
          <strong>Scale: 100</strong>.
        </p>
      )}

      <div id="receipt-print-area">
        <div className="receipt-sheet" ref={sheetRef}>
          <ReceiptCopy
            receipt={receipt}
            copy="CONSUMER"
            appName={appName}
            footerNote={footerNote}
            showQr={Boolean(settings.showQrOnConsumerCopy)}
          />

          {/* A blank gap between the copies - no line is printed. */}
          <hr className="receipt-divider receipt-divider--strong" />

          <ReceiptCopy
            receipt={receipt}
            copy="DRIVER"
            appName={appName}
            footerNote={footerNote}
            showQr
          />
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
