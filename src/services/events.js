import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCloudinaryImage, moveCloudinaryImage, logAdminAction } from './adminApi';

export const EventsService = {
  subscribeToEvents: (callback) => {
    // We order by 'order' asc to match website
    const q = query(collection(db, 'events'), orderBy('order', 'asc')); 
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  addEvent: async (eventData, userEmail) => {
    const dataToSave = {
      ...eventData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'events'), dataToSave);
    await logAdminAction('CREATE', 'Event', `Created event: ${eventData.name}`);
    return docRef;
  },

  updateEvent: async (id, oldEvent, newEventData, userEmail) => {
    const dataToSave = {
      ...newEventData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };

    const imageChanged = !oldEvent || oldEvent.image !== newEventData.image;
    if (oldEvent && oldEvent.image && imageChanged) {
      await deleteCloudinaryImage(oldEvent.image);
    } else if (!imageChanged && oldEvent.status !== newEventData.status) {
      const safeName = newEventData.name.trim().replace(/\s+/g, '-');
      dataToSave.image = await moveCloudinaryImage(
        newEventData.image,
        `events/${newEventData.status}/${safeName}`
      );
    }

    await updateDoc(doc(db, 'events', id), dataToSave);
    await logAdminAction('UPDATE', 'Event', `Updated event: ${newEventData.name}`);
  },

  deleteEvent: async (item) => {
    await deleteDoc(doc(db, 'events', item.id));
    if (item.image) {
      await deleteCloudinaryImage(item.image);
    }
    if (item.galleryImages && item.galleryImages.length > 0) {
      for (const url of item.galleryImages) {
        await deleteCloudinaryImage(url);
      }
    }
    await logAdminAction('DELETE', 'Event', `Deleted event: ${item.name}`);
  }
};
