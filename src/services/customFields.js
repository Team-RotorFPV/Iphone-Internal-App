import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const CustomFieldsService = {
  subscribeToCustomFields: (callback) => {
    const q = query(collection(db, 'custom_fields'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  }
};
