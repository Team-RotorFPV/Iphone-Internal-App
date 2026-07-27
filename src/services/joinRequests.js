import { collection, query, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const JoinRequestsService = {
  subscribeToPendingRequests: (callback) => {
    const q = query(collection(db, 'join_requests'), where('status', '==', 'pending'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  rejectRequest: async (requestId) => {
    await updateDoc(doc(db, 'join_requests', requestId), { status: 'rejected' });
    await logAdminAction('REJECT', 'JoinRequest', `Rejected join request: ${requestId}`);
  }
};
