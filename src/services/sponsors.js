import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCloudinaryImage, logAdminAction } from './adminApi';

const DEFAULT_PAGE_SETTINGS = {
  title: 'Sponsor Us',
  description: '',
  teamImage: { url: '', publicId: '' },
  brochure: { url: '', publicId: '', name: '' },
  whySponsorUs: ''
};

export const SponsorsService = {
  subscribeToSponsors: (callback) => {
    const q = query(collection(db, 'sponsors'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeToSponsorSettings: (callback) => {
    return onSnapshot(doc(db, 'settings', 'sponsors'), (docSnap) => {
      if (docSnap.exists()) {
        callback({
          title: docSnap.data().title || 'Sponsor Us',
          description: docSnap.data().description || '',
          teamImage: docSnap.data().teamImage || { url: '', publicId: '' },
          brochure: docSnap.data().brochure || { url: '', publicId: '', name: '' },
          whySponsorUs: docSnap.data().whySponsorUs || ''
        });
      } else {
        callback(DEFAULT_PAGE_SETTINGS);
      }
    });
  },

  updateSponsorSettings: async (settingsData, userEmail) => {
    const dataToSave = {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };
    // setDoc+merge, not updateDoc: 'settings/sponsors' is a singleton that does
    // not exist until it is first written, and updateDoc throws on a missing doc.
    await setDoc(doc(db, 'settings', 'sponsors'), dataToSave, { merge: true });
    await logAdminAction('UPDATE', 'SponsorsSettings', 'Updated Sponsor Us Page Settings');
  },

  addSponsor: async (sponsorData, userEmail) => {
    const dataToSave = {
      ...sponsorData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'sponsors'), dataToSave);
    await logAdminAction('CREATE', 'Sponsor', `Added sponsor: ${sponsorData.name}`);
    return docRef;
  },

  updateSponsor: async (id, oldItem, newItemData, userEmail) => {
    const dataToSave = {
      ...newItemData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };

    if (oldItem && oldItem.logo && oldItem.logo !== newItemData.logo) {
      await deleteCloudinaryImage(oldItem.logo);
    }

    await updateDoc(doc(db, 'sponsors', id), dataToSave);
    await logAdminAction('UPDATE', 'Sponsor', `Updated sponsor: ${newItemData.name}`);
  },

  deleteSponsor: async (item) => {
    await deleteDoc(doc(db, 'sponsors', item.id));
    if (item.logo) {
      await deleteCloudinaryImage(item.logo);
    }
    await logAdminAction('DELETE', 'Sponsor', `Deleted sponsor: ${item.name}`);
  }
};
