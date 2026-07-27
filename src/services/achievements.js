import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCloudinaryImage, logAdminAction } from './adminApi';

export const AchievementsService = {
  subscribeToAchievements: (callback) => {
    const q = query(collection(db, 'achievements'), orderBy('order', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error("Error fetching achievements:", error);
      callback([]);
    });
  },

  addAchievement: async (achievementData, userEmail) => {
    const dataToSave = {
      ...achievementData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'achievements'), dataToSave);
    await logAdminAction('CREATE', 'Achievement', `Added achievement: ${achievementData.title}`);
    return docRef;
  },

  updateAchievement: async (id, oldItem, newItemData, userEmail) => {
    const dataToSave = {
      ...newItemData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };

    if (oldItem && oldItem.image && oldItem.image !== newItemData.image) {
      await deleteCloudinaryImage(oldItem.image);
    }

    await updateDoc(doc(db, 'achievements', id), dataToSave);
    await logAdminAction('UPDATE', 'Achievement', `Updated achievement: ${newItemData.title}`);
  },

  deleteAchievement: async (item) => {
    await deleteDoc(doc(db, 'achievements', item.id));
    if (item.image) {
      await deleteCloudinaryImage(item.image);
    }
    await logAdminAction('DELETE', 'Achievement', `Deleted achievement: ${item.title}`);
  }
};
