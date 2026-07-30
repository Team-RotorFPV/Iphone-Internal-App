import { Fragment, useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Folder,
  Box,
  User,
  Download,
  CheckSquare,
  Square,
  X,
  ArrowRightLeft,
  MoreVertical,
  Trash2,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  CornerDownRight,
  QrCode,
} from 'lucide-react';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';
import InventoryScanButton from '../../components/InventoryScanButton';
import AttachTagModal from '../../components/AttachTagModal';
import BulkScanModal from '../../components/BulkScanModal';
import { resolveEffectiveHolder } from '../../lib/custody';
import {
  AppCard,
  AppSection,
  AppSearchBar,
  AppListItem,
  AppFAB,
  AppModal,
  AppInput,
  AppButton,
  AppBadge,
  AppChip,
  AppSkeleton,
  AppEmptyState,
} from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import {
  getRelativeTime,
  getHolderName,
  calculateDescendantItemCount,
  getStatusBadgeVariant,
  resolveStatus,
  toggleInSet,
  toggleSelectAll,
} from '../../lib/inventoryHelpers';
import '../screens.css';

const wellStyle = (bg) => ({ width: 38, height: 38, background: bg });

export default function FolderDetailScreen() {
  const user = useAuthStore((s) => s.user);
  const { inventoryId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inventoryName = location.state?.inventoryName || 'Folder';

  const [items, setItems] = useState([]);
  const [subInventories, setSubInventories] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [lists, setLists] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState(new Set());

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCategory, setNewCategory] = useState('');

  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportVisible, setIsExportVisible] = useState(false);
  const [isActionsModalVisible, setIsActionsModalVisible] = useState(false);
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [attachTarget, setAttachTarget] = useState(null);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [bulkScanVisible, setBulkScanVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActiveTab('overview');
    setSearchQuery('');
    const unsubs = [
      InventoryService.subscribeToItems(inventoryId, (data) => {
        setItems(data);
        setLoading(false);
      }),
      InventoryService.subscribeToSubInventories(inventoryId, setSubInventories),
      InventoryService.subscribeToAllInventories(setAllInvs),
      InventoryService.subscribeToLists(setLists),
      InventoryService.subscribeToAllItems(setAllItems),
      InventoryService.subscribeToHistory(inventoryId, setHistory),
      UsersService.subscribeToUsers(setUsersList),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [inventoryId]);

  const currentInventory = allInvs.find((i) => i.id === inventoryId) || {};
  const itemCountFor = (invId) => calculateDescendantItemCount(invId, allInvs, allItems);
  const holderNameFor = (email) => getHolderName(email, usersList);

  // Self-custody for the folder. Explicit holder overrides inherited; releasing
  // reverts to the parent folder's holder (see lib/custody.js).
  const doHoldFolder = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.holdInventory(inventoryId, user?.email, user?.roomNumber);
    } catch (e) {
      console.error('Error holding folder:', e);
      toast.error('Could not hold this folder. Please try again.');
    } finally {
      setCustodyBusy(false);
    }
  };

  const handleHoldFolder = () => {
    if (currentInventory.currentHolder && currentInventory.currentHolder !== user?.email) {
      alertConfirm({
        title: 'Take custody?',
        message: `This folder is currently held by ${holderNameFor(currentInventory.currentHolder)}. Take it anyway?`,
        confirmLabel: 'Take it',
        onConfirm: doHoldFolder,
      });
    } else {
      doHoldFolder();
    }
  };

  const handleReleaseFolder = async () => {
    try {
      setCustodyBusy(true);
      await InventoryService.releaseInventory(inventoryId);
    } catch {
      toast.error('Could not release this folder. Please try again.');
    } finally {
      setCustodyBusy(false);
    }
  };

  const goFolder = (item) => navigate(`/inventory/folder/${item.id}`, { state: { inventoryName: item.name } });
  const goItem = (item) => navigate(`/inventory/item/${item.id}`, { state: { itemData: item } });

  const handleTabChange = (val) => {
    setActiveTab(val);
    setIsSelectionMode(false);
    setSelectedSet(new Set());
  };

  const filteredSubInvs = subInventories.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredItems = items.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const visibleRows = activeTab === 'sub' ? filteredSubInvs : filteredItems;

  const toggleSelection = (id) => setSelectedSet((prev) => toggleInSet(prev, id));
  const handleSelectAll = () => setSelectedSet((prev) => toggleSelectAll(prev, visibleRows));
  const allSelected = selectedSet.size === visibleRows.length && visibleRows.length > 0;

  const renderBreadcrumbs = () => {
    const crumbs = [];
    const seen = new Set();
    let curr = allInvs.find((i) => i.id === inventoryId);
    while (curr && !seen.has(curr.id) && crumbs.length < 20) {
      crumbs.unshift(curr);
      seen.add(curr.id);
      if (!curr.parentInventoryId) break;
      curr = allInvs.find((i) => i.id === curr.parentInventoryId);
    }
    const currentList = lists.find((l) => l.id === currentInventory.listId);
    return (
      <div className="breadcrumbs">
        {currentList && (
          <span
            className="crumb-link"
            onClick={() =>
              navigate(`/inventory/list/${currentList.id}`, { state: { listName: currentList.name } })
            }
          >
            {currentList.name}
          </span>
        )}
        {crumbs.map((c) => (
          <Fragment key={c.id}>
            <span className="crumb-sep">/</span>
            <span
              className={c.id === inventoryId ? 'crumb-active' : 'crumb-text'}
              onClick={() => c.id !== inventoryId && goFolder(c)}
            >
              {c.name}
            </span>
          </Fragment>
        ))}
      </div>
    );
  };

  const renderOverview = () => {
    const status = resolveStatus(currentInventory);
    const Row = ({ label, value, muted, last }) => (
      <div className="detail-row" style={last ? { borderBottom: 'none' } : undefined}>
        <span className="detail-label">{label}</span>
        <span className="detail-value" style={muted ? { color: 'var(--text-muted)', fontWeight: 400 } : undefined}>
          {value}
        </span>
      </div>
    );
    return (
      <>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <h1 className="page-title">{currentInventory.name || inventoryName}</h1>
            <div className="row gap-sm" style={{ marginTop: 6 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>Status:</span>
              <AppBadge variant={getStatusBadgeVariant(status)}>{status}</AppBadge>
            </div>
          </div>
          <div className="row gap-sm">
            <InventoryScanButton
              surface="folder"
              variant="compact"
              containerId={inventoryId}
              allInvs={allInvs}
              bindCandidates={[
                ...subInventories.map((inv) => ({ type: 'inventory', id: inv.id, name: inv.name })),
                ...items.map((it) => ({ type: 'item', id: it.id, name: it.name })),
              ]}
            />
            <AppButton
              variant="secondary"
              size="sm"
              icon={<MoreVertical size={16} />}
              onClick={() => setIsActionsModalVisible(true)}
            >
              Actions
            </AppButton>
          </div>
        </div>

        {(() => {
          const effectiveHolder = resolveEffectiveHolder(currentInventory, 'inventory', allInvs);
          const iHoldFolder = currentInventory.currentHolder && currentInventory.currentHolder === user?.email;
          return (
            <AppSection title="Self-Custody & QR Tag" style={{ marginTop: 18 }}>
              <div className="row-between">
                <div className="grow">
                  <div className="detail-label">Held by</div>
                  <div className="t-body" style={{ fontWeight: 600, marginTop: 2 }}>
                    {effectiveHolder.holder ? holderNameFor(effectiveHolder.holder) : 'Unassigned'}
                  </div>
                  {effectiveHolder.source === 'inherited' && (
                    <div className="meta-line" style={{ marginTop: 2 }}>
                      <CornerDownRight size={12} /> via {effectiveHolder.from?.name || 'parent folder'}
                    </div>
                  )}
                </div>
                {iHoldFolder ? (
                  <AppButton variant="secondary" size="sm" onClick={handleReleaseFolder} loading={custodyBusy}>
                    Release
                  </AppButton>
                ) : (
                  <AppButton variant="primary" size="sm" onClick={handleHoldFolder} loading={custodyBusy} icon={<UserCheck size={14} color="#09090B" />}>
                    Hold this
                  </AppButton>
                )}
              </div>
              <div className="detail-row" style={{ marginTop: 12 }}>
                <span className="detail-label">QR Tag</span>
                <span className="row gap-sm">
                  <span className="detail-value" style={{ fontFamily: 'monospace' }}>{currentInventory.activeTagId || 'None'}</span>
                  <AppButton variant="ghost" size="sm" onClick={() => setReplaceVisible(true)}>
                    {currentInventory.activeTagId ? 'Replace' : 'Attach'}
                  </AppButton>
                </span>
              </div>
            </AppSection>
          );
        })()}

        <AppSection title="Assignment & Custody" style={{ marginTop: 18 }}>
          <Row label="Current Holder" value={holderNameFor(currentInventory.currentHolder)} />
          <Row label="Room / Location" value={currentInventory.currentRoom || 'Not specified'} />
          <Row
            label="Assigned Date"
            value={currentInventory.currentAssignedDate ? new Date(currentInventory.currentAssignedDate).toLocaleDateString() : 'N/A'}
            last
          />
        </AppSection>

        {currentInventory.previousHolder && (
          <AppSection title="Previous Custody" style={{ marginTop: 16 }}>
            <Row label="Previous Holder" value={holderNameFor(currentInventory.previousHolder)} muted />
            <Row label="Previous Room" value={currentInventory.previousRoom || 'Unknown'} muted />
            <Row
              label="Released Date"
              value={currentInventory.previousAssignedDate ? new Date(currentInventory.previousAssignedDate).toLocaleDateString() : 'N/A'}
              muted
              last
            />
          </AppSection>
        )}

        <AppSection title="Folder Statistics" style={{ marginTop: 16 }}>
          <Row label="Total Items (Descendants)" value={itemCountFor(inventoryId)} />
          <Row label="Created By" value={currentInventory.createdBy || 'System'} last />
        </AppSection>
      </>
    );
  };

  const renderSubInventories = () =>
    filteredSubInvs.length === 0 ? (
      <AppEmptyState
        title="No sub-folders"
        description="There are no sub-compartments in this folder yet."
        actionLabel="Create Sub-Folder"
        onAction={() => setIsAddModalVisible(true)}
      />
    ) : (
      filteredSubInvs.map((item) => {
        const count = itemCountFor(item.id);
        const status = resolveStatus(item);
        const isSelected = selectedSet.has(item.id);
        return (
          <AppListItem
            key={item.id}
            title={item.name || 'Unnamed Folder'}
            description={`${count} ${count === 1 ? 'item' : 'items'} • Held by ${holderNameFor(item.currentHolder)} • ${getRelativeTime(item.updatedAt || item.createdAt)}`}
            leftIcon={
              isSelectionMode ? (
                <span style={{ display: 'flex', paddingRight: 4 }}>
                  {isSelected ? <CheckSquare size={20} color="var(--accent)" /> : <Square size={20} color="var(--text-secondary)" />}
                </span>
              ) : (
                <div className="icon-well" style={wellStyle('rgba(148,163,184,0.12)')}>
                  <Folder size={18} color="#38BDF8" />
                </div>
              )
            }
            rightElement={<AppBadge variant={getStatusBadgeVariant(status)}>{status}</AppBadge>}
            showChevron={!isSelectionMode}
            style={isSelected ? { background: 'rgba(139,92,246,0.06)' } : undefined}
            onClick={() => (isSelectionMode ? toggleSelection(item.id) : goFolder(item))}
          />
        );
      })
    );

  const renderItems = () =>
    filteredItems.length === 0 ? (
      <AppEmptyState
        title="No equipment items"
        description="There are no physical items logged directly inside this folder."
        actionLabel="Add Equipment Item"
        onAction={() => setIsAddModalVisible(true)}
      />
    ) : (
      filteredItems.map((item) => {
        const isSelected = selectedSet.has(item.id);
        return (
          <AppListItem
            key={item.id}
            title={item.name || 'Unnamed Item'}
            description={`Category: ${item.category || 'General'} • Added ${getRelativeTime(item.createdAt)}`}
            leftIcon={
              isSelectionMode ? (
                <span style={{ display: 'flex', paddingRight: 4 }}>
                  {isSelected ? <CheckSquare size={20} color="var(--accent)" /> : <Square size={20} color="var(--text-secondary)" />}
                </span>
              ) : (
                <div className="icon-well" style={wellStyle('#A855F715')}>
                  <Box size={18} color="#A855F7" />
                </div>
              )
            }
            rightElement={<AppBadge variant="secondary">Qty: {item.quantity || 0}</AppBadge>}
            showChevron={!isSelectionMode}
            onClick={() => (isSelectionMode ? toggleSelection(item.id) : goItem(item))}
            onDelete={
              !isSelectionMode
                ? () =>
                    alertConfirm({
                      title: 'Delete Item',
                      message: `Are you sure you want to delete "${item.name}"?`,
                      onConfirm: () => InventoryService.deleteItem(item.id),
                    })
                : undefined
            }
            style={isSelected ? { background: 'rgba(139,92,246,0.06)' } : undefined}
          />
        );
      })
    );

  const renderHistory = () =>
    history.length === 0 ? (
      <AppEmptyState
        title="No audit history"
        description="No activities or custody changes have been recorded for this folder yet."
      />
    ) : (
      history.map((item) => {
        let accent = 'var(--accent)';
        const action = item.action || '';
        if (action.includes('Holder Assigned')) accent = '#10B981';
        else if (action.includes('Holder Removed')) accent = '#EF4444';
        else if (action.includes('Item Added')) accent = '#3B82F6';
        else if (action.includes('Quantity Edited')) accent = '#F59E0B';
        else if (action.includes('Item Renamed')) accent = '#A855F7';
        else if (action.includes('Item Moved')) accent = '#F97316';
        else if (action.includes('Deleted')) accent = '#EF4444';
        return (
          <AppCard key={item.id} variant="surface" style={{ borderLeft: `4px solid ${accent}`, marginBottom: 12 }}>
            <div className="row-between">
              <span className="t-body" style={{ fontWeight: 600 }}>{item.action}</span>
              <span className="t-metadata">{item.userId || 'System'}</span>
            </div>
            <div className="t-caption" style={{ marginTop: 2, marginBottom: 6 }}>
              {item.timestamp?.toLocaleString?.() || (item.createdAt ? new Date(item.createdAt).toLocaleString() : '')}
            </div>
            <div className="t-body">{item.details}</div>
            {action.includes('Quantity Edited') && item.previousQuantity !== undefined && item.newQuantity !== undefined && (
              <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 600, fontStyle: 'italic', fontSize: 13 }}>
                Quantity changed: {item.previousQuantity} → {item.newQuantity}
              </div>
            )}
          </AppCard>
        );
      })
    );

  const showToolbar = activeTab === 'sub' || activeTab === 'items';

  const headerRight = showToolbar ? (
    <>
      <AppButton variant="secondary" size="sm" onClick={() => setIsExportVisible(true)} icon={<Download size={14} />}>
        Export
      </AppButton>
      <AppButton
        variant={isSelectionMode ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => (isSelectionMode ? handleSelectAll() : setIsSelectionMode(true))}
        icon={<CheckSquare size={14} color={isSelectionMode ? '#09090B' : undefined} />}
      >
        {isSelectionMode ? (allSelected ? 'Deselect' : 'All') : 'Select'}
      </AppButton>
      {isSelectionMode && (
        <button
          type="button"
          className="appbar-icon-btn"
          onClick={() => {
            setIsSelectionMode(false);
            setSelectedSet(new Set());
          }}
        >
          <X size={20} />
        </button>
      )}
    </>
  ) : null;

  const activeUsers = usersList.filter(
    (u) =>
      u.isArchived !== true &&
      u.isActive !== false &&
      (u.name?.toLowerCase().includes(assignSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(assignSearchQuery.toLowerCase()))
  );

  return (
    <Screen title={inventoryName} showBack headerRight={headerRight}>
      <div className="folder-tabs">
        <AppChip selected={activeTab === 'overview'} onClick={() => handleTabChange('overview')}>
          Overview
        </AppChip>
        <AppChip selected={activeTab === 'sub'} onClick={() => handleTabChange('sub')}>
          Sub-Folders ({subInventories.length})
        </AppChip>
        <AppChip selected={activeTab === 'items'} onClick={() => handleTabChange('items')}>
          Items ({items.length})
        </AppChip>
        <AppChip selected={activeTab === 'history'} onClick={() => handleTabChange('history')}>
          Audit Log
        </AppChip>
      </div>

      {renderBreadcrumbs()}

      {showToolbar && (
        <AppSearchBar
          placeholder={`Search ${activeTab === 'sub' ? 'sub-folders' : 'items'}...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      )}

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={80} />
          <AppSkeleton width="100%" height={80} />
          <AppSkeleton width="100%" height={80} />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sub' && renderSubInventories()}
          {activeTab === 'items' && renderItems()}
          {activeTab === 'history' && renderHistory()}
        </>
      )}

      {!isSelectionMode && showToolbar && (
        <AppFAB label={activeTab === 'sub' ? 'New Folder' : 'New Item'} onClick={() => setIsAddModalVisible(true)} />
      )}

      {isSelectionMode && selectedSet.size > 0 && (
        <div className="bulk-bar">
          <span className="t-body" style={{ fontWeight: 600 }}>{selectedSet.size} selected</span>
          <AppButton
            variant="primary"
            size="sm"
            onClick={() => setIsMoveModalVisible(true)}
            icon={<ArrowRightLeft size={14} color="#09090B" />}
          >
            Move Selected
          </AppButton>
        </div>
      )}

      <ExportModal
        visible={isExportVisible}
        onDismiss={() => setIsExportVisible(false)}
        inventoryId={inventoryId}
        listId={currentInventory?.listId}
      />

      <MoveDestinationModal
        visible={isMoveModalVisible}
        onDismiss={() => setIsMoveModalVisible(false)}
        lists={lists}
        inventories={allInvs}
        allowedTypes={activeTab === 'items' ? ['inventory'] : ['list', 'inventory']}
        invalidTargets={activeTab === 'sub' ? Array.from(selectedSet).map((id) => `inventory:${id}`) : []}
        onConfirm={async (dest) => {
          setIsMoveModalVisible(false);
          try {
            if (activeTab === 'items') {
              await Promise.all(
                Array.from(selectedSet).map((itemId) => InventoryService.updateItem(itemId, { inventoryId: dest.id }))
              );
            } else {
              await Promise.all(
                Array.from(selectedSet).map((invId) => InventoryService.moveInventory(invId, dest, allInvs))
              );
            }
            setIsSelectionMode(false);
            setSelectedSet(new Set());
          } catch {
            toast.error('Could not move the selected items. Please try again.');
          }
        }}
      />

      {/* New Sub-Folder / Item Modal */}
      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title={`Create ${activeTab === 'sub' ? 'Sub-Folder' : 'Equipment Item'}`}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setIsAddModalVisible(false)} style={{ flex: 1 }}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              disabled={!newName.trim()}
              style={{ flex: 1 }}
              onClick={async () => {
                if (!newName.trim()) return;
                const createdName = newName.trim();
                const entityType = activeTab === 'sub' ? 'inventory' : 'item';
                try {
                  let ref;
                  if (activeTab === 'sub') {
                    ref = await InventoryService.addSubInventory(currentInventory.listId, inventoryId, createdName);
                  } else {
                    ref = await InventoryService.addItem(inventoryId, {
                      name: createdName,
                      quantity: parseInt(newQty || 1, 10),
                      category: newCategory.trim(),
                    });
                  }
                  setIsAddModalVisible(false);
                  setNewName('');
                  setNewQty('1');
                  setNewCategory('');
                  // Offer to attach a QR tag to the thing we just created.
                  if (ref?.id) {
                    alertConfirm({
                      title: 'Attach a QR tag?',
                      message: `Link a physical QR label to "${createdName}" now?`,
                      confirmLabel: 'Scan tag',
                      onConfirm: () => setAttachTarget({ type: entityType, id: ref.id, name: createdName }),
                    });
                  }
                } catch {
                  toast.error('Could not create the resource. Please try again.');
                }
              }}
            >
              Create
            </AppButton>
          </div>
        }
      >
        <AppInput
          label="Name"
          value={newName}
          onChangeText={setNewName}
          placeholder={`e.g. ${activeTab === 'sub' ? 'Screws & Standoffs' : 'T-Motor Velox V2'}`}
          autoFocus
        />
        {activeTab === 'items' && (
          <>
            <AppInput label="Quantity" value={newQty} onChangeText={setNewQty} inputMode="numeric" placeholder="1" />
            <AppInput
              label="Category / Tag"
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="e.g. Motors, ESC, Frame"
            />
          </>
        )}
      </AppModal>

      {/* Assign Holder Modal */}
      <AppModal visible={isAssignModalVisible} onClose={() => setIsAssignModalVisible(false)} title="Assign Folder Custody" expanded>
        <p className="t-body-secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          Select a team member to take custody and accountability for this folder and its contents.
        </p>
        <AppSearchBar placeholder="Search team members..." value={assignSearchQuery} onChangeText={setAssignSearchQuery} />
        <div>
          {activeUsers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No matching users found.</p>
          ) : (
            activeUsers.map((item) => (
              <AppListItem
                key={item.id}
                title={item.name || item.email}
                description={item.roomNumber ? `Room / Location: ${item.roomNumber}` : 'No room specified'}
                leftIcon={
                  <div className="icon-well" style={wellStyle('#10B98115')}>
                    <User size={18} color="#10B981" />
                  </div>
                }
                onClick={async () => {
                  try {
                    await InventoryService.assignHolder(
                      inventoryId,
                      item.email,
                      item.roomNumber || 'Unknown',
                      currentInventory.currentHolder,
                      currentInventory.currentRoom,
                      currentInventory.currentAssignedDate,
                      user?.email
                    );
                    setIsAssignModalVisible(false);
                    setAssignSearchQuery('');
                  } catch {
                    toast.error('Could not assign custody. Please try again.');
                  }
                }}
              />
            ))
          )}
        </div>
      </AppModal>

      {/* Overview Actions Modal */}
      <AppModal visible={isActionsModalVisible} onClose={() => setIsActionsModalVisible(false)} title="Folder Actions">
        <div className="stack gap-sm">
          <AppButton
            variant="secondary"
            icon={<UserCheck size={18} />}
            onClick={() => {
              setIsActionsModalVisible(false);
              setIsAssignModalVisible(true);
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Assign Team Holder
          </AppButton>
          <AppButton
            variant="secondary"
            icon={<CheckCircle2 size={18} color="#10B981" />}
            onClick={() => {
              setIsActionsModalVisible(false);
              InventoryService.updateInventoryStatus(inventoryId, 'Available');
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Mark as Available
          </AppButton>
          <AppButton
            variant="secondary"
            icon={<AlertTriangle size={18} color="#F59E0B" />}
            onClick={() => {
              setIsActionsModalVisible(false);
              InventoryService.updateInventoryStatus(inventoryId, 'Missing');
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Mark as Missing
          </AppButton>
          <div className="divider" style={{ margin: '6px 0' }} />
          <AppButton
            variant="secondary"
            icon={<QrCode size={18} color="var(--accent)" />}
            onClick={() => {
              setIsActionsModalVisible(false);
              setBulkScanVisible(true);
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Bulk scan into this folder
          </AppButton>
          <div className="divider" style={{ margin: '6px 0' }} />
          <AppButton
            variant="danger"
            icon={<Trash2 size={18} color="#EF4444" />}
            onClick={() => {
              setIsActionsModalVisible(false);
              if (subInventories.length > 0 || items.length > 0) {
                toast.error('Cannot delete a folder that still contains items or sub-folders.');
              } else {
                InventoryService.deleteInventory(inventoryId);
                navigate(-1);
              }
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            Delete Folder
          </AppButton>
        </div>
      </AppModal>

      {/* Attach a tag to a just-created sub-folder/item */}
      <AttachTagModal visible={!!attachTarget} entity={attachTarget} onClose={() => setAttachTarget(null)} />

      {/* Attach / replace THIS folder's own tag */}
      <AttachTagModal
        visible={replaceVisible}
        mode={currentInventory.activeTagId ? 'replace' : 'attach'}
        entity={{ type: 'inventory', id: inventoryId, name: currentInventory.name }}
        onClose={() => setReplaceVisible(false)}
      />

      {bulkScanVisible && (
        <BulkScanModal
          visible
          onClose={() => setBulkScanVisible(false)}
          containerId={inventoryId}
          containerName={currentInventory.name || inventoryName}
          allInvs={allInvs}
        />
      )}
    </Screen>
  );
}
