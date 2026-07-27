import { collection, query, onSnapshot, orderBy, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const UsersService = {
  subscribeToUsers: (callback) => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  updateUser: async (email, dataToSave, isNew, oldEmail) => {
    await setDoc(doc(db, 'users', email), dataToSave, { merge: true });
    
    if (!isNew && email !== oldEmail) {
      await deleteDoc(doc(db, 'users', oldEmail));
    }
    
    await logAdminAction(
      isNew ? 'CREATE' : 'UPDATE', 
      'TeamMember', 
      isNew ? `Created team member: ${email}` : `Updated team member: ${email}`
    );
  },

  archiveUser: async (email) => {
    await setDoc(doc(db, 'users', email), { isActive: false, isArchived: true, tags: [] }, { merge: true });
    await logAdminAction('ARCHIVED', 'TeamMember', `Archived team member: ${email}`);
  },

  subscribeToUser: (email, callback) => {
    const docRef = doc(db, 'users', email.toLowerCase());
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    });
  }
};
