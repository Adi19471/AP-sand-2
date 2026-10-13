import { formatDateTime } from '../utils/dateUtils';
import { formatQuantity, maskMobile } from '../utils/format';

const Item = ({ label, children, mono = false }) => (
  <div className="summary-list__row">
    <dt>{label}</dt>
    <dd className={mono ? 'font-mono text-[0.92em]' : undefined}>{children}</dd>
  </div>
);

/** Every stored field of a receipt as a label / value list (screen only). */
const ReceiptSummary = ({ receipt }) => (
  <dl className="summary-list">
    <Item label="Receipt ID" mono>
      {receipt.receiptId}
    </Item>
    <Item label="Dispatch ID" mono>
      {receipt.dispatchId || '-'}
    </Item>
    <Item label="Hologram ID" mono>
      {receipt.hologramId || '-'}
    </Item>
    <Item label="Order ID">{receipt.orderId}</Item>
    <Item label="Trip No">{receipt.tripNo || '-'}</Item>
    <Item label="Customer">
      {receipt.customerName}
      <br />
      <span className="font-medium text-slate-500">{maskMobile(receipt.customerMobile)}</span>
    </Item>
    <Item label="Driver">
      {receipt.driverName}
      <br />
      <span className="font-medium text-slate-500">{maskMobile(receipt.driverMobile)}</span>
    </Item>
    <Item label="Vehicle">
      {receipt.vehicleNo}
      <br />
      <span className="font-medium text-slate-500">{receipt.vehicleTrip}</span>
    </Item>
    <Item label="Quantity">
      {formatQuantity(receipt.sandQuantity)} {receipt.sandUnit}
    </Item>
    <Item label="Supply Point">{receipt.supplyPoint || '-'}</Item>
    {receipt.constructionName && <Item label="Construction">{receipt.constructionName}</Item>}
    {receipt.address && <Item label="Address">{receipt.address}</Item>}
    <Item label="Dispatched">
      {receipt.dispatchAt
        ? formatDateTime(receipt.dispatchAt)
        : `${receipt.dispatchDate || ''} ${receipt.dispatchTime || ''}`.trim() || '-'}
    </Item>
    <Item label="Created">{formatDateTime(receipt.createdAt)}</Item>
    <Item label="Created By">
      <span className="wrap-anywhere">{receipt.createdByEmail}</span>
    </Item>
    {receipt.status === 'CANCELLED' && (
      <Item label="Cancelled">
        {formatDateTime(receipt.cancelledAt)}
        {receipt.cancelReason && (
          <>
            <br />
            <span className="font-medium text-slate-500">{receipt.cancelReason}</span>
          </>
        )}
      </Item>
    )}
  </dl>
);

export default ReceiptSummary;
