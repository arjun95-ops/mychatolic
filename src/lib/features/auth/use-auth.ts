// Auth Hook

'use client';

import { useEffect, useState } from 'react';
import { AuthService, type RegisterPayload } from './auth-service';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Profile, User } from '@/lib/types';

export function useAuth() {
  const { setUser, setProfile, setLoading, logout: storeLogout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  const syncSignedInUser = async (user: User | null) => {
    setUser(user);

    if (!user) {
      setProfile(null);
      return null;
    }

    const profile = await AuthService.getOrCreateProfile(user);
    const access = AuthService.ensureUserIsAllowed(user, profile);

    if (!access.allowed) {
      await AuthService.signOut();
      storeLogout();
      throw new Error(access.reason ?? 'Akses akun ditolak');
    }

    setProfile(profile);
    return profile;
  };

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        setLoading(true);
        const user = await AuthService.getCurrentUser();

        if (!mounted) return;

        try {
          await syncSignedInUser(user);
        } catch (error) {
          console.error('Error validating auth session:', error);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    }

    initializeAuth();

    // Listen to auth state changes
    const {
      data: { subscription },
    } = AuthService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        storeLogout();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        try {
          setLoading(true);
          const currentUser = session?.user ?? (await AuthService.getCurrentUser());
          await syncSignedInUser(currentUser);
        } catch (error) {
          console.error('Error syncing auth state:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setLoading, storeLogout]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const data = await AuthService.signIn(email, password);
      const profile = await syncSignedInUser(data.user ?? null);
      return {
        ...data,
        profile,
        requiresProfileCompletion: profile?.profile_filled === false,
      };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (payload: RegisterPayload) => {
    try {
      setLoading(true);
      return await AuthService.signUp(payload);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await AuthService.signOut();
      storeLogout();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    const { user, profile } = useAuthStore.getState();

    if (!user || !profile) {
      throw new Error('User not authenticated');
    }

    try {
      const updatedProfile = await AuthService.updateProfile(user.id, updates);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (error) {
      throw error;
    }
  };

  return {
    user: useAuthStore((state) => state.user),
    profile: useAuthStore((state) => state.profile),
    isLoading: useAuthStore((state) => state.isLoading),
    isAuthenticated: useAuthStore((state) => state.isAuthenticated),
    isInitialized,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
}
