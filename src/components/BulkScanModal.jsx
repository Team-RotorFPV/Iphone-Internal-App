import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Box, Folder, Check, Flashlight } from 'lucide-react';
import { AppButton } from './ui';
import { TagsService } from '../services/assetTags';
import { InventoryService } from '../services/inventory';
import { useCameraQr } from './qr/useCameraQr';
import { toast } from '../lib/toast';
import './qr/qr.css';

// Bulk scan: keep the camera live, stage each resolved entity, then commit all
// the moves into the current container in one go.
export default function BulkScanModal({ visible, onClose, containerId, containerName, allInvs = [] }) {
  const [staged, setStaged] = useState([]); // [{ type, id, name }]
  const [skipped, setSkipped] = useState(0);
  const [committing, setCommitting] = useState(false);
  const lastScan = useRef({ code: null, at: 0 });

  useEffect(() => {
    if (visible) {
      setStaged([]);
      setSkipped(0);
      lastScan.current = { code: null, at: 0 };
    }
  }, [visible]);

  const onDetect = useCallback(
    async (data) => {
      const now = Date.now();
      if (data === lastScan.current.code && now - lastScan.current.at < 3000) return;
      if (now - lastScan.current.at < 700) return;
      lastScan.current = { code: data, at: now };

      const resolved = await TagsService.getByCode(data).catch(() => ({ status: 'error' }));
      if (resolved.status !== 'active') {
        setSkipped((s) => s + 1);
        return;
      }
      const entity = { type: resolved.tag.entityType, id: resolved.tag.entityId };
      if (entity.id === containerId) return;
      let added = false;
      setStaged((prev) => {
        if (prev.some((e) => e.id === entity.id)) return prev;
        added = true;
        return [...prev, { ...entity, name: '…' }];
      });
      if (!added) return;
      const docData =
        entity.type === 'item' ? await InventoryService.getItem(entity.id) : await InventoryService.getInventory(entity.id);
      setStaged((prev) => prev.map((e) => (e.id === entity.id ? { ...e, name: docData?.name || e.id } : e)));
    },
    [containerId]
  );

  const { videoRef, status, torchAvailable, toggleTorch, torchOn } = useCameraQr({ active: visible, onDetect });
  const removeStaged = (id) => setStaged((prev) => prev.filter((e) => e.id !== id));

  const commit = async () => {
    if (staged.length === 0) return;
    try {
      setCommitting(true);
      await Promise.all(
        staged.map((e) =>
          e.type === 'item'
            ? InventoryService.updateItem(e.id, { inventoryId: containerId })
            : InventoryService.moveInventory(e.id, { type: 'inventory', id: containerId, name: containerName }, allInvs)
        )
      );
      toast.success(`Moved ${staged.length} item${staged.length === 1 ? '' : 's'} into "${containerName}".`);
      onClose?.();
    } catch (error) {
      console.error('Bulk commit failed:', error);
      toast.error('Some moves could not be saved. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  if (!visible) return null;
  const cameraFailed = status === 'denied' || status === 'error' || status === 'unsupported';

  return createPortal(
    <div className="qr-screen">
      <div className="qr-header">
        <span className="qr-title" style={{ fontSize: 16 }}>Bulk scan → {containerName}</span>
        <button type="button" className="qr-close" onClick={onClose} aria-label="Close">
          <X size={22} color="#fff" />
        </button>
      </div>

      {cameraFailed ? (
        <div className="qr-centered">
          <p className="qr-info">
            {status === 'denied' ? 'Camera access is needed to bulk scan. Enable it in your browser settings.' : "This browser can't access the camera."}
          </p>
        </div>
      ) : (
        <div className="qr-camera">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="qr-video" muted playsInline />
          <div className="qr-counter">
            {staged.length} staged{skipped > 0 ? ` · ${skipped} skipped` : ''}
          </div>
          {torchAvailable && (
            <div className="qr-controls">
              <button type="button" className="qr-ctrl" onClick={toggleTorch}>
                <Flashlight size={22} color={torchOn ? 'var(--accent)' : '#fff'} />
                <span>Torch</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="qr-tray">
        <div className="qr-staged-list">
          {staged.length === 0 ? (
            <div className="qr-empty-tray">Scan tags to stage them here.</div>
          ) : (
            staged.map((item) => (
              <div key={item.id} className="qr-staged-row">
                {item.type === 'item' ? <Box size={16} color="#A855F7" /> : <Folder size={16} color="#38BDF8" />}
                <span className="qr-staged-name">{item.name}</span>
                <button type="button" onClick={() => removeStaged(item.id)} aria-label="Remove" style={{ display: 'flex' }}>
                  <X size={16} color="var(--text-muted)" />
                </button>
              </div>
            ))
          )}
        </div>
        <AppButton
          variant="primary"
          onClick={commit}
          loading={committing}
          disabled={staged.length === 0}
          icon={<Check size={16} color="#09090B" />}
          fullWidth
          style={{ marginTop: 12 }}
        >
          {staged.length > 0 ? `Move ${staged.length} here` : 'Nothing staged'}
        </AppButton>
      </div>
    </div>,
    document.body
  );
}
