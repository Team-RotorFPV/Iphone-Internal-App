import { collection, query, onSnapshot, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const MessagesService = {
  subscribeToMessages: (callback) => {
    const q = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      callback(data);
    });
  },

  updateMessageStatus: async (id, newStatus) => {
    await updateDoc(doc(db, 'contact_messages', id), { status: newStatus });
    await logAdminAction(
      newStatus === 'read' ? 'Marked as Read' : 'Marked as Unread',
      'Contact Message',
      `Message was marked as ${newStatus}`
    );
  },

  deleteMessage: async (id) => {
    await deleteDoc(doc(db, 'contact_messages', id));
    await logAdminAction('Deleted', 'Contact Message', `Deleted message`);
  }
};
