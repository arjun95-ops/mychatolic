// Profile Hook

'use client';

import { useState, useEffect } from 'react';
import { ProfileService } from './profile-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import type { Profile, ProfileStats } from '@/lib/types';

export function useProfile(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    posts_count: 0,
    followers_count: 0,
    following_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    const resolvedUserId = targetUserId;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);

        const currentUserId = user?.id;
        const shouldCheckFollowing =
          Boolean(currentUserId) && resolvedUserId !== currentUserId;

        const [profileData, statsData, followingState] = await Promise.all([
          ProfileService.getProfile(resolvedUserId),
          ProfileService.getProfileStats(resolvedUserId),
          shouldCheckFollowing && currentUserId
            ? ProfileService.isFollowing(currentUserId, resolvedUserId).catch(() => false)
            : Promise.resolve(false),
        ]);

        setProfile(profileData);
        setStats(statsData);
        setIsFollowing(Boolean(followingState));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setIsFollowing(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [targetUserId, user?.id]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!targetUserId) {
      throw new Error('User ID not available');
    }

    try {
      const updatedProfile = await ProfileService.updateProfile(targetUserId, updates);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      throw err;
    }
  };

  const follow = async (targetId: string) => {
    if (!user?.id) {
      throw new Error('You must be logged in to follow');
    }

    await ProfileService.followUser(user.id, targetId);
    setIsFollowing(true);
    setStats(prev => ({
      ...prev,
      followers_count: prev.followers_count + 1,
    }));
  };

  const unfollow = async (targetId: string) => {
    if (!user?.id) {
      throw new Error('You must be logged in to unfollow');
    }

    await ProfileService.unfollowUser(user.id, targetId);
    setIsFollowing(false);
    setStats(prev => ({
      ...prev,
      followers_count: Math.max(0, prev.followers_count - 1),
    }));
  };

  const isOwnProfile = user?.id === targetUserId;

  return {
    profile,
    stats,
    isLoading,
    error,
    updateProfile,
    follow,
    unfollow,
    isFollowing,
    isOwnProfile,
  };
}

export function useFollows(userId: string) {
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFollows() {
      try {
        setIsLoading(true);
        const [followersData, followingData] = await Promise.all([
          ProfileService.getFollowers(userId),
          ProfileService.getFollowing(userId),
        ]);

        setFollowers(followersData);
        setFollowing(followingData);
      } catch (error) {
        console.error('Error loading follows:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadFollows();
  }, [userId]);

  return {
    followers,
    following,
    isLoading,
  };
}
