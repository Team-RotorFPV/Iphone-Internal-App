import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCloudinaryImage, logAdminAction } from './adminApi';

export const GalleryService = {
  subscribeToGallery: (callback) => {
    const q = query(collection(db, 'gallery'), orderBy('order', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeToGallerySettings: (callback) => {
    return onSnapshot(doc(db, 'settings', 'gallery'), (docSnap) => {
      if (docSnap.exists()) {
        callback({ heroImageUrl: docSnap.data().heroImageUrl || '' });
      } else {
        callback({ heroImageUrl: '' });
      }
    });
  },

  updateGallerySettings: async (settingsData, userEmail) => {
    const dataToSave = {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };
    // setDoc+merge, not updateDoc: 'settings/gallery' is a singleton that does
    // not exist until it is first written, and updateDoc throws on a missing doc.
    await setDoc(doc(db, 'settings', 'gallery'), dataToSave, { merge: true });
    await logAdminAction('UPDATE', 'GallerySettings', 'Updated Gallery Hero Image');
  },

  addGalleryItem: async (galleryData, userEmail) => {
    const dataToSave = {
      ...galleryData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'gallery'), dataToSave);
    await logAdminAction('CREATE', 'Gallery', `Added gallery image`);
    return docRef;
  },

  updateGalleryItem: async (id, oldItem, newItemData, userEmail) => {
    const dataToSave = {
      ...newItemData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };

    if (oldItem && oldItem.img && oldItem.img !== newItemData.img) {
      await deleteCloudinaryImage(oldItem.img);
    }

    await updateDoc(doc(db, 'gallery', id), dataToSave);
    await logAdminAction('UPDATE', 'Gallery', `Updated gallery image`);
  },

  deleteGalleryItem: async (item) => {
    await deleteDoc(doc(db, 'gallery', item.id));
    if (item.img) {
      await deleteCloudinaryImage(item.img);
    }
    await logAdminAction('DELETE', 'Gallery', `Deleted gallery image`);
  }
};
