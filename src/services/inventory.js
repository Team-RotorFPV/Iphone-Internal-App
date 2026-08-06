import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logInventoryAction } from './auditLog';
import { useAuthStore } from '../stores/authStore';

const getUserEmail = () => useAuthStore.getState().user?.email || 'unknown';

export const InventoryService = {
  // ─── SUBSCRIPTIONS ────────────────────────────────────────────────

  subscribeToLists: (callback) => {
    const q = query(collection(db, 'inventory_lists'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error("Error subscribing to lists:", error);
    });
  },

  subscribeToInventories: (listId, callback) => {
    const q = query(collection(db, 'inventories'), where('listId', '==', listId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(data);
    });
  },

  subscribeToSubInventories: (inventoryId, callback) => {
    const q = query(collection(db, 'inventories'), where('parentInventoryId', '==', inventoryId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(data);
    });
  },

  subscribeToItems: (inventoryId, callback) => {
    const q = query(collection(db, 'items'), where('inventoryId', '==', inventoryId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeToAllInventories: (callback) => {
    const q = query(collection(db, 'inventories'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeToAllItems: (callback) => {
    const q = query(collection(db, 'items'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  // ─── ONE-SHOT GETTERS ─────────────────────────────────────────────

  getInventory: async (inventoryId) => {
    const snap = await getDoc(doc(db, 'inventories', inventoryId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  getItem: async (itemId) => {
    const snap = await getDoc(doc(db, 'items', itemId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  // ─── LIST CRUD ────────────────────────────────────────────────────

  addList: async (name) => {
    const userEmail = getUserEmail();
    const docRef = await addDoc(collection(db, 'inventory_lists'), {
      name,
      isArchived: false,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    });
    await logInventoryAction('list_created', null, name);
    return docRef;
  },

  archiveList: async (listId, isArchived) => {
    const userEmail = getUserEmail();
    const listDoc = await getDoc(doc(db, 'inventory_lists', listId));
    const listName = listDoc.data()?.name || listId;

    const updateData = { isArchived };
    if (isArchived) {
      updateData.archivedAt = new Date().toISOString();
      updateData.archivedBy = userEmail;
    } else {
      updateData.archivedAt = null;
      updateData.archivedBy = null;
    }

    await updateDoc(doc(db, 'inventory_lists', listId), updateData);
    await logInventoryAction(
      isArchived ? 'list_archived' : 'list_restored',
      listName,
      isArchived ? 'Archived' : 'Restored'
    );
  },

  deleteList: async (listId) => {
    const listDoc = await getDoc(doc(db, 'inventory_lists', listId));
    const listName = listDoc.data()?.name || listId;

    const invQuery = query(collection(db, 'inventories'), where('listId', '==', listId));
    const invSnap = await getDocs(invQuery);
    
    const inventoriesToDelete = [];
    invSnap.forEach(d => inventoriesToDelete.push(d.id));

    for (const invId of inventoriesToDelete) {
      const itemQuery = query(collection(db, 'items'), where('inventoryId', '==', invId));
      const itemSnap = await getDocs(itemQuery);
      await Promise.all(itemSnap.docs.map(itemDoc => deleteDoc(doc(db, 'items', itemDoc.id))));
      
      const itemHistQuery = query(collection(db, 'item_history'), where('inventoryId', '==', invId));
      const itemHistSnap = await getDocs(itemHistQuery);
      await Promise.all(itemHistSnap.docs.map(d => deleteDoc(doc(db, 'item_history', d.id))));

      const holdHistQuery = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', invId));
      const holdHistSnap = await getDocs(holdHistQuery);
      await Promise.all(holdHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_hold_history', d.id))));

      const moveHistQuery = query(collection(db, 'inventory_movement_history'), where('inventoryId', '==', invId));
      const moveHistSnap = await getDocs(moveHistQuery);
      await Promise.all(moveHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_movement_history', d.id))));
      
      await deleteDoc(doc(db, 'inventories', invId));
    }

    await deleteDoc(doc(db, 'inventory_lists', listId));
    await logInventoryAction('list_deleted', listName, null);
  },

  // ─── INVENTORY CRUD ───────────────────────────────────────────────

  addInventory: async (listId, name) => {
    const userEmail = getUserEmail();
    const docRef = await addDoc(collection(db, 'inventories'), {
      listId,
      name,
      parentInventoryId: null,
      status: 'Available',
      currentHolder: null,
      currentRoom: null,
      currentAssignedDate: null,
      previousHolder: null,
      previousRoom: null,
      previousAssignedDate: null,
      createdBy: userEmail,
      createdAt: serverTimestamp(),
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail
    });
    await logInventoryAction('inventory_created', null, name);
    return docRef;
  },

  addSubInventory: async (listId, parentId, name) => {
    const userEmail = getUserEmail();
    const docRef = await addDoc(collection(db, 'inventories'), {
      listId,
      name,
      parentInventoryId: parentId,
      status: 'Available',
      currentHolder: null,
      currentRoom: null,
      currentAssignedDate: null,
      previousHolder: null,
      previousRoom: null,
      previousAssignedDate: null,
      createdBy: userEmail,
      createdAt: serverTimestamp(),
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail
    });
    await logInventoryAction('sub_inventory_created', null, `${name} (parent: ${parentId})`);
    return docRef;
  },

  updateInventory: async (inventoryId, data) => {
    const userEmail = getUserEmail();
    await updateDoc(doc(db, 'inventories', inventoryId), {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail
    });
  },

  updateInventoryStatus: async (inventoryId, newStatus) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();
    
    const invDoc = await getDoc(doc(db, 'inventories', inventoryId));
    const invData = invDoc.data();
    const oldStatus = invData?.status || 'Available';

    const updateData = {
      status: newStatus,
      updatedAt: now,
      updatedBy: userEmail
    };

    // If marking as Available, clear holder info and close hold history
    if (newStatus === 'Available' && invData?.currentHolder) {
      updateData.previousHolder = invData.currentHolder;
      updateData.previousRoom = invData.currentRoom;
      updateData.previousAssignedDate = invData.currentAssignedDate;
      updateData.currentHolder = null;
      updateData.currentRoom = null;
      updateData.currentAssignedDate = null;

      // Close open hold history records
      const histQuery = query(collection(db, 'inventory_hold_history'),
        where('inventoryId', '==', inventoryId),
        where('removedDate', '==', null)
      );
      const histSnap = await getDocs(histQuery);
      await Promise.all(histSnap.docs.map(d =>
        updateDoc(doc(db, 'inventory_hold_history', d.id), { removedDate: now })
      ));
    }

    await updateDoc(doc(db, 'inventories', inventoryId), updateData);
    await logInventoryAction('inventory_status_changed', oldStatus, newStatus);
  },

  /**
   * Delete an individual inventory. Prevents deletion if sub-inventories exist.
   * Returns { success: boolean, error?: string }
   */
  deleteInventory: async (inventoryId) => {
    // Check for sub-inventories
    const subInvQuery = query(collection(db, 'inventories'), where('parentInventoryId', '==', inventoryId));
    const subInvSnap = await getDocs(subInvQuery);
    
    if (!subInvSnap.empty) {
      return { success: false, error: 'Cannot delete: This inventory has sub-inventories. Delete them first.' };
    }

    const invDoc = await getDoc(doc(db, 'inventories', inventoryId));
    const invName = invDoc.data()?.name || inventoryId;

    // Delete all items in this inventory
    const itemQuery = query(collection(db, 'items'), where('inventoryId', '==', inventoryId));
    const itemSnap = await getDocs(itemQuery);
    await Promise.all(itemSnap.docs.map(itemDoc => deleteDoc(doc(db, 'items', itemDoc.id))));

    // Delete item history
    const itemHistQuery = query(collection(db, 'item_history'), where('inventoryId', '==', inventoryId));
    const itemHistSnap = await getDocs(itemHistQuery);
    await Promise.all(itemHistSnap.docs.map(d => deleteDoc(doc(db, 'item_history', d.id))));

    // Delete hold history
    const holdHistQuery = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', inventoryId));
    const holdHistSnap = await getDocs(holdHistQuery);
    await Promise.all(holdHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_hold_history', d.id))));

    // Delete movement history
    const moveHistQuery = query(collection(db, 'inventory_movement_history'), where('inventoryId', '==', inventoryId));
    const moveHistSnap = await getDocs(moveHistQuery);
    await Promise.all(moveHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_movement_history', d.id))));

    await deleteDoc(doc(db, 'inventories', inventoryId));
    await logInventoryAction('inventory_deleted', invName, null);
    return { success: true };
  },

  // ─── HOLDER ASSIGNMENT ────────────────────────────────────────────

  assignHolder: async (inventoryId, newHolderEmail, roomNumber, currentHolder, currentRoom, currentAssignedDate, assignedByEmail) => {
    const now = new Date().toISOString();
    
    // If there was a current holder, mark their hold history as removed
    if (currentHolder) {
      const histQuery = query(collection(db, 'inventory_hold_history'), 
        where('inventoryId', '==', inventoryId),
        where('userId', '==', currentHolder),
        where('removedDate', '==', null)
      );
      const histSnap = await getDocs(histQuery);
      await Promise.all(histSnap.docs.map(docSnap =>
        updateDoc(doc(db, 'inventory_hold_history', docSnap.id), { removedDate: now })
      ));
    }

    // Add new hold history
    await addDoc(collection(db, 'inventory_hold_history'), {
      inventoryId,
      userId: newHolderEmail,
      roomId: roomNumber || 'Unknown',
      assignedDate: now,
      removedDate: null
    });

    // Update the inventory itself
    await updateDoc(doc(db, 'inventories', inventoryId), {
      previousHolder: currentHolder || null,
      previousRoom: currentRoom || null,
      previousAssignedDate: currentAssignedDate || null,
      currentHolder: newHolderEmail,
      currentRoom: roomNumber || 'Unknown',
      currentAssignedDate: now,
      status: 'CheckedOut',
      updatedAt: now,
      updatedBy: assignedByEmail || ''
    });

    await logInventoryAction('holder_assigned', currentHolder || 'None', newHolderEmail);
  },

  // ─── INVENTORY (FOLDER) SELF-CUSTODY ──────────────────────────────
  // "Hold this" for a folder/sub-folder: the acting user becomes the explicit
  // holder. Releasing clears the explicit holder so it reverts to inheriting an
  // ancestor folder's holder (see lib/custody.js).

  holdInventory: async (inventoryId, holderEmail, room) => {
    const invDoc = await getDoc(doc(db, 'inventories', inventoryId));
    const d = invDoc.data() || {};
    await InventoryService.assignHolder(
      inventoryId,
      holderEmail,
      room || d.currentRoom || 'Unknown',
      d.currentHolder,
      d.currentRoom,
      d.currentAssignedDate,
      holderEmail
    );
  },

  releaseInventory: async (inventoryId) => {
    // Marking Available clears the explicit holder and closes open hold history.
    await InventoryService.updateInventoryStatus(inventoryId, 'Available');
  },

  // ─── ITEM CUSTODY ─────────────────────────────────────────────────
  // An explicit item holder overrides the inherited folder holder; releasing it
  // reverts the item to inheriting its parent folder's holder. Effective holder
  // is computed in lib/custody.js, never denormalised.

  // `room` is optional. Self-hold passes the acting user's room; "Assign Team
  // Holder" passes the chosen member's room — mirroring folder assignHolder so
  // items carry the same currentRoom / currentAssignedDate custody fields.
  holdItem: async (itemId, holderEmail, room) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();

    const itemDoc = await getDoc(doc(db, 'items', itemId));
    const itemData = itemDoc.data();
    const previousHolder = itemData?.currentHolder || null;

    await updateDoc(doc(db, 'items', itemId), {
      currentHolder: holderEmail,
      currentRoom: room || itemData?.currentRoom || 'Unknown',
      currentAssignedDate: now,
      currentHolderSince: now,
      previousHolder,
      previousRoom: itemData?.currentRoom || null,
      previousAssignedDate: itemData?.currentAssignedDate || null,
      updatedAt: now,
      updatedBy: userEmail,
    });

    await addDoc(collection(db, 'item_history'), {
      itemId,
      inventoryId: itemData?.inventoryId,
      itemName: itemData?.name,
      action: 'held',
      previousHolder,
      newHolder: holderEmail,
      roomId: room || itemData?.currentRoom || 'Unknown',
      userId: userEmail,
      timestamp: now,
    });

    await logInventoryAction('item_held', previousHolder || 'None', holderEmail);
  },

  releaseItem: async (itemId) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();

    const itemDoc = await getDoc(doc(db, 'items', itemId));
    const itemData = itemDoc.data();
    const previousHolder = itemData?.currentHolder || null;

    // Clearing the explicit holder reverts the item to inheriting its folder.
    await updateDoc(doc(db, 'items', itemId), {
      currentHolder: null,
      currentHolderSince: null,
      currentRoom: null,
      currentAssignedDate: null,
      previousHolder,
      previousRoom: itemData?.currentRoom || null,
      previousAssignedDate: itemData?.currentAssignedDate || null,
      updatedAt: now,
      updatedBy: userEmail,
    });

    await addDoc(collection(db, 'item_history'), {
      itemId,
      inventoryId: itemData?.inventoryId,
      itemName: itemData?.name,
      action: 'released',
      previousHolder,
      newHolder: null,
      userId: userEmail,
      timestamp: now,
    });

    await logInventoryAction('item_released', previousHolder || 'None', null);
  },

  // ─── ITEM CRUD ────────────────────────────────────────────────────

  addItem: async (inventoryId, itemData) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();

    const docRef = await addDoc(collection(db, 'items'), {
      inventoryId,
      name: itemData.name,
      quantity: itemData.quantity || 1,
      category: itemData.category || '',
      createdAt: serverTimestamp(),
      createdBy: userEmail,
      updatedAt: now,
      updatedBy: userEmail,
      previousUpdatedAt: null,
      previousUpdatedBy: null
    });

    // Log to item_history with rich detail
    await addDoc(collection(db, 'item_history'), {
      itemId: docRef.id,
      inventoryId,
      itemName: itemData.name,
      action: 'created',
      newQuantity: itemData.quantity || 1,
      userId: userEmail,
      timestamp: now
    });

    await logInventoryAction('item_created', null, `${itemData.name} (qty: ${itemData.quantity || 1})`);
    return docRef;
  },

  updateItem: async (itemId, data) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();

    // Get current item data for history comparison
    const itemDoc = await getDoc(doc(db, 'items', itemId));
    const currentData = itemDoc.data();

    // Build update payload with metadata
    const updatePayload = {
      ...data,
      previousUpdatedAt: currentData?.updatedAt || null,
      previousUpdatedBy: currentData?.updatedBy || null,
      updatedAt: now,
      updatedBy: userEmail
    };

    await updateDoc(doc(db, 'items', itemId), updatePayload);

    // Log specific changes to item_history
    if (data.quantity !== undefined && data.quantity !== currentData?.quantity) {
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: currentData?.inventoryId,
        itemName: data.name || currentData?.name,
        action: 'quantity_changed',
        previousQuantity: currentData?.quantity,
        newQuantity: data.quantity,
        userId: userEmail,
        timestamp: now
      });
      await logInventoryAction('item_quantity_changed', `${currentData?.name}: ${currentData?.quantity}`, `${data.name || currentData?.name}: ${data.quantity}`);
    }

    if (data.name !== undefined && data.name !== currentData?.name) {
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: currentData?.inventoryId,
        itemName: data.name,
        action: 'name_changed',
        previousName: currentData?.name,
        newName: data.name,
        userId: userEmail,
        timestamp: now
      });
      await logInventoryAction('item_name_changed', currentData?.name, data.name);
    }

    if (data.inventoryId !== undefined && data.inventoryId !== currentData?.inventoryId) {
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: data.inventoryId,
        itemName: data.name || currentData?.name,
        action: 'moved',
        previousInventoryId: currentData?.inventoryId,
        userId: userEmail,
        timestamp: now
      });
      await logInventoryAction('item_moved', currentData?.inventoryId, data.inventoryId);
    }
  },

  deleteItem: async (itemId) => {
    const itemDoc = await getDoc(doc(db, 'items', itemId));
    const itemData = itemDoc.data();
    const userEmail = getUserEmail();
    const now = new Date().toISOString();

    // Log deletion to item_history
    if (itemData) {
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: itemData.inventoryId,
        itemName: itemData.name,
        action: 'deleted',
        previousQuantity: itemData.quantity,
        userId: userEmail,
        timestamp: now
      });
    }

    await deleteDoc(doc(db, 'items', itemId));
    await logInventoryAction('item_deleted', itemData?.name || itemId, null);
  },

  // ─── HISTORY ──────────────────────────────────────────────────────

  subscribeToHistory: (inventoryId, callback) => {
    const qHold = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', inventoryId));
    const qItem = query(collection(db, 'item_history'), where('inventoryId', '==', inventoryId));
    
    let holdData = [];
    let itemData = [];

    const triggerCallback = () => {
      const combined = [...holdData, ...itemData].sort((a, b) => b.timestamp - a.timestamp);
      callback(combined);
    };

    const unsubHold = onSnapshot(qHold, (snap) => {
      const data = [];
      snap.docs.forEach(d => {
        const docData = d.data();
        data.push({
          id: d.id + '_assign',
          action: 'Holder Assigned',
          actionType: 'holder_assigned',
          details: `${docData.userId}`,
          roomId: docData.roomId,
          userId: docData.userId,
          timestamp: new Date(docData.assignedDate)
        });
        if (docData.removedDate) {
          data.push({
            id: d.id + '_remove',
            action: 'Holder Removed',
            actionType: 'holder_removed',
            details: `${docData.userId}`,
            roomId: docData.roomId,
            userId: docData.userId,
            timestamp: new Date(docData.removedDate)
          });
        }
      });
      holdData = data;
      triggerCallback();
    });

    const unsubItem = onSnapshot(qItem, (snap) => {
      itemData = snap.docs.map(d => {
        const docData = d.data();
        let details = docData.itemName || '';
        let action = '';

        switch (docData.action) {
          case 'created':
            action = 'Item Added';
            details = `${docData.itemName} (Qty: ${docData.newQuantity || 1})`;
            break;
          case 'quantity_changed':
            action = 'Quantity Edited';
            details = `${docData.itemName}: ${docData.previousQuantity} → ${docData.newQuantity}`;
            break;
          case 'name_changed':
            action = 'Item Renamed';
            details = `${docData.previousName} → ${docData.newName}`;
            break;
          case 'moved':
            action = 'Item Moved';
            details = `${docData.itemName}`;
            break;
          case 'deleted':
            action = 'Item Deleted';
            details = `${docData.itemName} (Qty: ${docData.previousQuantity || 0})`;
            break;
          default:
            action = `Item ${docData.action || 'Updated'}`;
            details = docData.itemName || '';
        }

        return {
          id: d.id,
          action,
          actionType: docData.action,
          details,
          previousQuantity: docData.previousQuantity,
          newQuantity: docData.newQuantity,
          userId: docData.userId,
          timestamp: new Date(docData.timestamp)
        };
      });
      triggerCallback();
    });

    return () => {
      unsubHold();
      unsubItem();
    };
  },

  // ─── MOVE WITH HISTORY ────────────────────────────────────────────

  moveInventory: async (inventoryId, destination, allInvs) => {
    const userEmail = getUserEmail();
    const now = new Date().toISOString();
    const invDoc = await getDoc(doc(db, 'inventories', inventoryId));
    const invData = invDoc.data();

    const updateData = {
      updatedAt: now,
      updatedBy: userEmail
    };

    if (destination.type === 'list') {
      updateData.listId = destination.id;
      updateData.parentInventoryId = null;
    } else {
      const targetInv = allInvs.find(i => i.id === destination.id);
      updateData.listId = targetInv?.listId || invData?.listId;
      updateData.parentInventoryId = destination.id;
    }

    await updateDoc(doc(db, 'inventories', inventoryId), updateData);

    // Log to movement history
    await addDoc(collection(db, 'inventory_movement_history'), {
      inventoryId,
      previousListId: invData?.listId,
      previousParentId: invData?.parentInventoryId,
      newListId: updateData.listId,
      newParentId: updateData.parentInventoryId || null,
      movedBy: userEmail,
      timestamp: now
    });

    await logInventoryAction('inventory_moved', invData?.name, `Moved to ${destination.name}`);
  }
};
