import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from './adminApi';

export const TeamService = {
  subscribeToTeamYears: (callback) => {
    const q = query(collection(db, 'team_years'), orderBy('year', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeToTeamMembers: (callback) => {
    const q = query(collection(db, 'team_members'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  getUsers: async () => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  addTeamMember: async (memberData, userEmail) => {
    const dataToSave = {
      ...memberData,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };
    const docRef = await addDoc(collection(db, 'team_members'), dataToSave);
    await logAdminAction('CREATE', 'TeamMember', `Added team member: ${memberData.userId}`);
    return docRef;
  },

  updateTeamMember: async (id, memberData, userEmail) => {
    const dataToSave = {
      ...memberData,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    };
    await updateDoc(doc(db, 'team_members', id), dataToSave);
    await logAdminAction('UPDATE', 'TeamMember', `Updated team member: ${memberData.userId}`);
  },

  deleteTeamMember: async (item) => {
    await deleteDoc(doc(db, 'team_members', item.id));
    await logAdminAction('DELETE', 'TeamMember', `Deleted team member: ${item.userId}`);
  }
};
