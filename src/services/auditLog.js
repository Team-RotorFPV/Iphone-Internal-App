import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/authStore';

/**
 * Logs an inventory action to the audit_logs collection.
 * Mirrors the website's logInventoryAction implementation.
 * 
 * @param {string} action - The action performed (e.g., 'list_created', 'item_moved', 'holder_assigned')
 * @param {*} previousValue - The previous value before the action (can be string or object)
 * @param {*} newValue - The new value after the action (can be string or object)
 */
export const logInventoryAction = async (action, previousValue = null, newValue = null) => {
  try {
    const user = useAuthStore.getState().user;
    await addDoc(collection(db, 'audit_logs'), {
      userEmail: user?.email || 'unknown',
      action,
      previousValue: previousValue !== null ? (typeof previousValue === 'object' ? JSON.stringify(previousValue) : String(previousValue)) : null,
      newValue: newValue !== null ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Failed to log audit action:', error);
  }
};
