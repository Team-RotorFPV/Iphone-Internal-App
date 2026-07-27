import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { AuthService } from '../services/auth';
import { AppButton } from '../components/ui';
import './login.css';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const authError = useAuthStore((s) => s.authError);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await AuthService.signInWithGoogle();
    } catch {
      // Error is already surfaced via authStore.authError
    } finally {
      setLoading(false);
    }
  };

  const isDomainError =
    authError && /unauthorized[-_ ]?domain/i.test(authError);

  return (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-brand">
          <img src="/logo.png" alt="Team Rotor FPV" />
        </div>
        <h1 className="login-title">Team Rotor FPV</h1>
        <p className="login-subtitle">Internal Engineering Platform</p>

        <div className="login-button">
          <AppButton onClick={handleGoogleLogin} loading={loading} fullWidth size="lg">
            Sign in with Google
          </AppButton>
        </div>

        {authError && (
          <div className="login-error">
            {authError}
            {isDomainError && (
              <div className="login-error-hint">
                This device's address isn't authorized in Firebase yet. Add it under
                Authentication → Settings → Authorized domains, or open the app from an
                already-authorized domain.
              </div>
            )}
          </div>
        )}
      </div>
      <div className="login-footer">v3.0.0</div>
    </div>
  );
}
