import { useEffect, useState } from 'react';
import { Printer, Receipt, Save, ShieldCheck, Truck } from 'lucide-react';
import { SelectField, TextField } from '../components/FormField';
import { Loading, Spinner } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { ADMIN_EMAILS } from '../firebase/firebaseConfig';
import { saveSettings } from '../services/settingsService';
import { PAPER_SIZES, SAND_UNITS, VEHICLE_TRIPS } from '../utils/constants';
import { friendlyError } from '../utils/errors';

const pick = (settings) => ({
  appName: settings.appName || '',
  receiptPrefix: settings.receiptPrefix || '',
  defaultSandUnit: settings.defaultSandUnit || SAND_UNITS[0],
  defaultSupplyPoint: settings.defaultSupplyPoint || '',
  paperSize: settings.paperSize || PAPER_SIZES[0].value,
  receiptFooterNote: settings.receiptFooterNote || '',
  showQrOnConsumerCopy: Boolean(settings.showQrOnConsumerCopy),
  vehicleTripTypes: settings.vehicleTripTypes?.length ? settings.vehicleTripTypes : VEHICLE_TRIPS,
});

const validate = (form) => {
  const errors = {};
  if (!form.appName.trim()) errors.appName = 'App name is required.';
  if (!/^[A-Z0-9]{1,6}$/.test(form.receiptPrefix)) {
    errors.receiptPrefix = 'Use 1 to 6 letters or digits, e.g. APS.';
  }
  if (!form.vehicleTripTypes.length) errors.vehicleTripTypes = 'Keep at least one vehicle trip.';
  return errors;
};

/** Receipt prefix, paper size, supply point and receipt defaults. */
const Settings = () => {
  const { actor } = useAuth();
  const { settings, loading } = useSettings();
  const toast = useToast();

  const [form, setForm] = useState(() => pick(settings));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Take the live values until the admin starts editing.
  useEffect(() => {
    if (!dirty) setForm(pick(settings));
  }, [settings, dirty]);

  const errors = validate(form);
  const showError = (field) => (submitted ? errors[field] : '');

  const set = (field, value) => {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleTrip = (trip) => {
    const next = form.vehicleTripTypes.includes(trip)
      ? form.vehicleTripTypes.filter((t) => t !== trip)
      : VEHICLE_TRIPS.filter((t) => t === trip || form.vehicleTripTypes.includes(t));
    set('vehicleTripTypes', next);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await saveSettings(
        { ...form, appName: form.appName.trim(), defaultSupplyPoint: form.defaultSupplyPoint.trim() },
        actor,
      );
      toast.success('Settings saved. Every operator picks them up immediately.');
      setDirty(false);
      setSubmitted(false);
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Applies to every operator as soon as you save.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="card__body">
          <fieldset className="fieldset">
            <legend>
              <Receipt size={13} />
              Receipt
            </legend>
            <div className="form-grid">
              <TextField
                id="appName"
                label="App Name (printed on receipt)"
                required
                value={form.appName}
                maxLength={40}
                onChange={(e) => set('appName', e.target.value)}
                error={showError('appName')}
              />
              <TextField
                id="receiptPrefix"
                label="Receipt Number Prefix"
                required
                value={form.receiptPrefix}
                maxLength={6}
                onChange={(e) =>
                  set('receiptPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                error={showError('receiptPrefix')}
                hint={`Next receipts look like ${form.receiptPrefix || 'APS'}-${new Date().getFullYear()}-000123`}
              />
              <TextField
                id="receiptFooterNote"
                label="Footer Note"
                value={form.receiptFooterNote}
                maxLength={60}
                placeholder="Thank You"
                onChange={(e) => set('receiptFooterNote', e.target.value)}
              />
              <label className="checkbox self-center">
                <input
                  type="checkbox"
                  checked={form.showQrOnConsumerCopy}
                  onChange={(e) => set('showQrOnConsumerCopy', e.target.checked)}
                />
                <span>Print the QR code on the Consumer Copy too (always on the Driver Copy)</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>
              <Printer size={13} />
              Printing &amp; Defaults
            </legend>
            <div className="form-grid">
              <SelectField
                id="paperSize"
                label="Default Paper Size"
                value={form.paperSize}
                onChange={(e) => set('paperSize', e.target.value)}
                options={PAPER_SIZES}
                hint="TVS MLP 3120 prints 72 mm wide on a 3 inch roll."
              />
              <SelectField
                id="defaultSandUnit"
                label="Default Sand Unit"
                value={form.defaultSandUnit}
                onChange={(e) => set('defaultSandUnit', e.target.value)}
                options={SAND_UNITS}
              />
              <TextField
                id="defaultSupplyPoint"
                label="Default Supply Point"
                value={form.defaultSupplyPoint}
                maxLength={120}
                placeholder="Reach / stockyard name"
                onChange={(e) => set('defaultSupplyPoint', e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>
              <Truck size={13} />
              Vehicle Trips Offered
            </legend>
            <div className="settings-checks">
              {VEHICLE_TRIPS.map((trip) => (
                <label className="checkbox" key={trip}>
                  <input
                    type="checkbox"
                    checked={form.vehicleTripTypes.includes(trip)}
                    onChange={() => toggleTrip(trip)}
                  />
                  <span>{trip}</span>
                </label>
              ))}
            </div>
            {showError('vehicleTripTypes') && (
              <p className="field__error mt-2.5" role="alert">
                {errors.vehicleTripTypes}
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset mb-0">
            <legend>
              <ShieldCheck size={13} />
              Permanent Administrators
            </legend>
            <p className="mb-3 text-[13px] text-slate-500">
              These accounts are always Administrators. Everyone else&apos;s access and role are
              managed on the Users &amp; Access page.
            </p>
            <ul className="settings-admins">
              {ADMIN_EMAILS.map((email) => (
                <li key={email}>
                  <span className="badge badge--admin">
                    <ShieldCheck size={11} />
                    Admin
                  </span>
                  {email}
                </li>
              ))}
            </ul>
          </fieldset>
        </div>

        <div className="card__footer">
          <div className="btn-group justify-end">
            <button
              type="button"
              className="btn btn--outline"
              disabled={!dirty || saving}
              onClick={() => {
                setForm(pick(settings));
                setDirty(false);
                setSubmitted(false);
              }}
            >
              Discard Changes
            </button>
            <button type="submit" className="btn btn--primary" disabled={!dirty || saving}>
              {saving ? <Spinner size={15} /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

export default Settings;
