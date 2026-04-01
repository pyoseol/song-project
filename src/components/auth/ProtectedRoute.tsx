import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getStoredSessionToken } from '../../utils/authSession';
import { restoreSessionFromServer } from '../../utils/authApi';

export default function ProtectedRoute() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const [isReady, setIsReady] = useState(() => Boolean(user) || !getStoredSessionToken());

  useEffect(() => {
    const sessionToken = getStoredSessionToken();

    if (user || !sessionToken) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const response = await restoreSessionFromServer();

        if (cancelled) {
          return;
        }

        login({
          email: response.user.email,
          name: response.user.name,
          avatarUrl: response.user.avatarUrl,
          sessionToken: response.sessionToken,
        });
      } catch (error) {
        console.error(error);
        logout();
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [login, logout, user]);

  if (!isReady) {
    return <div style={{ minHeight: '100vh', background: '#15161a' }} />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
