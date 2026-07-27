import { create } from 'zustand';

export const useInventoryStore = create((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // You can also add offline/sync status here if needed
  isSyncing: false,
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
