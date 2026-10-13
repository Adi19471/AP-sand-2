import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Hash,
  MapPin,
  Package,
  RotateCcw,
  Save,
  Truck,
  User,
} from 'lucide-react';
import { SelectField, TextAreaField, TextField } from './FormField';
import VehicleTripSelect from './VehicleTripSelect';
import { Spinner } from './Loading';
import { SAND_UNITS } from '../utils/constants';
import { toInputDate, toInputTime } from '../utils/dateUtils';
import { suggestOrderId } from '../utils/receiptNumber';
import { digitsOnly, hasErrors, validateReceipt } from '../utils/validation';

const buildInitialForm = (settings = {}) => ({
  orderId: suggestOrderId(),
  tripNo: '1',
  customerName: '',
  customerMobile: '',
  sandQuantity: '',
  sandUnit: settings.defaultSandUnit || 'Cubic Meter',
  supplyPoint: settings.defaultSupplyPoint || '',
  dispatchDate: toInputDate(),
  dispatchTime: toInputTime(),
  registrationDate: toInputDate(),
  registrationTime: toInputTime(),
  registrationType: 'GENERAL SAND CONSUMPTION',
  registrationQuantity: '',
  eligibleQuantity: '',
  driverName: '',
  driverMobile: '',
  vehicleNo: '',
  vehicleTrip: '',
  address: '',
  registrationAddress: '',
  availableSand: '',
  constructionName: '',
  hologramId: '',
});

/**
 * "Enter Receipt Details" form.
 *
 * Validation runs on submit and re-runs per field once that field has been
 * touched, so the operator is not shouted at while still typing.
 */
const ReceiptForm = ({ settings = {}, submitting = false, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => buildInitialForm(settings));
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Adopt the administrator's defaults once settings have loaded.
  useEffect(() => {
    setForm((current) => ({
      ...current,
      sandUnit: current.sandUnit || settings.defaultSandUnit || 'Cubic Meter',
      supplyPoint: current.supplyPoint || settings.defaultSupplyPoint || '',
    }));
  }, [settings.defaultSandUnit, settings.defaultSupplyPoint]);

  const errors = useMemo(() => validateReceipt(form), [form]);

  const visibleError = useCallback(
    (field) => (submitAttempted || touched[field] ? errors[field] : ''),
    [errors, submitAttempted, touched],
  );

  const setValue = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      setValue(name, value);
    },
    [setValue],
  );

  const handleMobileChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      setValue(name, digitsOnly(value).slice(0, 10));
    },
    [setValue],
  );

  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
  }, []);

  const handleReset = () => {
    setForm(buildInitialForm(settings));
    setTouched({});
    setSubmitAttempted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors(errors)) {
      // Move focus to the first problem so long forms stay usable.
      const firstField = Object.keys(errors)[0];
      document.getElementById(firstField)?.focus();
      return;
    }
    onSubmit(form);
  };

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="card__body">
        {/* ------------------------------------------------ order details */}
        <fieldset className="fieldset">
          <legend>
            <Hash size={13} />
            Order Details
          </legend>
          <div className="form-grid">
            <TextField
              id="orderId"
              name="orderId"
              label="Order ID"
              required
              value={form.orderId}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('orderId')}
              placeholder="ORD202608150001"
              maxLength={64}
              autoComplete="off"
            />
            <TextField
              id="tripNo"
              name="tripNo"
              label="Trip No"
              value={form.tripNo}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('tripNo')}
              inputMode="numeric"
              placeholder="1"
            />
            <TextField
              id="dispatchId"
              name="dispatchId"
              label="Dispatch ID"
              value=""
              readOnly
              placeholder="Assigned on save"
              hint="Generated automatically when you save."
              autoComplete="off"
            />
            <TextField
              id="hologramId"
              name="hologramId"
              label="Hologram ID"
              value={form.hologramId}
              onChange={(event) => setValue('hologramId', event.target.value.toUpperCase())}
              onBlur={handleBlur}
              placeholder="Enter hologram ID"
              maxLength={64}
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        </fieldset>

        {/* --------------------------------------------- customer details */}
        <fieldset className="fieldset">
          <legend>
            <User size={13} />
            Customer Details
          </legend>
          <div className="form-grid">
            <TextField
              id="customerName"
              name="customerName"
              label="Customer Name"
              required
              value={form.customerName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('customerName')}
              placeholder="Full name of the consumer"
              maxLength={120}
            />
            <TextField
              id="customerMobile"
              name="customerMobile"
              label="Customer Mobile No"
              required
              value={form.customerMobile}
              onChange={handleMobileChange}
              onBlur={handleBlur}
              error={visibleError('customerMobile')}
              hint="10-digit Indian mobile number"
              inputMode="numeric"
              placeholder="9876543210"
              maxLength={10}
            />
            <TextField
              id="constructionName"
              name="constructionName"
              label="Construction Name"
              icon={Building2}
              value={form.constructionName}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Site or project name"
              maxLength={120}
            />
            <TextAreaField
              id="address"
              name="address"
              label="Address"
              full
              rows={2}
              value={form.address}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Delivery address"
              maxLength={300}
            />
          </div>
        </fieldset>

        {/* ------------------------------------------------- sand details */}
        <fieldset className="fieldset">
          <legend>
            <Package size={13} />
            Sand Details
          </legend>
          <div className="form-grid">
            <TextField
              id="sandQuantity"
              name="sandQuantity"
              label="Sand Quantity"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.sandQuantity}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('sandQuantity')}
              placeholder="0.00"
              inputMode="decimal"
            />
            <SelectField
              id="sandUnit"
              name="sandUnit"
              label="Sand Unit"
              required
              value={form.sandUnit}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('sandUnit')}
              options={SAND_UNITS}
            />
            <TextField
              id="supplyPoint"
              name="supplyPoint"
              label="Sand Supply Point Name"
              icon={MapPin}
              value={form.supplyPoint}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Reach / stockyard name"
              maxLength={120}
            />
            <TextField
              id="availableSand"
              name="availableSand"
              label="Available Sand"
              type="number"
              min="0"
              step="0.01"
              value={form.availableSand}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('availableSand')}
              hint="Stock remaining at the supply point"
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
        </fieldset>

        {/* -------------------------------------------- dispatch schedule */}
        <fieldset className="fieldset">
          <legend>
            <CalendarClock size={13} />
            Dispatch &amp; Registration
          </legend>
          <div className="form-grid">
            <TextField
              id="dispatchDate"
              name="dispatchDate"
              label="Dispatch Date"
              required
              type="date"
              value={form.dispatchDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('dispatchDate')}
            />
            <TextField
              id="dispatchTime"
              name="dispatchTime"
              label="Dispatch Time"
              required
              type="time"
              step="1"
              value={form.dispatchTime}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('dispatchTime')}
            />
            <TextField
              id="registrationDate"
              name="registrationDate"
              label="Registration Date"
              type="date"
              value={form.registrationDate}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <TextField
              id="registrationTime"
              name="registrationTime"
              label="Registration Time"
              type="time"
              step="1"
              value={form.registrationTime}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <TextField
              id="registrationType"
              name="registrationType"
              label="Registration Type"
              value={form.registrationType}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="GENERAL SAND CONSUMPTION"
              maxLength={60}
            />
            <TextField
              id="registrationQuantity"
              name="registrationQuantity"
              label="Registration QTY (in MT)"
              type="number"
              min="0"
              step="0.01"
              value={form.registrationQuantity}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('registrationQuantity')}
              placeholder="0.00"
              inputMode="decimal"
            />
            <TextField
              id="eligibleQuantity"
              name="eligibleQuantity"
              label="Eligible Sand QTY (in MT)"
              type="number"
              min="0"
              step="0.01"
              value={form.eligibleQuantity}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('eligibleQuantity')}
              placeholder="0.00"
              inputMode="decimal"
            />
            <TextAreaField
              id="registrationAddress"
              name="registrationAddress"
              label="Registration Address"
              full
              rows={2}
              value={form.registrationAddress}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Address recorded at registration"
              maxLength={300}
            />
          </div>
        </fieldset>

        {/* --------------------------------------------- vehicle & driver */}
        <fieldset className="fieldset mb-0">
          <legend>
            <Truck size={13} />
            Vehicle &amp; Driver
          </legend>
          <div className="form-grid">
            <TextField
              id="driverName"
              name="driverName"
              label="Driver Name"
              required
              value={form.driverName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('driverName')}
              placeholder="Full name of the driver"
              maxLength={120}
            />
            <TextField
              id="driverMobile"
              name="driverMobile"
              label="Driver Mobile No"
              required
              value={form.driverMobile}
              onChange={handleMobileChange}
              onBlur={handleBlur}
              error={visibleError('driverMobile')}
              hint="10-digit Indian mobile number"
              inputMode="numeric"
              placeholder="9876543210"
              maxLength={10}
            />
            <TextField
              id="vehicleNo"
              name="vehicleNo"
              label="Vehicle No"
              required
              value={form.vehicleNo}
              onChange={(event) => setValue('vehicleNo', event.target.value.toUpperCase())}
              onBlur={handleBlur}
              error={visibleError('vehicleNo')}
              placeholder="AP16TA1234"
              maxLength={24}
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
            />
            <VehicleTripSelect
              value={form.vehicleTrip}
              onChange={handleChange}
              onBlur={handleBlur}
              error={visibleError('vehicleTrip')}
              options={settings.vehicleTripTypes}
            />
          </div>
        </fieldset>
      </div>

      <div className="card__footer">
        <div className="btn-group justify-end">
          {onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          )}
          <button type="button" className="btn btn--outline" onClick={handleReset} disabled={submitting}>
            <RotateCcw size={15} />
            Reset Form
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? <Spinner size={15} /> : <Save size={16} />}
            {submitting ? 'Generating…' : 'Generate Receipt'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReceiptForm;
