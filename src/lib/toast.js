import { create } from 'zustand';

let idCounter = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],
  show: (message, type = 'default', duration = 3000) => {
    const id = ++idCounter;
    set({ toasts: [...get().toasts, { id, message, type }] });
    if (duration > 0) {
      setTimeout(() => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      }, duration);
    }
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Convenience helpers usable outside React components.
export const toast = {
  show: (msg, type, duration) => useToastStore.getState().show(msg, type, duration),
  success: (msg) => useToastStore.getState().show(msg, 'success'),
  error: (msg) => useToastStore.getState().show(msg, 'error'),
};

/**
 * Alert.alert replacement. Supports the common native shapes:
 *   alertConfirm({ title, message, confirmLabel, onConfirm, destructive })
 * Returns nothing; runs onConfirm if the user accepts.
 */
export const alertConfirm = ({ title, message, confirmLabel = 'OK', onConfirm, onCancel }) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  // window.confirm is reliable on iOS Safari and blocks until answered.
  if (window.confirm(text)) {
    onConfirm && onConfirm();
  } else {
    onCancel && onCancel();
  }
};
