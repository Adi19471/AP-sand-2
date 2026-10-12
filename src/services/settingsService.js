/**
 * Application settings stored in `settings/app`.
 * Readable by every signed-in operator, writable by administrators only.
 */
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auditLogsCol, db, settingsDoc, SETTINGS_IDS } from '../firebase/firestore';
import {
  APP_NAME,
  AUDIT_ACTIONS,
  DEFAULT_PAPER_SIZE,
  DEFAULT_RECEIPT_PREFIX,
  DEFAULT_SAND_UNIT,
  VEHICLE_TRIPS,
} from '../utils/constants';
import { logError } from '../utils/errors';
import { queueAuditLog } from './auditService';

export const DEFAULT_SETTINGS = {
  appName: APP_NAME,
  receiptPrefix: DEFAULT_RECEIPT_PREFIX,
  defaultSandUnit: DEFAULT_SAND_UNIT,
  vehicleTripTypes: VEHICLE_TRIPS,
  paperSize: DEFAULT_PAPER_SIZE,
  defaultSupplyPoint: '',
  receiptFooterNote: 'Thank You',
  allowUserReceiptEdit: true,
  showQrOnConsumerCopy: false,
};

const normalise = (data) => ({
  ...DEFAULT_SETTINGS,
  ...(data || {}),
  vehicleTripTypes:
    Array.isArray(data?.vehicleTripTypes) && data.vehicleTripTypes.length
      ? data.vehicleTripTypes
      : VEHICLE_TRIPS,
});

export const fetchSettings = async () => {
  try {
    const snapshot = await getDoc(settingsDoc(SETTINGS_IDS.APP));
    return normalise(snapshot.exists() ? snapshot.data() : null);
  } catch (error) {
    logError('fetchSettings', error);
    return { ...DEFAULT_SETTINGS };
  }
};

export const subscribeSettings = (onChange, onError) =>
  onSnapshot(
    settingsDoc(SETTINGS_IDS.APP),
    (snapshot) => onChange(normalise(snapshot.exists() ? snapshot.data() : null)),
    (error) => {
      logError('subscribeSettings', error);
      onError?.(error);
      onChange({ ...DEFAULT_SETTINGS });
    },
  );

export const saveSettings = async (patch, actor) => {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');

  await setDoc(
    settingsDoc(SETTINGS_IDS.APP),
    {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null,
      updatedByEmail: actor?.email || null,
    },
    { merge: true },
  );

  try {
    const batch = writeBatch(db);
    queueAuditLog(batch, doc(auditLogsCol()), {
      action: AUDIT_ACTIONS.UPDATE_SETTINGS,
      userId: actor.uid,
      email: actor.email,
      targetId: SETTINGS_IDS.APP,
      metadata: { fields: Object.keys(patch) },
    });
    await batch.commit();
  } catch (error) {
    logError('saveSettings:audit', error);
  }
};
