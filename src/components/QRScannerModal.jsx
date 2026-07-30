import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Flashlight, Keyboard as KeyboardIcon, QrCode } from 'lucide-react';
import { AppButton, AppInput } from './ui';
import { useCameraQr } from './qr/useCameraQr';
import { normalizeCode, isValidCode } from '../lib/shortCode';
import './qr/qr.css';

// Full-screen QR scanner. Emits the RAW scanned string via onScan — callers
// resolve it through TagsService.getByCode. Includes a manual-entry fallback so
// a scratched/soaked label can still be typed in (codes are human-readable).
export default function QRScannerModal({
  visible,
  onClose,
  onScan,
  title = 'Scan a tag',
  subtitle = 'Point the camera at a QR label',
}) {
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setManualMode(false);
      setManualCode('');
    }
  }, [visible]);

  const handleDetect = (data) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScan?.(data);
  };

  const { videoRef, status, torchOn, torchAvailable, toggleTorch } = useCameraQr({
    active: visible && !manualMode,
    onDetect: handleDetect,
  });

  const submitManual = () => onScan?.(normalizeCode(manualCode));
  const manualValid = isValidCode(manualCode);
  const cameraFailed = status === 'denied' || status === 'error' || status === 'unsupported';

  if (!visible) return null;

  return createPortal(
    <div className="qr-screen">
      <div className="qr-header">
        <span className="qr-title">{title}</span>
        <button type="button" className="qr-close" onClick={onClose} aria-label="Close">
          <X size={22} color="#fff" />
        </button>
      </div>

      {manualMode ? (
        <div className="qr-manual">
          <div className="qr-perm-title">Enter tag code</div>
          <p className="qr-info">Type the code printed under the QR.</p>
          <AppInput
            value={manualCode}
            onChangeText={(t) => setManualCode(t.toUpperCase())}
            placeholder="e.g. K7M2QX90"
            autoCapitalize="characters"
            autoFocus
            containerStyle={{ marginTop: 16 }}
          />
          {manualCode.length > 0 && !manualValid && (
            <div className="qr-invalid">Code looks incomplete or mistyped.</div>
          )}
          <div className="row gap-sm" style={{ marginTop: 16 }}>
            <AppButton variant="ghost" onClick={() => setManualMode(false)} style={{ flex: 1 }}>
              Back to scanner
            </AppButton>
            <AppButton variant="primary" onClick={submitManual} disabled={!manualValid} style={{ flex: 1 }}>
              Look up
            </AppButton>
          </div>
        </div>
      ) : cameraFailed ? (
        <div className="qr-centered">
          <QrCode size={48} color="var(--text-secondary)" />
          <div className="qr-perm-title">Camera unavailable</div>
          <p className="qr-info">
            {status === 'denied'
              ? 'Camera access was blocked. Enable it in your browser settings, or enter the code manually.'
              : status === 'unsupported'
                ? "This browser can't access the camera. Enter the code manually."
                : 'Could not start the camera. Enter the code manually.'}
          </p>
          <AppButton variant="secondary" onClick={() => setManualMode(true)} icon={<KeyboardIcon size={16} />} style={{ marginTop: 16 }}>
            Enter code manually
          </AppButton>
        </div>
      ) : (
        <div className="qr-camera">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="qr-video" muted playsInline />
          <div className="qr-overlay">
            <div className="qr-reticle" />
            <div className="qr-hint">{subtitle}</div>
          </div>
          <div className="qr-controls">
            {torchAvailable && (
              <button type="button" className="qr-ctrl" onClick={toggleTorch}>
                <Flashlight size={22} color={torchOn ? 'var(--accent)' : '#fff'} />
                <span>Torch</span>
              </button>
            )}
            <button type="button" className="qr-ctrl" onClick={() => setManualMode(true)}>
              <KeyboardIcon size={22} color="#fff" />
              <span>Enter code</span>
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
