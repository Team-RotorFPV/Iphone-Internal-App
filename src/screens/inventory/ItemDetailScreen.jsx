import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Box, Edit2, Trash2, Clock, User, Tag, Hash, Check, UserCheck, CornerDownRight } from 'lucide-react';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import AttachTagModal from '../../components/AttachTagModal';
import { resolveEffectiveHolder } from '../../lib/custody';
import { getHolderName } from '../../lib/inventoryHelpers';
import { AppCard, AppSection, AppButton, AppInput, AppBadge, AppSkeleton } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

export default function ItemDetailScreen() {
  const { itemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialItemData = location.state?.itemData || null;
  const myEmail = useAuthStore((s) => s.user?.email);

  const [item, setItem] = useState(initialItemData);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', quantity: '0', category: '' });
  const [saving, setSaving] = useState(false);
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [allInvs, setAllInvs] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    const inventoryId = initialItemData?.inventoryId;
    if (!inventoryId) return;
    const unsubscribe = InventoryService.subscribeToItems(inventoryId, (items) => {
      const found = items.find((i) => i.id === itemId);
      if (found) setItem(found);
    });
    const unsubInvs = InventoryService.subscribeToAllInventories(setAllInvs);
    const unsubUsers = UsersService.subscribeToUsers(setUsersList);
    return () => {
      unsubscribe();
      unsubInvs();
      unsubUsers();
    };
  }, [itemId, initialItemData]);

  // Custody: an item can be held on its own. An explicit holder overrides the
  // inherited folder holder; releasing reverts it.
  const holderInfo = resolveEffectiveHolder(item, 'item', allInvs);
  const iHoldExplicitly = item?.currentHolder && item.currentHolder === myEmail;

  const doHold = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.holdItem(itemId, myEmail);
    } catch (error) {
      console.error('Error holding item:', error);
      toast.error('Could not hold this item. Please try again.');
    } finally {
      setCustodyBusy(false);
    }
  };

  const handleHold = () => {
    if (item?.currentHolder && item.currentHolder !== myEmail) {
      alertConfirm({
        title: 'Take custody?',
        message: `This item is currently held by ${getHolderName(item.currentHolder, usersList)}. Take it anyway?`,
        confirmLabel: 'Take it',
        onConfirm: doHold,
      });
    } else {
      doHold();
    }
  };

  const handleRelease = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.releaseItem(itemId);
    } catch {
      toast.error('Could not release this item. Please try again.');
    } finally {
      setCustodyBusy(false);
    }
  };

  const handleEditToggle = () => {
    if (!isEditing && item) {
      setEditForm({
        name: item.name || '',
        quantity: item.quantity ? item.quantity.toString() : '0',
        category: item.category || '',
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await InventoryService.updateItem(itemId, {
        name: editForm.name,
        quantity: parseInt(editForm.quantity, 10) || 0,
        category: editForm.category,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item details');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    alertConfirm({
      title: 'Delete Equipment Item',
      message: 'Permanently delete this item? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await InventoryService.deleteItem(itemId);
          navigate(-1);
        } catch (error) {
          console.error('Error deleting item:', error);
          toast.error('Failed to delete item');
        }
      },
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return String(timestamp);
    }
  };

  const MetaRow = ({ label, value, icon }) =>
    value ? (
      <div className="detail-row">
        <span className="detail-label meta-line">
          {icon}
          {label}
        </span>
        <span className="detail-value">{value}</span>
      </div>
    ) : null;

  if (!item) {
    return (
      <Screen title="Item Detail" showBack>
        <AppSkeleton width="100%" height={120} style={{ marginBottom: 16 }} />
        <AppSkeleton width="100%" height={200} />
      </Screen>
    );
  }

  return (
    <Screen title="Item Detail" showBack>
      <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
        <div className="grow" style={{ marginRight: 12 }}>
          <div className="row gap-sm" style={{ marginBottom: 6 }}>
            <Box size={18} color="#A855F7" />
            <AppBadge variant={item.quantity > 0 ? 'success' : 'danger'}>
              {item.quantity > 0 ? 'In Stock' : 'Depleted'}
            </AppBadge>
          </div>
          <h1 className="page-title" style={{ fontSize: 26 }}>
            {isEditing ? 'Edit Item Details' : item.name}
          </h1>
        </div>
        {!isEditing && (
          <div className="row gap-sm">
            <AppButton variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={handleEditToggle} />
            <AppButton variant="danger" size="sm" icon={<Trash2 size={14} color="#EF4444" />} onClick={handleDelete} />
          </div>
        )}
      </div>

      {isEditing ? (
        <AppSection title="Modify Specification" style={{ marginTop: 16 }}>
          <AppInput
            label="Item Name"
            value={editForm.name}
            onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))}
            placeholder="e.g. T-Motor Velox V2"
            autoFocus
          />
          <AppInput
            label="Stock Quantity"
            value={editForm.quantity}
            onChangeText={(t) => setEditForm((p) => ({ ...p, quantity: t }))}
            inputMode="numeric"
            placeholder="0"
          />
          <AppInput
            label="Category / Tag"
            value={editForm.category}
            onChangeText={(t) => setEditForm((p) => ({ ...p, category: t }))}
            placeholder="e.g. Motors, ESC, Frame"
          />
          <div className="row gap-sm" style={{ marginTop: 8 }}>
            <AppButton variant="ghost" onClick={handleEditToggle} style={{ flex: 1 }} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={saving} icon={<Check size={16} color="#09090B" />}>
              Save Changes
            </AppButton>
          </div>
        </AppSection>
      ) : (
        <>
          <div className="stat-row" style={{ marginTop: 16 }}>
            <AppCard variant="elevated" className="stat-pill" flush style={{ textAlign: 'left' }}>
              <div className="icon-well" style={{ width: 36, height: 36, background: '#38BDF815', marginBottom: 12 }}>
                <Hash size={18} color="#38BDF8" />
              </div>
              <div className="stat-label" style={{ textAlign: 'left' }}>Current Stock</div>
              <div className="stat-value" style={{ fontSize: 28, textAlign: 'left' }}>{item.quantity || 0}</div>
            </AppCard>
            <AppCard variant="elevated" className="stat-pill" flush style={{ textAlign: 'left' }}>
              <div className="icon-well" style={{ width: 36, height: 36, background: '#A855F715', marginBottom: 12 }}>
                <Tag size={18} color="#A855F7" />
              </div>
              <div className="stat-label" style={{ textAlign: 'left' }}>Category</div>
              <div className="stat-value" style={{ fontSize: 20, textAlign: 'left' }}>{item.category || 'General'}</div>
            </AppCard>
          </div>

          <AppSection title="Custody" style={{ marginTop: 18 }}>
            <div className="row-between">
              <div className="grow">
                <div className="detail-label">Held by</div>
                <div className="t-body" style={{ fontWeight: 600, marginTop: 2 }}>
                  {holderInfo.holder ? getHolderName(holderInfo.holder, usersList) : 'Unassigned'}
                </div>
                {holderInfo.source === 'inherited' && (
                  <div className="meta-line" style={{ marginTop: 2 }}>
                    <CornerDownRight size={12} /> via {holderInfo.from?.name || 'parent folder'}
                  </div>
                )}
              </div>
              {iHoldExplicitly ? (
                <AppButton variant="secondary" size="sm" onClick={handleRelease} loading={custodyBusy}>
                  Release
                </AppButton>
              ) : (
                <AppButton variant="primary" size="sm" onClick={handleHold} loading={custodyBusy} icon={<UserCheck size={14} color="#09090B" />}>
                  Hold this
                </AppButton>
              )}
            </div>
            <div className="detail-row" style={{ marginTop: 12 }}>
              <span className="detail-label">QR Tag</span>
              <span className="row gap-sm">
                <span className="detail-value" style={{ fontFamily: 'monospace' }}>{item.activeTagId || 'None'}</span>
                <AppButton variant="ghost" size="sm" onClick={() => setTagModalOpen(true)}>
                  {item.activeTagId ? 'Replace' : 'Attach'}
                </AppButton>
              </span>
            </div>
          </AppSection>

          <AppSection title="Audit & Lifecycle Metadata" style={{ marginTop: 18 }}>
            <MetaRow label="Created By" value={item.createdBy || 'System'} icon={<User size={14} color="var(--text-muted)" />} />
            <MetaRow label="Created At" value={formatDate(item.createdAt)} icon={<Clock size={14} color="var(--text-muted)" />} />
            <MetaRow label="Last Updated By" value={item.updatedBy} icon={<User size={14} color="var(--text-muted)" />} />
            <MetaRow label="Last Updated At" value={item.updatedAt ? formatDate(item.updatedAt) : null} icon={<Clock size={14} color="var(--text-muted)" />} />
            <MetaRow label="Previous Updated By" value={item.previousUpdatedBy} icon={<User size={14} color="var(--text-muted)" />} />
            <MetaRow label="Previous Updated At" value={item.previousUpdatedAt ? formatDate(item.previousUpdatedAt) : null} icon={<Clock size={14} color="var(--text-muted)" />} />
          </AppSection>
        </>
      )}

      <AttachTagModal
        visible={tagModalOpen}
        mode={item.activeTagId ? 'replace' : 'attach'}
        entity={{ type: 'item', id: itemId, name: item.name }}
        onClose={() => setTagModalOpen(false)}
      />
    </Screen>
  );
}
