import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const TagsService = {
  subscribeToTags: (callback) => {
    const q = query(collection(db, 'tags'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  addTag: async (tagData, userEmail) => {
    const dataToSave = {
      ...tagData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'tags'), dataToSave);
    await logAdminAction('CREATE', 'Tag', `Added tag: ${tagData.name}`);
    return docRef;
  },

  updateTag: async (id, tagData, userEmail) => {
    const dataToSave = {
      ...tagData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };
    await updateDoc(doc(db, 'tags', id), dataToSave);
    await logAdminAction('UPDATE', 'Tag', `Updated tag: ${tagData.name}`);
  },

  deleteTag: async (item) => {
    await deleteDoc(doc(db, 'tags', item.id));
    await logAdminAction('DELETE', 'Tag', `Deleted tag: ${item.name}`);
  }
};
