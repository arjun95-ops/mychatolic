// Profile Service

import { supabase } from '@/lib/supabase/client';
import type { Profile, Follow, ProfileStats } from '@/lib/types';

export class ProfileService {
  private static isBucketRetryableError(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return (
      (
        lowerMessage.includes('bucket') &&
        (lowerMessage.includes('not found') || lowerMessage.includes('does not exist'))
      ) ||
      lowerMessage.includes('permission denied') ||
      lowerMessage.includes('row-level security') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden')
    );
  }

  private static async uploadToBucketWithFallback(
    file: File,
    filePath: string,
    bucketCandidates: string[]
  ): Promise<{ bucket: string; path: string }> {
    let lastError: Error | null = null;

    for (const bucket of bucketCandidates) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true, cacheControl: '3600' });

      if (!error && data?.path) {
        return { bucket, path: data.path };
      }

      if (error) {
        const message = error.message || 'Upload gagal';
        if (ProfileService.isBucketRetryableError(message)) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }
    }

    throw lastError ?? new Error('Semua bucket upload tidak tersedia');
  }

  // Get profile by ID
  static async getProfile(userId: string): Promise<Profile | null> {
    const withRelations = await supabase
      .from('profiles')
      .select(`
        *,
        country:countries(id, name, code),
        diocese:dioceses(id, name),
        church:churches(id, name)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (!withRelations.error) {
      return withRelations.data as Profile | null;
    }

    const fallback = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fallback.error) {
      console.error('Error fetching profile:', fallback.error);
      return null;
    }

    return fallback.data as Profile | null;
  }

  // Get profile stats
  static async getProfileStats(userId: string): Promise<ProfileStats> {
    const withAggregateColumns = await supabase
      .from('profiles')
      .select('posts_count, followers_count, following_count')
      .eq('id', userId)
      .maybeSingle();

    if (!withAggregateColumns.error && withAggregateColumns.data) {
      const profile = withAggregateColumns.data;
      return {
        posts_count: Number(profile.posts_count ?? 0),
        followers_count: Number(profile.followers_count ?? 0),
        following_count: Number(profile.following_count ?? 0),
      };
    }

    const [postsCountRes, followersCountRes, followingCountRes] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    if (postsCountRes.error || followersCountRes.error || followingCountRes.error) {
      console.error(
        'Error fetching profile stats fallback:',
        postsCountRes.error || followersCountRes.error || followingCountRes.error
      );
    }

    return {
      posts_count: postsCountRes.count ?? 0,
      followers_count: followersCountRes.count ?? 0,
      following_count: followingCountRes.count ?? 0,
    };
  }

  // Update profile
  static async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  // Follow user
  static async followUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  // Unfollow user
  static async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // Check if following
  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    return !!data;
  }

  // Get followers
  static async getFollowers(userId: string, page = 1, limit = 20): Promise<Follow[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        *,
        follower:profiles!follows_follower_id_fkey (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching followers:', error);
      return [];
    }

    return data || [];
  }

  // Get following
  static async getFollowing(userId: string, page = 1, limit = 20): Promise<Follow[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        *,
        following:profiles!follows_following_id_fkey (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching following:', error);
      return [];
    }

    return data || [];
  }

  // Upload avatar
  static async uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;
    const uploaded = await ProfileService.uploadToBucketWithFallback(file, filePath, ['avatars']);
    const { data: { publicUrl } } = supabase.storage
      .from(uploaded.bucket)
      .getPublicUrl(uploaded.path);

    return publicUrl;
  }

  // Upload banner
  static async uploadBanner(userId: string, file: File): Promise<string> {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileCandidates = [
      `${userId}/banner_${Date.now()}.${fileExt}`,
      `${userId}/banners_${Date.now()}.${fileExt}`,
    ];

    let lastError: Error | null = null;
    for (const filePath of fileCandidates) {
      try {
        const uploaded = await ProfileService.uploadToBucketWithFallback(file, filePath, ['avatars', 'banners']);
        const { data: { publicUrl } } = supabase.storage
          .from(uploaded.bucket)
          .getPublicUrl(uploaded.path);
        return publicUrl;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Upload banner gagal');
      }
    }

    throw lastError ?? new Error('Upload banner gagal');
  }
}
