import { create } from 'zustand';
import { TagsService } from '../services/tags';

export const useTagStore = create((set, get) => ({
  tags: [],
  loading: false,
  initialized: false,
  unsubscribe: null,

  initTags: () => {
    // Subscribing is a side effect, so it must happen outside a set() updater —
    // updaters have to stay pure or StrictMode double-invocation leaks a listener.
    // `initialized` flips synchronously here (not in the async callback) so a
    // second call during the same tick can't open a duplicate subscription.
    if (get().initialized) return;

    set({ loading: true, initialized: true });

    const unsub = TagsService.subscribeToTags((data) => {
      set({ tags: data, loading: false });
    });

    set({ unsubscribe: unsub });
  },

  cleanup: () => {
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe();
    set({ tags: [], loading: false, initialized: false, unsubscribe: null });
  }
}));
