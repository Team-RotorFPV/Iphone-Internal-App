import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { AuthService } from './services/auth';
import BottomNav from './components/BottomNav';
import ToastHost from './components/ToastHost';
import './components/shell.css';

// Screens
import LoginScreen from './screens/LoginScreen';
import InventoryListsScreen from './screens/inventory/InventoryListsScreen';
import InventoryDetailScreen from './screens/inventory/InventoryDetailScreen';
import FolderDetailScreen from './screens/inventory/FolderDetailScreen';
import ItemDetailScreen from './screens/inventory/ItemDetailScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import ManageGalleryScreen from './screens/admin/ManageGalleryScreen';
import ManageSponsorsScreen from './screens/admin/ManageSponsorsScreen';
import ManageHomeSettingsScreen from './screens/admin/ManageHomeSettingsScreen';
import ManageAchievementsScreen from './screens/admin/ManageAchievementsScreen';
import ManageTeamScreen from './screens/admin/ManageTeamScreen';
import ManageEventsScreen from './screens/admin/ManageEventsScreen';
import ManageContactMessagesScreen from './screens/admin/ManageContactMessagesScreen';
import ManageTeamMembersScreen from './screens/admin/ManageTeamMembersScreen';
import ProfileScreen from './screens/profile/ProfileScreen';

function Shell() {
  return (
    <div className="app-root">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function FullLoader() {
  return (
    <div className="full-center">
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = AuthService.initializeAuthListener();
    return () => unsubscribe();
  }, []);

  return (
    <>
      {isLoading ? (
        <FullLoader />
      ) : (
        <Routes>
          {!user ? (
            <>
              <Route path="/login" element={<LoginScreen />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <Route element={<Shell />}>
              <Route path="/inventory" element={<InventoryListsScreen />} />
              <Route path="/inventory/list/:listId" element={<InventoryDetailScreen />} />
              <Route path="/inventory/folder/:inventoryId" element={<FolderDetailScreen />} />
              <Route path="/inventory/item/:itemId" element={<ItemDetailScreen />} />

              <Route path="/admin" element={<AdminDashboardScreen />} />
              <Route path="/admin/gallery" element={<ManageGalleryScreen />} />
              <Route path="/admin/sponsors" element={<ManageSponsorsScreen />} />
              <Route path="/admin/home" element={<ManageHomeSettingsScreen />} />
              <Route path="/admin/achievements" element={<ManageAchievementsScreen />} />
              <Route path="/admin/board" element={<ManageTeamScreen />} />
              <Route path="/admin/events" element={<ManageEventsScreen />} />
              <Route path="/admin/messages" element={<ManageContactMessagesScreen />} />
              <Route path="/admin/team-members" element={<ManageTeamMembersScreen />} />

              <Route path="/profile" element={<ProfileScreen />} />

              <Route path="*" element={<Navigate to="/inventory" replace />} />
            </Route>
          )}
        </Routes>
      )}
      <ToastHost />
    </>
  );
}
