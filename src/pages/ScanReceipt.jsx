import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, ImageUp, ScanLine, Search } from 'lucide-react';
import { Spinner } from '../components/Loading';
import { parseScannedCode } from '../components/QrCode';
import { useAuth } from '../hooks/useAuth';
import { findReceiptByCode } from '../services/receiptService';
import { friendlyError, logError } from '../utils/errors';

const SCAN_INTERVAL_MS = 250;
const MAX_FRAME = 720;

/** Native detector where the browser has one (Android Chrome), else null. */
const createNativeDetector = async () => {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
};

/** Decode a QR from a video frame or image with jsQR (loaded on first use). */
const decodeWithJsQr = async (source, canvas) => {
  const { default: jsQR } = await import('jsqr');
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) return null;

  const scale = Math.min(1, MAX_FRAME / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data || null;
};

/**
 * Scan a receipt QR with the device camera (or from a photo), or type a
 * receipt number / dispatch ID / hologram ID, and jump straight to that receipt.
 */
const ScanReceipt = () => {
  const navigate = useNavigate();
  const { actor } = useAuth();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const detectorRef = useRef(null);
  const handledRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  /** Send whatever was read to the right screen. */
  const handleText = useCallback(
    async (text) => {
      const parsed = parseScannedCode(text);
      if (!parsed) return;
      if (parsed.token) {
        navigate(`/v/${parsed.token}`);
        return;
      }
      if (parsed.receiptId) {
        navigate(`/receipts/${encodeURIComponent(parsed.receiptId)}`);
        return;
      }

      setLookingUp(true);
      setMessage('');
      try {
        const receipt = await findReceiptByCode(parsed.code, actor);
        if (receipt) navigate(`/receipts/${encodeURIComponent(receipt.id)}`);
        else setMessage(`No receipt found for "${parsed.code}".`);
      } catch (err) {
        setMessage(friendlyError(err, 'Unable to look up that receipt.'));
      } finally {
        setLookingUp(false);
      }
    },
    [actor, navigate],
  );

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || handledRef.current) return;

    try {
      let text = null;
      if (video.readyState >= 2) {
        if (detectorRef.current) {
          const found = await detectorRef.current.detect(video);
          text = found[0]?.rawValue || null;
        } else {
          text = await decodeWithJsQr(video, canvasRef.current);
        }
      }
      if (text) {
        handledRef.current = true;
        stop();
        if (navigator.vibrate) navigator.vibrate(80);
        await handleText(text);
        return;
      }
    } catch (err) {
      logError('ScanReceipt:frame', err);
    }
    timerRef.current = window.setTimeout(scanFrame, SCAN_INTERVAL_MS);
  }, [handleText, stop]);

  const start = async () => {
    setMessage('');
    handledRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('This browser cannot open the camera. Use "Scan from photo" or type the number.');
      return;
    }

    setStarting(true);
    try {
      detectorRef.current = await createNativeDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      timerRef.current = window.setTimeout(scanFrame, SCAN_INTERVAL_MS);
    } catch (err) {
      logError('ScanReceipt:camera', err);
      stop();
      setMessage(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in the browser settings and try again.'
          : 'Unable to open the camera. Use "Scan from photo" or type the number instead.',
      );
    } finally {
      setStarting(false);
    }
  };

  const scanImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const detector = await createNativeDetector();
      const text = detector
        ? (await detector.detect(image))[0]?.rawValue
        : await decodeWithJsQr(image, canvasRef.current);

      if (text) await handleText(text);
      else setMessage('No QR code found in that photo. Try a sharper, closer picture.');
    } catch (err) {
      logError('ScanReceipt:image', err);
      setMessage('Unable to read that image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const submitCode = (event) => {
    event.preventDefault();
    if (code.trim()) handleText(code.trim());
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Receipts</p>
          <h1 className="page-title">Scan QR</h1>
          <p className="page-subtitle">
            Point the camera at the QR code on a Driver Copy to open that dispatch.
          </p>
        </div>
      </div>

      <div className="scan-layout">
        <section className="card">
          <div className="card__body flex flex-col gap-4">
            <div className={`scan-viewport${scanning ? ' is-live' : ''}`}>
              <video ref={videoRef} playsInline muted aria-label="Camera preview" />
              {scanning ? (
                <span className="scan-viewport__frame" aria-hidden="true" />
              ) : (
                <div className="scan-viewport__idle">
                  <ScanLine size={42} />
                  <span>Camera is off</span>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} hidden />

            <div className="btn-group">
              {scanning ? (
                <button type="button" className="btn btn--outline" onClick={stop}>
                  <CameraOff size={16} />
                  Stop Camera
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={start} disabled={starting}>
                  {starting ? <Spinner size={15} /> : <Camera size={16} />}
                  {starting ? 'Opening camera…' : 'Start Camera'}
                </button>
              )}
              <label className="btn btn--outline">
                <ImageUp size={16} />
                Scan from Photo
                <input type="file" accept="image/*" hidden onChange={scanImage} />
              </label>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2 className="section-title">
              <Search size={16} />
              Or enter the number
            </h2>
          </div>
          <form className="card__body flex flex-col gap-3" onSubmit={submitCode}>
            <input
              className="input font-mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="APS-2026-000123, DSP2026… or Hologram ID"
              aria-label="Receipt number, dispatch ID or hologram ID"
              autoComplete="off"
            />
            <button type="submit" className="btn btn--primary" disabled={!code.trim() || lookingUp}>
              {lookingUp ? <Spinner size={15} /> : <Search size={16} />}
              Find Receipt
            </button>
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              Any phone camera can also scan the QR directly - it opens a verification page that
              works without logging in.
            </p>
          </form>
        </section>
      </div>

      {message && (
        <div className="alert alert--warning mt-4" role="alert">
          <div className="alert__body">{message}</div>
        </div>
      )}
    </>
  );
};

export default ScanReceipt;
