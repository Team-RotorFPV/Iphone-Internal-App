import { useCallback } from 'react';
import QRScannerModal from './QRScannerModal';
import { TagsService } from '../services/assetTags';
import { toast } from '../lib/toast';

// Focused "attach/replace a QR for THIS entity" flow. Used right after creating
// a folder/sub-folder/item (mode 'attach') and to re-tag an entity whose label
// was destroyed (mode 'replace' → old tag retired, new one bound).
// entity: { type: 'inventory' | 'item', id, name }
export default function AttachTagModal({ visible, onClose, entity, mode = 'attach' }) {
  const onScan = useCallback(
    async (rawCode) => {
      onClose?.();
      if (!entity?.id) return;

      let resolved;
      try {
        resolved = await TagsService.getByCode(rawCode);
      } catch {
        return toast.error('Could not look up that code. Check your connection.');
      }

      switch (resolved.status) {
        case 'invalid':
          return toast.error("That doesn't look like a valid tag.");
        case 'not_found':
          return toast.error('This tag is not in the system yet.');
        case 'active':
          return toast.error('That tag is already bound to something else.');
        case 'retired':
          return toast.error("That tag has been retired and can't be reused.");
        case 'unassigned': {
          const res =
            mode === 'replace'
              ? await TagsService.retireAndReissue({ entityType: entity.type, entityId: entity.id, newCode: rawCode })
              : await TagsService.bindTag({ code: rawCode, entityType: entity.type, entityId: entity.id });
          if (res.ok) {
            toast.success(
              mode === 'replace'
                ? `"${entity.name}" now uses the new tag. The old label is retired.`
                : `"${entity.name}" is now linked to this tag.`
            );
          } else {
            toast.error(`Operation failed (${res.reason}).`);
          }
          return undefined;
        }
        default:
          return undefined;
      }
    },
    [entity, onClose, mode]
  );

  if (!visible) return null;

  return (
    <QRScannerModal
      visible
      onClose={onClose}
      onScan={onScan}
      title={mode === 'replace' ? `Replace tag for ${entity?.name || 'entity'}` : `Attach tag to ${entity?.name || 'new entity'}`}
      subtitle="Scan an unused QR label"
    />
  );
}
