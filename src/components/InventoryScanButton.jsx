import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Folder, Box } from 'lucide-react';
import QRScannerModal from './QRScannerModal';
import { AppButton, AppModal, AppListItem } from './ui';
import { TagsService } from '../services/assetTags';
import { InventoryService } from '../services/inventory';
import { decideScanAction } from '../lib/scanResolver';
import { alertConfirm, toast } from '../lib/toast';

// Context-aware scan entry point. Renders a trigger, the camera scanner, and
// every follow-up flow (bind picker, move-here confirm, navigation, retired /
// error messaging).
//   surface:        'home' | 'list' | 'folder'
//   containerId:    the list/folder id the user is inside (bind/move target)
//   bindCandidates: [{ type:'inventory'|'item', id, name }] an unassigned tag
//                   may bind to here
//   variant:        'button' | 'compact' | 'fab'
export default function InventoryScanButton({
  surface,
  containerId = null,
  allInvs = [],
  bindCandidates = [],
  variant = 'button',
  label = 'Scan',
}) {
  const navigate = useNavigate();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [bindState, setBindState] = useState(null); // { code }

  const invName = (id) => allInvs.find((i) => i.id === id)?.name || 'its current location';

  const navigateToEntity = useCallback(
    async (entity) => {
      if (entity.type === 'inventory') {
        const inv = await InventoryService.getInventory(entity.id);
        if (!inv) return toast.error('That folder no longer exists.');
        navigate(`/inventory/folder/${inv.id}`, { state: { inventoryName: inv.name } });
      } else if (entity.type === 'item') {
        const it = await InventoryService.getItem(entity.id);
        if (!it) return toast.error('That item no longer exists.');
        navigate(`/inventory/item/${it.id}`, { state: { itemData: it } });
      }
    },
    [navigate]
  );

  const moveEntityHere = useCallback(
    async (entity) => {
      try {
        if (entity.type === 'item') {
          await InventoryService.updateItem(entity.id, { inventoryId: containerId });
        } else {
          await InventoryService.moveInventory(
            entity.id,
            { type: 'inventory', id: containerId, name: invName(containerId) },
            allInvs
          );
        }
        toast.success('Moved here.');
      } catch {
        toast.error('Could not move it here. Please try again.');
      }
    },
    [containerId, allInvs] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleResolved = useCallback(
    async (action) => {
      const { entity, offers } = action;
      if (offers.includes('move')) {
        const label2 = entity.type === 'item' ? 'item' : 'folder';
        let locationId = null;
        if (entity.type === 'item') locationId = (await InventoryService.getItem(entity.id))?.inventoryId;
        else locationId = (await InventoryService.getInventory(entity.id))?.parentInventoryId;

        if (locationId === containerId) return navigateToEntity(entity);

        // 2-option web confirm: OK = move here, Cancel = just open its page.
        alertConfirm({
          title: 'Tagged entity',
          message: `This ${label2} currently sits at "${invName(locationId)}".\n\nMove it into "${invName(containerId)}"?\n(Cancel just opens its page.)`,
          confirmLabel: 'Move here',
          onConfirm: () => moveEntityHere(entity),
          onCancel: () => navigateToEntity(entity),
        });
      } else {
        navigateToEntity(entity);
      }
    },
    [navigateToEntity, moveEntityHere, containerId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleRetired = (action) => {
    const superseded = action.supersededBy;
    if (superseded) {
      alertConfirm({
        title: 'Retired label',
        message: `This label was retired. This asset now uses tag ${superseded}. Open the current tag?`,
        confirmLabel: 'Open current tag',
        onConfirm: async () => {
          const resolved = await TagsService.getByCode(superseded);
          if (resolved.status === 'active') {
            navigateToEntity({ type: resolved.tag.entityType, id: resolved.tag.entityId });
          } else {
            toast.error('The replacement tag could not be resolved.');
          }
        },
      });
    } else {
      toast('This label was retired and has no active replacement.');
    }
  };

  const processScan = useCallback(
    async (rawCode) => {
      setScannerVisible(false);
      let resolved;
      try {
        resolved = await TagsService.getByCode(rawCode);
      } catch {
        return toast.error('Could not look up that code. Check your connection.');
      }
      const action = decideScanAction(resolved, { surface, containerId });

      switch (action.kind) {
        case 'error':
          toast.error(action.reason === 'invalid' ? "That doesn't look like a valid tag code." : 'This tag is not in the system yet.');
          break;
        case 'retired':
          handleRetired(action);
          break;
        case 'bind_no_context':
          toast("This tag isn't linked yet. Open a folder and scan to bind it there.");
          break;
        case 'bind':
          if (bindCandidates.length === 0) toast('There are no sub-folders or items here to link this tag to yet.');
          else setBindState({ code: rawCode });
          break;
        case 'resolved':
          handleResolved(action);
          break;
        default:
          break;
      }
    },
    [surface, containerId, bindCandidates.length, handleResolved] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const doBind = async (candidate) => {
    const code = bindState?.code;
    setBindState(null);
    const res = await TagsService.bindTag({ code, entityType: candidate.type, entityId: candidate.id });
    if (res.ok) toast.success(`This tag is now bound to "${candidate.name}".`);
    else toast.error(`Binding failed (${res.reason}).`);
  };

  const renderTrigger = () => {
    if (variant === 'compact') {
      return (
        <button type="button" className="appbar-icon-btn" onClick={() => setScannerVisible(true)} aria-label="Scan">
          <QrCode size={20} />
        </button>
      );
    }
    if (variant === 'fab') {
      return (
        <button type="button" className="fab fab-icon-only" onClick={() => setScannerVisible(true)} aria-label="Scan">
          <QrCode size={22} color="#09090B" />
        </button>
      );
    }
    return (
      <AppButton variant="secondary" size="sm" onClick={() => setScannerVisible(true)} icon={<QrCode size={14} />}>
        {label}
      </AppButton>
    );
  };

  return (
    <>
      {renderTrigger()}

      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={processScan}
        title="Scan tag"
        subtitle={surface === 'folder' ? 'Bind, hold, or move — depending on the tag' : 'Point at a QR label'}
      />

      <AppModal visible={!!bindState} onClose={() => setBindState(null)} title="Link tag to…">
        <p className="t-body-secondary" style={{ marginTop: 0, marginBottom: 12 }}>
          Choose which entity here this new tag belongs to.
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {bindCandidates.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Nothing here to bind to.</p>
          ) : (
            bindCandidates.map((item) => (
              <AppListItem
                key={`${item.type}:${item.id}`}
                title={item.name || (item.type === 'item' ? 'Unnamed item' : 'Unnamed folder')}
                description={item.type === 'item' ? 'Item' : 'Sub-folder'}
                leftIcon={
                  <div className="icon-well" style={{ width: 34, height: 34, background: 'var(--surface)' }}>
                    {item.type === 'item' ? <Box size={16} color="#A855F7" /> : <Folder size={16} color="#38BDF8" />}
                  </div>
                }
                onClick={() => doBind(item)}
              />
            ))
          )}
        </div>
      </AppModal>
    </>
  );
}
