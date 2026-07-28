import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

// Mirrors the website's SocialsTab: the same `social_links` collection and the
// same document shape ({ title, url, icon, order, enabled }), so links managed
// from here show up identically on socials.teamrotorfpv.com and the site footer.
export const SocialsService = {
  subscribeToSocials: (callback) => {
    const q = query(collection(db, 'social_links'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error('Error fetching social_links:', error);
        callback([]);
      }
    );
  },

  addSocial: async (data) => {
    const ref = await addDoc(collection(db, 'social_links'), data);
    await logAdminAction('CREATE', 'SocialLink', `Created social link: ${data.title}`);
    return ref;
  },

  updateSocial: async (id, data) => {
    await updateDoc(doc(db, 'social_links', id), data);
    await logAdminAction('UPDATE', 'SocialLink', `Updated social link: ${data.title}`);
  },

  setEnabled: async (item, enabled) => {
    await updateDoc(doc(db, 'social_links', item.id), { enabled });
    await logAdminAction(
      'UPDATE',
      'SocialLink',
      `${enabled ? 'Enabled' : 'Disabled'} social link: ${item.title}`
    );
  },

  deleteSocial: async (item) => {
    await deleteDoc(doc(db, 'social_links', item.id));
    await logAdminAction('DELETE', 'SocialLink', `Deleted social link: ${item.title}`);
  },
};
