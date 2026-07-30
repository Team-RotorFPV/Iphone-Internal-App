import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

/**
 * Web replacement for expo-camera's barcode scanning. Opens the rear camera via
 * getUserMedia, decodes frames with jsQR, and calls `onDetect(rawString)` for
 * every successful decode (the caller throttles / latches). Also exposes torch
 * control where the device/browser supports it.
 *
 * Requires a secure context (HTTPS or localhost) — iOS Safari blocks camera on
 * plain http, so this works on the deployed Vercel site but not a LAN-IP dev URL.
 */
export function useCameraQr({ active, onDetect }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const [status, setStatus] = useState('idle'); // idle|starting|ready|denied|error|unsupported
  const [error, setError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('starting');
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() || {};
        setTorchAvailable(!!caps.torch);
        setStatus('ready');

        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = () => {
          if (cancelled) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const result = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
              if (result?.data) onDetectRef.current?.(result.data);
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') setStatus('denied');
        else setStatus('error');
        setError(err?.message || String(err));
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      /* torch not supported on this device */
    }
  }, [torchOn]);

  return { videoRef, status, error, torchOn, torchAvailable, toggleTorch };
}
