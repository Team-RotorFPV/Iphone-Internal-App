import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Folder, Box, User, Download, CheckSquare, Square, X, ArrowRightLeft } from 'lucide-react';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import MoveDestinationModal from '../../components/MoveDestinationModal';
import ExportModal from '../../components/ExportModal';
import InventoryScanButton from '../../components/InventoryScanButton';
import AttachTagModal from '../../components/AttachTagModal';
import {
  AppSearchBar,
  AppListItem,
  AppFAB,
  AppModal,
  AppInput,
  AppButton,
  AppBadge,
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

const iconBox = (child) => (
  <div className="icon-well" style={{ width: 38, height: 38, background: 'rgba(148,163,184,0.12)' }}>
    {child}
  </div>
);

export default function InventoryDetailScreen() {
  const { listId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const listName = location.state?.listName || 'Inventories';

  const [inventories, setInventories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [lists, setLists] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInventories, setSelectedInventories] = useState(new Set());

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newInventoryName, setNewInventoryName] = useState('');
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [attachTarget, setAttachTarget] = useState(null);

  useEffect(() => {
    const unsubs = [
      InventoryService.subscribeToInventories(listId, (data) => {
        setInventories(data);
        setLoading(false);
      }),
      InventoryService.subscribeToAllInventories(setAllInvs),
      InventoryService.subscribeToLists(setLists),
      InventoryService.subscribeToAllItems(setAllItems),
      UsersService.subscribeToUsers(setUsersList),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [listId]);

  const topLevelInventories = inventories.filter((i) => !i.parentInventoryId);
  const toggleSelection = (id) => setSelectedInventories((prev) => toggleInSet(prev, id));
  const handleSelectAll = () => setSelectedInventories((prev) => toggleSelectAll(prev, topLevelInventories));

  const handleAddInventory = async () => {
    if (!newInventoryName.trim()) return;
    const createdName = newInventoryName.trim();
    try {
      const ref = await InventoryService.addInventory(listId, createdName);
      setIsAddModalVisible(false);
      setNewInventoryName('');
      // Offer to attach a QR tag to the folder we just created.
      alertConfirm({
        title: 'Attach a QR tag?',
        message: `Link a physical QR label to "${createdName}" now?`,
        confirmLabel: 'Scan tag',
        onConfirm: () => setAttachTarget({ type: 'inventory', id: ref.id, name: createdName }),
      });
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const goFolder = (item) => navigate(`/inventory/folder/${item.id}`, { state: { inventoryName: item.name } });
  const goItem = (item) => navigate(`/inventory/item/${item.id}`, { state: { itemData: item } });

  const allSelected =
    selectedInventories.size === topLevelInventories.length && topLevelInventories.length > 0;

  const renderNormalView = () =>
    topLevelInventories.length === 0 ? (
      <AppEmptyState
        title="No storage folders"
        description={`There are currently no folders inside "${listName}".`}
        actionLabel="Create First Folder"
        onAction={() => setIsAddModalVisible(true)}
      />
    ) : (
      topLevelInventories.map((item) => {
        const count = calculateDescendantItemCount(item.id, allInvs, allItems);
        const status = resolveStatus(item);
        const holder = getHolderName(item.currentHolder, usersList);
        const isSelected = selectedInventories.has(item.id);
        const desc = `${count} ${count === 1 ? 'item' : 'items'} • Held by ${holder} • ${getRelativeTime(item.createdAt)}`;
        return (
          <AppListItem
            key={item.id}
            title={item.name || 'Unnamed Folder'}
            description={desc}
            leftIcon={
              isSelectionMode ? (
                <span style={{ display: 'flex', paddingRight: 4 }}>
                  {isSelected ? (
                    <CheckSquare size={20} color="var(--accent)" />
                  ) : (
                    <Square size={20} color="var(--text-secondary)" />
                  )}
                </span>
              ) : (
                iconBox(<Folder size={18} color="#FF9800" />)
              )
            }
            rightElement={<AppBadge variant={getStatusBadgeVariant(status)}>{status}</AppBadge>}
            showChevron={!isSelectionMode}
            style={isSelected ? { background: 'rgba(255, 152, 0,0.06)' } : undefined}
            onClick={() => (isSelectionMode ? toggleSelection(item.id) : goFolder(item))}
          />
        );
      })
    );

  const renderSearchResults = () => {
    const q = searchQuery.toLowerCase();
    const validInvs = allInvs.filter((i) => i.listId === listId);
    const validInvIds = new Set(validInvs.map((i) => i.id));

    const matchedInvs = validInvs.filter((i) => i.name?.toLowerCase().includes(q)).map((i) => ({ ...i, _type: 'folder' }));
    const matchedItems = allItems
      .filter((i) => validInvIds.has(i.inventoryId) && i.name?.toLowerCase().includes(q))
      .map((i) => ({ ...i, _type: 'item' }));

    const holderIdentifiers = new Set();
    validInvs.forEach((i) => i.currentHolder && holderIdentifiers.add(i.currentHolder.toLowerCase()));
    const matchedUsers = usersList
      .filter(
        (u) =>
          (holderIdentifiers.has(u.email?.toLowerCase()) || holderIdentifiers.has(u.id?.toLowerCase())) &&
          (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      )
      .map((u) => ({ ...u, _type: 'user' }));

    const combined = [...matchedInvs, ...matchedItems, ...matchedUsers];
    if (combined.length === 0) {
      return (
        <AppEmptyState
          title="No search results"
          description={`No folders, items, or holders matched "${searchQuery}".`}
        />
      );
    }

    return combined.map((item) => {
      let icon = <Folder size={18} color="#FF9800" />;
      let subtitle = '';
      let onPress = () => {};
      if (item._type === 'folder') {
        const parentInv = allInvs.find((i) => i.id === item.parentInventoryId);
        subtitle = parentInv ? `Sub-folder • In ${parentInv.name}` : `Folder • In ${listName}`;
        onPress = () => goFolder(item);
      } else if (item._type === 'item') {
        icon = <Box size={18} color="#A855F7" />;
        const parentInv = allInvs.find((i) => i.id === item.inventoryId);
        subtitle = `Item • Qty: ${item.quantity || 0}${parentInv ? ` • In ${parentInv.name}` : ''}`;
        onPress = () => goItem(item);
      } else if (item._type === 'user') {
        icon = <User size={18} color="#66BB6A" />;
        const held = validInvs.filter(
          (inv) => inv.currentHolder?.toLowerCase() === item.email?.toLowerCase() || inv.currentHolder === item.id
        );
        subtitle = `${item.email || ''} • Holds ${held.length} folders in this list`;
        onPress = () => held.length > 0 && goFolder(held[0]);
      }
      return (
        <AppListItem
          key={item._type + '_' + item.id}
          title={item.name || item.email}
          description={subtitle}
          leftIcon={iconBox(icon)}
          onClick={onPress}
        />
      );
    });
  };

  const headerRight = !searchQuery.trim() ? (
    <>
      <InventoryScanButton
        surface="list"
        variant="compact"
        containerId={listId}
        allInvs={allInvs}
        bindCandidates={topLevelInventories.map((inv) => ({ type: 'inventory', id: inv.id, name: inv.name }))}
      />
      <AppButton
        variant="secondary"
        size="sm"
        onClick={() => setIsExportModalVisible(true)}
        icon={<Download size={14} />}
      >
        Export
      </AppButton>
      <AppButton
        variant={isSelectionMode ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => (isSelectionMode ? handleSelectAll() : setIsSelectionMode(true))}
        icon={<CheckSquare size={14} color={isSelectionMode ? '#121212' : undefined} />}
      >
        {isSelectionMode ? (allSelected ? 'Deselect All' : 'Select All') : 'Select'}
      </AppButton>
      {isSelectionMode && (
        <button
          type="button"
          className="appbar-icon-btn"
          onClick={() => {
            setIsSelectionMode(false);
            setSelectedInventories(new Set());
          }}
        >
          <X size={20} />
        </button>
      )}
    </>
  ) : null;

  return (
    <Screen title={listName} showBack headerRight={headerRight}>
      <AppSearchBar
        placeholder={searchQuery ? `Searching in ${listName}...` : `Search ${listName}...`}
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          if (text.trim()) {
            setIsSelectionMode(false);
            setSelectedInventories(new Set());
          }
        }}
      />

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={64} />
          <AppSkeleton width="100%" height={64} />
          <AppSkeleton width="100%" height={64} />
        </div>
      ) : searchQuery.trim() ? (
        renderSearchResults()
      ) : (
        renderNormalView()
      )}

      {!searchQuery.trim() && isSelectionMode && selectedInventories.size > 0 && (
        <div className="bulk-bar">
          <span className="t-body" style={{ fontWeight: 600 }}>
            {selectedInventories.size} folders selected
          </span>
          <AppButton
            variant="primary"
            size="sm"
            onClick={() => setIsMoveModalVisible(true)}
            icon={<ArrowRightLeft size={14} color="#121212" />}
          >
            Move Selected
          </AppButton>
        </div>
      )}

      <MoveDestinationModal
        visible={isMoveModalVisible}
        onDismiss={() => setIsMoveModalVisible(false)}
        lists={lists}
        inventories={allInvs}
        allowedTypes={['list', 'inventory']}
        invalidTargets={Array.from(selectedInventories).map((id) => `inventory:${id}`)}
        onConfirm={async (dest) => {
          setIsMoveModalVisible(false);
          try {
            await Promise.all(
              Array.from(selectedInventories).map((invId) =>
                InventoryService.moveInventory(invId, dest, allInvs)
              )
            );
            setIsSelectionMode(false);
            setSelectedInventories(new Set());
          } catch {
            toast.error('Could not move the selected items. Please try again.');
          }
        }}
      />

      <ExportModal
        visible={isExportModalVisible}
        onDismiss={() => setIsExportModalVisible(false)}
        listId={listId}
      />

      <AttachTagModal visible={!!attachTarget} entity={attachTarget} onClose={() => setAttachTarget(null)} />

      {!isSelectionMode && !searchQuery.trim() && (
        <AppFAB label="New Folder" onClick={() => setIsAddModalVisible(true)} />
      )}

      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title="Create Storage Folder"
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setIsAddModalVisible(false)} style={{ flex: 1 }}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleAddInventory} disabled={!newInventoryName.trim()} style={{ flex: 1 }}>
              Create Folder
            </AppButton>
          </div>
        }
      >
        <p className="t-body-secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          Create a storage folder or sub-compartment to group related items together.
        </p>
        <AppInput
          label="Folder Name"
          value={newInventoryName}
          onChangeText={setNewInventoryName}
          placeholder="e.g. Flight Controllers & ESCs"
          autoFocus
        />
      </AppModal>
    </Screen>
  );
}
