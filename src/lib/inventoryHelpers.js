// Helpers shared by the inventory screens. These previously existed as
// near-duplicate copies in FolderDetailScreen and InventoryDetailScreen —
// including two `getRelativeTime` implementations that produced different
// output for the same input.

const MAX_TREE_DEPTH = 20;

/**
 * Human-readable "time ago" for a Firestore Timestamp, ISO string, or Date.
 */
export const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const seconds = typeof timestamp === 'object' && timestamp.seconds !== undefined
    ? timestamp.seconds
    : new Date(timestamp).getTime() / 1000;

  if (Number.isNaN(seconds)) return '';

  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 0) return 'Just now';
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
};

/**
 * Resolve a holder email to a display name, falling back to the email itself.
 */
export const getHolderName = (email, usersList = []) => {
  if (!email) return 'Unassigned';
  const userObj = usersList.find(u => u.email === email);
  return userObj?.name || email;
};

/**
 * Total item quantity in an inventory and all of its descendants.
 * Cycle-safe: a repeated id is never visited twice.
 */
export const calculateDescendantItemCount = (invId, allInvs = [], allItems = []) => {
  const ids = new Set([invId]);

  const collect = (parentId, depth) => {
    if (depth > MAX_TREE_DEPTH) return;
    for (const child of allInvs.filter(i => i.parentInventoryId === parentId)) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      collect(child.id, depth + 1);
    }
  };
  collect(invId, 0);

  return allItems.reduce(
    (total, item) => ids.has(item.inventoryId)
      ? total + (parseInt(item.quantity, 10) || 1)
      : total,
    0
  );
};

/**
 * Full human-readable location path for an inventory (folder/sub-folder),
 * from its list down to the folder itself, e.g. "Main List / Motors / Screws".
 * Walks the parent chain; cycle-safe. Pass an item's `inventoryId` to get the
 * path of the folder that contains it.
 */
export const buildInventoryPath = (inventoryId, allInvs = [], lists = []) => {
  const names = [];
  const seen = new Set();
  let current = allInvs.find(i => i.id === inventoryId);
  let listId = current?.listId;
  let depth = 0;

  while (current && !seen.has(current.id) && depth <= MAX_TREE_DEPTH) {
    names.unshift(current.name || 'Unnamed');
    seen.add(current.id);
    listId = current.listId || listId;
    if (!current.parentInventoryId) break;
    current = allInvs.find(i => i.id === current.parentInventoryId);
    depth++;
  }

  const listName = lists.find(l => l.id === listId)?.name;
  return [listName, ...names].filter(Boolean).join(' / ');
};

/**
 * Map an inventory status onto an AppBadge variant.
 */
export const getStatusBadgeVariant = (status) => {
  if (status === 'Available') return 'success';
  if (status === 'Missing') return 'warning';
  return 'danger'; // CheckedOut / custom
};

/**
 * Effective status for an inventory that may not have the field set.
 */
export const resolveStatus = (inventory = {}) =>
  inventory.status || (inventory.currentHolder ? 'CheckedOut' : 'Available');

/**
 * Immutably toggle an id inside a Set.
 */
export const toggleInSet = (set, id) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * Select-all / deselect-all against the currently visible rows.
 */
export const toggleSelectAll = (selectedSet, visibleItems = []) =>
  selectedSet.size === visibleItems.length && visibleItems.length > 0
    ? new Set()
    : new Set(visibleItems.map(i => i.id));
