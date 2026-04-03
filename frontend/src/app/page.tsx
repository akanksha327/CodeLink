'use client';

import { useMentorshipStore } from '@/store/mentorship-store';
import { AuthPage } from '@/components/mentorship/auth-page';
import { Dashboard } from '@/components/mentorship/dashboard';
import { Workspace } from '@/components/mentorship/workspace';
import { Profile } from '@/components/mentorship/profile';
import { Toaster } from '@/components/ui/toast';
import { useEffect } from 'react';
import { restoreBackendSessionFromFirebase } from '@/lib/firebase-auth';
import { getFirebaseAnalytics } from '@/lib/firebase';

export default function Home() {
  const { isAuthenticated, user, currentView, setUser, activateDueSessions } = useMentorshipStore();

  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  // Check for stored user session on mount
  useEffect(() => {
    let isMounted = true;

    const hydrateUser = async () => {
      const storedUser = localStorage.getItem('mentorship_user');

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (isMounted) {
            setUser(parsedUser);
          }
        } catch {
          localStorage.removeItem('mentorship_user');
        }
      }

      try {
        const response = await fetch('/api/auth/me');

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          return;
        }

        if (response.status === 401) {
          const restoredUser = await restoreBackendSessionFromFirebase();

          if (restoredUser) {
            setUser(restoredUser);
            return;
          }

          setUser(null);
        }
      } catch (error) {
        console.error('Failed to hydrate user session:', error);
      }
    };

    hydrateUser();

    return () => {
      isMounted = false;
    };
  }, [setUser]);

  // Store user in localStorage when authenticated
  useEffect(() => {
    if (user) {
      localStorage.setItem('mentorship_user', JSON.stringify(user));
    } else {
      // User is null (logged out), ensure localStorage is cleared
      localStorage.removeItem('mentorship_user');
    }
  }, [user]);

  useEffect(() => {
    activateDueSessions();

    const intervalId = window.setInterval(() => {
      activateDueSessions();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [activateDueSessions]);

  // Not authenticated - show auth page
  if (!isAuthenticated || !user) {
    return (
      <>
        <AuthPage />
        <Toaster />
      </>
    );
  }

  // Authenticated - show view based on currentView state
  return (
    <>
      {currentView === 'workspace' && <Workspace />}
      {currentView === 'profile' && <Profile />}
      {(currentView === 'dashboard' || !currentView) && <Dashboard />}
      <Toaster />
    </>
  );
}
