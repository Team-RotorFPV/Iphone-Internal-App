import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../stores/authStore';

/**
 * Read custom claims off a signed-in user and confirm they are still an
 * active, non-archived member. Shared by the sign-in path and the auth
 * listener so the two can't drift apart.
 */
const resolveAuthorization = async (user) => {
  const idTokenResult = await user.getIdTokenResult();
  const claims = idTokenResult.claims;
  const hasAdminClaim = !!(claims.admin || claims.superAdmin);

  const userDocRef = doc(db, 'users', user.email.toLowerCase());
  const userDoc = await getDoc(userDocRef);
  const isActiveMember =
    userDoc.exists() &&
    userDoc.data().isActive !== false &&
    userDoc.data().isArchived !== true;

  return { claims, authorized: hasAdminClaim || isActiveMember };
};

const applyRoles = (user, claims) => {
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setRoles({
    admin: claims.admin,
    superAdmin: claims.superAdmin,
    inventory: claims.inventory,
    board: claims.board,
    media: claims.media,
  });
};

export const AuthService = {
  // Web Google sign-in — same flow the deployed sites use
  // (signInWithPopup + GoogleAuthProvider with select_account).
  signInWithGoogle: async () => {
    try {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setAuthError(null);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const { claims, authorized } = await resolveAuthorization(user);

      if (!authorized) {
        await signOut(auth);
        const err = new Error(
          `Access Denied: ${user.email} is not an authorized team member.`
        );
        useAuthStore.getState().setAuthError(err.message);
        throw err;
      }

      applyRoles(user, claims);
      return user;
    } catch (error) {
      // A cancelled popup is not a real error worth surfacing.
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.error('Google Sign-In Error:', error);
      if (!useAuthStore.getState().authError) {
        useAuthStore.getState().setAuthError(error.message || 'Sign-in failed.');
      }
      throw error;
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  },

  logout: async () => {
    try {
      useAuthStore.getState().setLoading(true);
      await signOut(auth);
      useAuthStore.getState().logout();
    } catch (error) {
      console.error('Logout Error:', error);
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  },

  initializeAuthListener: () => {
    return auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const { claims, authorized } = await resolveAuthorization(user);

          if (!authorized) {
            await signOut(auth);
            useAuthStore
              .getState()
              .setAuthError('You are not an authorized team member.');
            useAuthStore.getState().logout();
          } else {
            applyRoles(user, claims);
          }
        } catch (err) {
          // A network or cache failure here must not sign the user out — they
          // would be booted every time the app opens offline. Keep the session
          // and let the next successful check settle it.
          console.warn('Could not verify user status, keeping existing session:', err);
          useAuthStore.getState().setUser(user);
        }
      } else {
        useAuthStore.getState().logout();
      }
      useAuthStore.getState().setLoading(false);
    });
  },
};
