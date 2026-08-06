import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Archive, ArchiveRestore, Box, User, Layers, ShieldAlert, Table } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { InventoryService } from '../../services/inventory';
import { UsersService } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import {
  AppSearchBar,
  AppChip,
  AppListItem,
  AppFAB,
  AppModal,
  AppInput,
  AppButton,
  AppSkeleton,
  AppEmptyState,
} from '../../components/ui';
import Screen from '../../components/Screen';
import InventoryScanButton from '../../components/InventoryScanButton';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

// Mirrors the inventory website's OpenSheetButton: reads `sheetUrl` and
// `enabled` off settings/google_sheets, only shows when enabled, and falls
// back to the generic Sheets URL when no specific link is set.
const SHEETS_FALLBACK_URL = 'https://docs.google.com/spreadsheets';

const iconBox = (child, muted) => (
  <div
    className="icon-well"
    style={{ width: 38, height: 38, background: muted ? 'var(--elevated)' : 'var(--accent-muted)' }}
  >
    {child}
  </div>
);

export default function InventoryListsScreen() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [allInvs, setAllInvs] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetEnabled, setSheetEnabled] = useState(false);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const hasInventoryPermission = hasPermission('inventory');
  const myEmail = (user?.email || '').toLowerCase();

  // Live-track the Google Sheets config, exactly like the website's
  // OpenSheetButton — the button appears only while the integration is enabled.
  useEffect(() => {
    if (!hasInventoryPermission) return;
    const unsub = onSnapshot(
      doc(db, 'settings', 'google_sheets'),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setSheetUrl(data.sheetUrl || '');
        setSheetEnabled(data.enabled || false);
      },
      () => setSheetEnabled(false)
    );
    return () => unsub();
  }, [hasInventoryPermission]);

  const handleOpenSheet = () => {
    const opened = window.open(sheetUrl || SHEETS_FALLBACK_URL, '_blank', 'noopener');
    if (!opened) toast.error('The linked Google Sheet could not be opened.');
  };

  useEffect(() => {
    if (!hasInventoryPermission) {
      setLoading(false);
      return;
    }
    const unsubs = [
      InventoryService.subscribeToLists((data) => {
        setLists(data);
        setLoading(false);
      }),
      InventoryService.subscribeToAllInventories(setAllInvs),
      InventoryService.subscribeToAllItems(setAllItems),
      UsersService.subscribeToUsers(setUsersList),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [hasInventoryPermission]);

  const handleAddList = async () => {
    if (!newListName.trim()) return;
    try {
      await InventoryService.addList(newListName.trim());
      setIsAddModalVisible(false);
      setNewListName('');
    } catch {
      toast.error('Failed to create list');
    }
  };

  const handleArchiveToggle = (list, isArchived) => {
    alertConfirm({
      title: isArchived ? 'Archive List' : 'Restore List',
      message: `Are you sure you want to ${isArchived ? 'archive' : 'restore'} "${list.name}"?`,
      onConfirm: async () => {
        try {
          await InventoryService.archiveList(list.id, isArchived);
        } catch {
          toast.error('Failed to update list status');
        }
      },
    });
  };

  const handleDeleteList = (list) => {
    alertConfirm({
      title: 'Delete List',
      message: `Permanently delete "${list.name}"? All folders and items inside will be deleted.`,
      onConfirm: async () => {
        try {
          await InventoryService.deleteList(list.id);
        } catch {
          toast.error('Failed to delete list');
        }
      },
    });
  };

  const filteredLists = lists.filter((l) => (activeTab === 'active' ? !l.isArchived : l.isArchived));

  // Folders currently checked out to the signed-in user. currentHolder is stored
  // as the holder's (lowercased) email — the same match the global search uses.
  // Guard against orphaned folders whose parent list no longer exists.
  const listIdSet = new Set(lists.map((l) => l.id));
  const myHeldInvs = myEmail
    ? allInvs.filter((inv) => listIdSet.has(inv.listId) && inv.currentHolder?.toLowerCase() === myEmail)
    : [];

  const renderHeldByYou = () => {
    if (myHeldInvs.length === 0) return null;
    return (
      <div className="held-section">
        <div className="held-title">Held by You · {myHeldInvs.length}</div>
        {myHeldInvs.map((inv) => (
          <AppListItem
            key={inv.id}
            title={inv.name || 'Unnamed Folder'}
            description={`Folder · In ${lists.find((l) => l.id === inv.listId)?.name || 'Unknown List'}`}
            leftIcon={iconBox(<Box size={18} color="var(--accent)" />)}
            onClick={() => goFolder(inv)}
          />
        ))}
      </div>
    );
  };

  const getArchivedDescription = (list) => {
    if (!list.isArchived) return undefined;
    let desc = '';
    if (list.archivedAt) {
      const date = list.archivedAt.toDate ? list.archivedAt.toDate() : new Date(list.archivedAt);
      desc += `Archived ${date.toLocaleDateString()}`;
    }
    if (list.archivedBy) {
      const u = usersList.find((x) => x.id === list.archivedBy);
      desc += desc
        ? ` by ${u ? u.name : list.archivedBy}`
        : `Archived by ${u ? u.name : list.archivedBy}`;
    }
    return desc || 'Archived collection';
  };

  const goList = (item) =>
    navigate(`/inventory/list/${item.id}`, { state: { listName: item.name } });
  const goFolder = (item) =>
    navigate(`/inventory/folder/${item.id}`, { state: { inventoryName: item.name } });
  const goItem = (item) =>
    navigate(`/inventory/item/${item.id}`, { state: { itemData: item } });

  const renderNormalView = () => (
    <>
      {renderHeldByYou()}
      <div className="chips-row">
        <AppChip selected={activeTab === 'active'} onClick={() => setActiveTab('active')}>
          Active Lists
        </AppChip>
        <AppChip selected={activeTab === 'archived'} onClick={() => setActiveTab('archived')}>
          Archived
        </AppChip>
      </div>

      {filteredLists.length === 0 ? (
        <AppEmptyState
          title={`No ${activeTab} lists`}
          description={`There are currently no ${activeTab} inventory lists created in the workspace.`}
          actionLabel={activeTab === 'active' ? 'Create First List' : undefined}
          onAction={activeTab === 'active' ? () => setIsAddModalVisible(true) : undefined}
        />
      ) : (
        filteredLists.map((item) => {
          const invCount = allInvs.filter((i) => i.listId === item.id).length;
          const desc = item.isArchived
            ? getArchivedDescription(item)
            : `${invCount} ${invCount === 1 ? 'folder' : 'folders'}`;
          return (
            <AppListItem
              key={item.id}
              title={item.name || 'Unnamed List'}
              description={desc}
              style={item.isArchived ? { opacity: 0.7 } : undefined}
              leftIcon={iconBox(
                <Layers size={18} color={item.isArchived ? 'var(--text-muted)' : 'var(--accent)'} />,
                item.isArchived
              )}
              rightElement={
                <span
                  role="button"
                  tabIndex={0}
                  style={{ padding: 8, display: 'flex', color: 'var(--text-secondary)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveToggle(item, !item.isArchived);
                  }}
                >
                  {item.isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                </span>
              }
              onClick={() => goList(item)}
              onDelete={() => handleDeleteList(item)}
            />
          );
        })
      )}
    </>
  );

  const renderSearchResults = () => {
    const q = searchQuery.toLowerCase();
    const listIds = new Set(lists.map((l) => l.id));
    const validInvs = allInvs.filter((i) => listIds.has(i.listId));
    const validInvIds = new Set(validInvs.map((i) => i.id));

    const matchedLists = lists.filter((l) => l.name?.toLowerCase().includes(q)).map((l) => ({ ...l, _type: 'list' }));
    const matchedInvs = validInvs.filter((i) => i.name?.toLowerCase().includes(q)).map((i) => ({ ...i, _type: 'folder' }));
    const matchedItems = allItems
      .filter((i) => validInvIds.has(i.inventoryId) && i.name?.toLowerCase().includes(q))
      .map((i) => ({ ...i, _type: 'item' }));
    const matchedUsers = usersList
      .filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .map((u) => ({ ...u, _type: 'user' }));

    const combined = [...matchedLists, ...matchedInvs, ...matchedItems, ...matchedUsers];

    if (combined.length === 0) {
      return (
        <AppEmptyState
          title="No matches found"
          description={`We couldn't find any lists, folders, items, or users matching "${searchQuery}".`}
        />
      );
    }

    return combined.map((item) => {
      let icon = <Layers size={18} color="var(--accent)" />;
      let subtitle = '';
      let onPress = () => {};

      if (item._type === 'list') {
        subtitle = 'Inventory List';
        onPress = () => goList(item);
      } else if (item._type === 'folder') {
        icon = <Folder size={18} color="#FF9800" />;
        subtitle = `Folder • In ${lists.find((l) => l.id === item.listId)?.name || 'Unknown List'}`;
        onPress = () => goFolder(item);
      } else if (item._type === 'item') {
        icon = <Box size={18} color="#A855F7" />;
        subtitle = `Item • Qty: ${item.quantity || 0}`;
        onPress = () => goItem(item);
      } else if (item._type === 'user') {
        icon = <User size={18} color="#66BB6A" />;
        const heldInvs = allInvs.filter(
          (inv) =>
            inv.currentHolder?.toLowerCase() === item.email?.toLowerCase() ||
            inv.currentHolder === item.id
        );
        subtitle = `${item.email || ''} • Holds ${heldInvs.length} folders`;
        onPress = () => {
          if (heldInvs.length > 0) goFolder(heldInvs[0]);
        };
      }

      return (
        <AppListItem
          key={item._type + '_' + item.id}
          title={item.name}
          description={subtitle}
          leftIcon={iconBox(icon)}
          onClick={onPress}
        />
      );
    });
  };

  if (!hasInventoryPermission) {
    return (
      <Screen title="Inventory">
        <div className="empty" style={{ paddingTop: 60 }}>
          <ShieldAlert size={64} color="var(--danger)" style={{ marginBottom: 16 }} />
          <div className="empty-title" style={{ fontSize: 20 }}>
            Access Denied
          </div>
          <div className="empty-msg">
            You do not have permission to view or manage inventory resources. Please contact an
            administrator if you need access.
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title="Inventory"
      headerRight={
        <>
          <InventoryScanButton surface="home" variant="compact" allInvs={allInvs} />
          {sheetEnabled && (
            <button type="button" className="sheet-btn" onClick={handleOpenSheet}>
              <Table size={16} color="var(--accent)" />
              <span>Open Sheet</span>
            </button>
          )}
        </>
      }
    >
      <AppSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchQuery ? 'Global Search...' : `Search ${activeTab} lists globally...`}
      />

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={68} />
          <AppSkeleton width="100%" height={68} />
          <AppSkeleton width="100%" height={68} />
        </div>
      ) : searchQuery.trim() ? (
        renderSearchResults()
      ) : (
        renderNormalView()
      )}

      {activeTab === 'active' && !searchQuery.trim() && (
        <AppFAB label="New List" onClick={() => setIsAddModalVisible(true)} />
      )}

      <AppModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title="Create Inventory List"
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setIsAddModalVisible(false)} style={{ flex: 1 }}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleAddList} disabled={!newListName.trim()} style={{ flex: 1 }}>
              Create List
            </AppButton>
          </div>
        }
      >
        <p className="t-body-secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          Give your inventory collection a descriptive name (e.g., Electronics, Drone Frames, Field
          Gear).
        </p>
        <AppInput
          label="List Name"
          value={newListName}
          onChangeText={setNewListName}
          placeholder="e.g. Drone Spare Parts"
          autoFocus
        />
      </AppModal>
    </Screen>
  );
}
