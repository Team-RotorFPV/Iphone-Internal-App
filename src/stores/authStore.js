import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  roles: {
    admin: false,
    superAdmin: false,
    inventory: false,
    board: false,
    media: false,
  },
  isLoading: true,
  authError: null,

  setUser: (user) => set({ user }),
  setAuthError: (authError) => set({ authError }),
  
  setRoles: (roles) => set({ 
    roles: {
      admin: !!roles?.admin,
      superAdmin: !!roles?.superAdmin,
      inventory: !!roles?.inventory,
      board: !!roles?.board,
      media: !!roles?.media,
    }
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  hasPermission: (permissionName) => {
    const { roles } = get();
    // Super Admin has all permissions
    if (roles.superAdmin) return true;
    // Only Super Admin has superAdmin permission
    if (permissionName === 'superAdmin') return false;
    // Regular Admin has all permissions except superAdmin
    if (roles.admin) return true;
    return !!roles[permissionName];
  },
  
  logout: () => set({ 
    user: null, 
    roles: { admin: false, superAdmin: false, inventory: false, board: false, media: false } 
  }),
}));
