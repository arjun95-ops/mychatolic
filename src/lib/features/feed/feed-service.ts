// Feed Service

import { supabase } from '@/lib/supabase/client';
import type { Comment, Like, Post } from '@/lib/types';
import { createRandomToken, createRandomUUID } from '@/lib/utils';

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(column.toLowerCase()) &&
    (normalized.includes('does not exist') || normalized.includes('42703') || normalized.includes('schema cache'))
  );
}

function parseImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.toString().trim())
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (!trimmed.startsWith('[')) {
    return [trimmed];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [trimmed];
    }
    return parsed
      .map((item) => item?.toString().trim())
      .filter((item): item is string => Boolean(item));
  } catch {
    return [trimmed];
  }
}

function getProfileRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function mapPostRow(row: Record<string, unknown>, flags?: { isLiked?: boolean; isSaved?: boolean }): Post {
  const profile = getProfileRow(row.profiles);
  const fullName =
    profile?.full_name?.toString().trim() ||
    profile?.username?.toString().trim() ||
    'Umat';

  return {
    id: row.id?.toString() ?? createRandomUUID(),
    user_id: row.user_id?.toString() ?? '',
    caption: row.caption?.toString(),
    image_url: parseImageUrls(row.image_url),
    likes_count: Number(row.likes_count ?? 0),
    comments_count: Number(row.comments_count ?? 0),
    shares_count: Number(row.shares_count ?? 0),
    saves_count: Number(row.saves_count ?? 0),
    created_at: row.created_at?.toString() ?? new Date().toISOString(),
    updated_at: row.updated_at?.toString() ?? row.created_at?.toString() ?? new Date().toISOString(),
    country_id: row.country_id?.toString(),
    diocese_id: row.diocese_id?.toString(),
    church_id: row.church_id?.toString(),
    type: row.type?.toString(),
    profile: profile
      ? {
          id: profile.id?.toString() ?? '',
          full_name: fullName,
          avatar_url: profile.avatar_url?.toString(),
          role: profile.role?.toString(),
          verification_status: profile.verification_status?.toString(),
        }
      : undefined,
    is_liked: flags?.isLiked ?? false,
    is_saved: flags?.isSaved ?? false,
  };
}

export class FeedService {
  // Get posts with pagination
  static async getPosts(params: {
    page?: number;
    limit?: number;
    scope?: 'all' | 'country' | 'diocese' | 'parish';
    scopeId?: string;
    currentUserId?: string;
  }): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { page = 1, limit = 12, scope = 'all', scopeId, currentUserId } = params;
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    let query = supabase.from('posts').select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        avatar_url,
        role,
        verification_status
      )
    `
    );

    if (scope !== 'all' && scopeId) {
      const scopeColumn = scope === 'country' ? 'country_id' : scope === 'diocese' ? 'diocese_id' : 'church_id';
      query = query.eq(scopeColumn, scopeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).range(fromRange, toRange);

    if (error) {
      console.error('Error fetching posts:', error);
      return { posts: [], hasMore: false };
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const needsSaveCountFallback = rows.some((row) => row.saves_count == null);
    const needsShareCountFallback = rows.some((row) => row.shares_count == null);

    const postIds = rows.map((row) => row.id?.toString()).filter((id): id is string => Boolean(id));
    const [likedSet, savedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, postIds),
      this.getUserPostFlags('saved_posts', currentUserId, postIds),
      needsSaveCountFallback ? this.getAggregateCounts('saved_posts', postIds) : Promise.resolve(new Map()),
      needsShareCountFallback ? this.getAggregateCounts('post_shares', postIds) : Promise.resolve(new Map()),
    ]);

    return {
      posts: rows.map((row) => {
        const postId = row.id?.toString() ?? '';
        return mapPostRow(
          {
            ...row,
            saves_count: row.saves_count ?? saveCounts.get(postId) ?? 0,
            shares_count: row.shares_count ?? shareCounts.get(postId) ?? 0,
          },
          {
            isLiked: likedSet.has(postId),
            isSaved: savedSet.has(postId),
          }
        );
      }),
      hasMore: rows.length >= limit,
    };
  }

  // Get single post by ID
  static async getPost(postId: string, currentUserId?: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from('posts')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role,
          verification_status
        )
      `
      )
      .eq('id', postId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching post:', error);
      return null;
    }

    const [likedSet, savedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, [postId]),
      this.getUserPostFlags('saved_posts', currentUserId, [postId]),
      data.saves_count == null ? this.getAggregateCounts('saved_posts', [postId]) : Promise.resolve(new Map()),
      data.shares_count == null ? this.getAggregateCounts('post_shares', [postId]) : Promise.resolve(new Map()),
    ]);

    return mapPostRow({
      ...(data as Record<string, unknown>),
      saves_count: (data as Record<string, unknown>).saves_count ?? saveCounts.get(postId) ?? 0,
      shares_count: (data as Record<string, unknown>).shares_count ?? shareCounts.get(postId) ?? 0,
    }, {
      isLiked: likedSet.has(postId),
      isSaved: savedSet.has(postId),
    });
  }

  // Get posts by profile/user ID
  static async getPostsByUser(params: {
    userId: string;
    page?: number;
    limit?: number;
    currentUserId?: string;
  }): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { userId, page = 1, limit = 12, currentUserId } = params;
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const { data, error } = await supabase
      .from('posts')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role,
          verification_status
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (error) {
      console.error('Error fetching user posts:', error);
      return { posts: [], hasMore: false };
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const needsSaveCountFallback = rows.some((row) => row.saves_count == null);
    const needsShareCountFallback = rows.some((row) => row.shares_count == null);
    const postIds = rows.map((row) => row.id?.toString()).filter((id): id is string => Boolean(id));

    const [likedSet, savedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, postIds),
      this.getUserPostFlags('saved_posts', currentUserId, postIds),
      needsSaveCountFallback ? this.getAggregateCounts('saved_posts', postIds) : Promise.resolve(new Map()),
      needsShareCountFallback ? this.getAggregateCounts('post_shares', postIds) : Promise.resolve(new Map()),
    ]);

    return {
      posts: rows.map((row) => {
        const postId = row.id?.toString() ?? '';
        return mapPostRow(
          {
            ...row,
            saves_count: row.saves_count ?? saveCounts.get(postId) ?? 0,
            shares_count: row.shares_count ?? shareCounts.get(postId) ?? 0,
          },
          {
            isLiked: likedSet.has(postId),
            isSaved: savedSet.has(postId),
          }
        );
      }),
      hasMore: rows.length >= limit,
    };
  }

  // Create new post
  static async createPost(
    userId: string,
    postData: {
      caption?: string;
      imageUrls?: string[];
      countryId?: string;
      dioceseId?: string;
      churchId?: string;
    }
  ): Promise<Post> {
    const cleanCaption = postData.caption?.trim();
    const normalizedImages = (postData.imageUrls ?? []).filter((url) => url.trim().length > 0);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        caption: cleanCaption,
        image_url: normalizedImages,
        type: normalizedImages.length > 0 ? 'photo' : 'text',
        country_id: postData.countryId,
        diocese_id: postData.dioceseId,
        church_id: postData.churchId,
      })
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role,
          verification_status
        )
      `
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPostRow(data as Record<string, unknown>);
  }

  static async uploadPostImage(userId: string, file: File): Promise<string> {
    const extension = file.name.split('.').pop();
    const safeExtension = extension ? `.${extension}` : '';
    const filePath = `posts/${userId}/${Date.now()}-${createRandomToken(12)}${safeExtension}`;
    const bucketCandidates = ['post-images', 'posts', 'feed-images', 'avatars'];

    let lastError: string | null = null;

    for (const bucket of bucketCandidates) {
      const uploadResult = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });

      if (!uploadResult.error) {
        return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
      }

      const message = uploadResult.error.message.toLowerCase();
      const canTryNextBucket =
        message.includes('bucket') ||
        message.includes('not found') ||
        message.includes('does not exist');

      if (!canTryNextBucket) {
        throw new Error(uploadResult.error.message);
      }

      lastError = uploadResult.error.message;
    }

    throw new Error(lastError || 'Gagal upload gambar');
  }

  // Update post
  static async updatePost(postId: string, updates: Partial<Post>): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPostRow(data as Record<string, unknown>);
  }

  // Delete post
  static async deletePost(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      throw new Error(error.message);
    }
  }

  // Like/Unlike post
  static async toggleLike(userId: string, postId: string): Promise<{ liked: boolean; count: number }> {
    const { data: existingLike, error: existingError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingLike?.id) {
      const { error } = await supabase.from('likes').delete().eq('id', existingLike.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('likes').insert({ user_id: userId, post_id: postId });
      if (error) throw new Error(error.message);
    }

    const count = await this.syncAggregateCount('likes', 'likes_count', postId);
    return { liked: !Boolean(existingLike?.id), count };
  }

  // Get post likes
  static async getPostLikes(postId: string, page = 1, limit = 20): Promise<Like[]> {
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const { data, error } = await supabase
      .from('likes')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (error) {
      console.error('Error fetching likes:', error);
      return [];
    }

    return (data ?? []) as Like[];
  }

  // Add comment
  static async addComment(userId: string, postId: string, content: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        post_id: postId,
        content,
      })
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await this.syncAggregateCount('comments', 'comments_count', postId);
    return data as Comment;
  }

  // Get post comments
  static async getPostComments(postId: string, page = 1, limit = 20): Promise<Comment[]> {
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(fromRange, toRange);

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }

    return (data ?? []) as Comment[];
  }

  // Delete comment
  static async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  // Toggle save/bookmark
  static async toggleSave(userId: string, postId: string): Promise<{ saved: boolean }> {
    const { data: existingSave, error: existingError } = await supabase
      .from('saved_posts')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingSave?.id) {
      const { error } = await supabase.from('saved_posts').delete().eq('id', existingSave.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('saved_posts')
        .insert({
          user_id: userId,
          post_id: postId,
        });
      if (error) throw new Error(error.message);
    }

    await this.syncAggregateCount('saved_posts', 'saves_count', postId);
    return { saved: !Boolean(existingSave?.id) };
  }

  // Get user's saved posts
  static async getSavedPosts(userId: string, page = 1, limit = 12): Promise<Post[]> {
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const { data: savedRows, error: savedError } = await supabase
      .from('saved_posts')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (savedError) {
      console.error('Error fetching saved posts:', savedError);
      return [];
    }

    const postIds = ((savedRows ?? []) as Record<string, unknown>[])
      .map((row) => row.post_id?.toString())
      .filter((id): id is string => Boolean(id));

    if (postIds.length === 0) {
      return [];
    }

    return await this.getOrderedPostsByIds(postIds, userId, new Set(postIds));
  }

  static async getSharedPostsByUser(params: {
    userId: string;
    page?: number;
    limit?: number;
    currentUserId?: string;
  }): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { userId, page = 1, limit = 12, currentUserId } = params;
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const { data, error } = await supabase
      .from('post_shares')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (error) {
      console.error('Error fetching shared posts:', error);
      return { posts: [], hasMore: false };
    }

    const postIds = ((data ?? []) as Record<string, unknown>[])
      .map((row) => row.post_id?.toString())
      .filter((id): id is string => Boolean(id));

    if (postIds.length === 0) {
      return { posts: [], hasMore: false };
    }

    const posts = await this.getOrderedPostsByIds(postIds, currentUserId);
    return { posts, hasMore: postIds.length >= limit };
  }

  static async getRepliedPostsByUser(params: {
    userId: string;
    page?: number;
    limit?: number;
    currentUserId?: string;
  }): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { userId, page = 1, limit = 12, currentUserId } = params;
    const untilIndex = page * limit;
    const fetchLimit = Math.min(Math.max(untilIndex * 6, 60), 1000);

    const { data, error } = await supabase
      .from('comments')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (error) {
      console.error('Error fetching replied posts:', error);
      return { posts: [], hasMore: false };
    }

    const uniquePostIds: string[] = [];
    const seen = new Set<string>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const postId = row.post_id?.toString();
      if (!postId || seen.has(postId)) continue;
      seen.add(postId);
      uniquePostIds.push(postId);
    }

    const fromRange = (page - 1) * limit;
    const pagedPostIds = uniquePostIds.slice(fromRange, fromRange + limit);
    if (pagedPostIds.length === 0) {
      return { posts: [], hasMore: false };
    }

    const posts = await this.getOrderedPostsByIds(pagedPostIds, currentUserId);
    return { posts, hasMore: uniquePostIds.length > fromRange + pagedPostIds.length };
  }

  // Share post (increment share count)
  static async incrementShareCount(postId: string, userId?: string): Promise<void> {
    const rpcResult = await supabase.rpc('increment_shares', {
      p_post_id: postId,
    });

    if (!rpcResult.error) {
      return;
    }

    const insertPayload: Record<string, unknown> = {
      post_id: postId,
      created_at: new Date().toISOString(),
    };
    if (userId) {
      insertPayload.user_id = userId;
    }

    const shareInsert = await supabase.from('post_shares').insert(insertPayload);

    if (shareInsert.error) {
      throw new Error(shareInsert.error.message);
    }

    await this.syncAggregateCount('post_shares', 'shares_count', postId);
  }

  private static async getUserPostFlags(
    table: 'likes' | 'saved_posts',
    userId: string | undefined,
    postIds: string[]
  ): Promise<Set<string>> {
    if (!userId || postIds.length === 0) {
      return new Set();
    }

    const { data, error } = await supabase
      .from(table)
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    if (error) {
      return new Set();
    }

    return new Set(
      ((data ?? []) as Record<string, unknown>[])
        .map((row) => row.post_id?.toString())
        .filter((id): id is string => Boolean(id))
    );
  }

  private static async getAggregateCounts(
    table: 'saved_posts' | 'post_shares',
    postIds: string[]
  ): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from(table)
      .select('post_id')
      .in('post_id', postIds);

    if (error) {
      return new Map();
    }

    const map = new Map<string, number>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const postId = row.post_id?.toString();
      if (!postId) continue;
      map.set(postId, (map.get(postId) ?? 0) + 1);
    }

    return map;
  }

  private static async getOrderedPostsByIds(
    postIds: string[],
    currentUserId?: string,
    savedSetOverride?: Set<string>
  ): Promise<Post[]> {
    if (postIds.length === 0) return [];

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role,
          verification_status
        )
      `
      )
      .in('id', postIds);

    if (postsError) {
      console.error('Error fetching post data:', postsError);
      return [];
    }

    const orderedIds = new Set(postIds);
    const [likesSet, savedSetFromDb, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, postIds),
      this.getUserPostFlags('saved_posts', currentUserId, postIds),
      this.getAggregateCounts('saved_posts', postIds),
      this.getAggregateCounts('post_shares', postIds),
    ]);
    const savedSet = savedSetOverride ?? savedSetFromDb;

    return ((postsData ?? []) as Record<string, unknown>[])
      .filter((row) => orderedIds.has(row.id?.toString() ?? ''))
      .sort((a, b) => postIds.indexOf(a.id?.toString() ?? '') - postIds.indexOf(b.id?.toString() ?? ''))
      .map((row) => {
        const postId = row.id?.toString() ?? '';
        return mapPostRow(
          {
            ...row,
            saves_count: row.saves_count ?? saveCounts.get(postId) ?? 0,
            shares_count: row.shares_count ?? shareCounts.get(postId) ?? 0,
          },
          {
            isLiked: likesSet.has(postId),
            isSaved: savedSet.has(postId),
          }
        );
      });
  }

  private static async syncAggregateCount(
    table: 'likes' | 'comments' | 'saved_posts' | 'post_shares',
    postColumn: 'likes_count' | 'comments_count' | 'saves_count' | 'shares_count',
    postId: string
  ): Promise<number> {
    const countResult = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    const count = countResult.count ?? 0;
    const updateResult = await supabase.from('posts').update({ [postColumn]: count }).eq('id', postId);
    if (updateResult.error && !isMissingColumnError(updateResult.error.message, postColumn)) {
      console.error(`Error syncing ${postColumn}:`, updateResult.error);
    }
    return count;
  }
}
