// Feed Service

import { supabase } from '@/lib/supabase/client';
import type { BlockedUser, Comment, Like, Post } from '@/lib/types';
import { createRandomToken, createRandomUUID } from '@/lib/utils';

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(column.toLowerCase()) &&
    (normalized.includes('does not exist') || normalized.includes('42703') || normalized.includes('schema cache'))
  );
}

function isMissingSchemaObjectError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('42703') ||
    normalized.includes('42p01')
  );
}

function isDuplicateError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('23505') || normalized.includes('duplicate key');
}

function isNotNullViolationError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('23502') || normalized.includes('null value in column');
}

function readErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized === '{}' ? 'Unknown error object' : serialized;
  } catch {
    return 'Unknown error object';
  }
}

type BlockRelationConfig = {
  table: string;
  blockerColumn: string;
  blockedColumn: string;
};

const BLOCK_RELATION_CONFIGS: BlockRelationConfig[] = [
  { table: 'user_blocks', blockerColumn: 'blocker_id', blockedColumn: 'blocked_user_id' },
  { table: 'user_blocks', blockerColumn: 'blocker_id', blockedColumn: 'blocked_id' },
  { table: 'user_blocks', blockerColumn: 'user_id', blockedColumn: 'blocked_user_id' },
  { table: 'user_blocks', blockerColumn: 'user_id', blockedColumn: 'blocked_id' },
  { table: 'blocked_users', blockerColumn: 'user_id', blockedColumn: 'blocked_user_id' },
];

function getBlockInsertPayloads(
  config: BlockRelationConfig,
  blockerId: string,
  blockedUserId: string
): Array<Record<string, unknown>> {
  const columnValueMap: Record<string, string> = {
    blocker_id: blockerId,
    user_id: blockerId,
    blocked_user_id: blockedUserId,
    blocked_id: blockedUserId,
  };
  const createdAt = new Date().toISOString();
  const baseColumns = [config.blockerColumn, config.blockedColumn];
  const buildPayload = (columns: string[]) => {
    const payload: Record<string, unknown> = { created_at: createdAt };
    for (const column of columns) {
      payload[column] = columnValueMap[column];
    }
    return payload;
  };

  if (config.table !== 'user_blocks') {
    return [buildPayload(baseColumns)];
  }

  const optionalColumns = ['blocker_id', 'user_id', 'blocked_user_id', 'blocked_id'].filter(
    (column) => !baseColumns.includes(column)
  );

  const subsets: string[][] = [[]];
  for (const column of optionalColumns) {
    const next = subsets.map((subset) => [...subset, column]);
    subsets.push(...next);
  }

  const payloads = subsets
    .sort((a, b) => a.length - b.length)
    .map((subset) => buildPayload([...baseColumns, ...subset]));
  const deduped: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const payload of payloads) {
    const key = JSON.stringify(payload);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(payload);
  }

  return deduped;
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

function mapPostRow(
  row: Record<string, unknown>,
  flags?: { isLiked?: boolean; isSaved?: boolean; isReposted?: boolean }
): Post {
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
    is_reposted: flags?.isReposted ?? false,
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
      throw new Error(readErrorMessage(error) || 'Gagal memuat feed');
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
    const visibleRows = rows.filter((row) => !hiddenUserIds.has(row.user_id?.toString() ?? ''));
    const needsSaveCountFallback = visibleRows.some((row) => row.saves_count == null);
    const needsShareCountFallback = visibleRows.some((row) => row.shares_count == null);

    const postIds = visibleRows.map((row) => row.id?.toString()).filter((id): id is string => Boolean(id));
    const [likedSet, savedSet, repostedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, postIds),
      this.getUserPostFlags('saved_posts', currentUserId, postIds),
      this.getUserPostFlags('post_shares', currentUserId, postIds),
      needsSaveCountFallback ? this.getAggregateCounts('saved_posts', postIds) : Promise.resolve(new Map()),
      needsShareCountFallback ? this.getAggregateCounts('post_shares', postIds) : Promise.resolve(new Map()),
    ]);

    return {
      posts: visibleRows.map((row) => {
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
            isReposted: repostedSet.has(postId),
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

    const ownerId = (data as Record<string, unknown>).user_id?.toString() ?? '';
    if (currentUserId && ownerId) {
      const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
      if (hiddenUserIds.has(ownerId)) {
        return null;
      }
    }

    const [likedSet, savedSet, repostedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, [postId]),
      this.getUserPostFlags('saved_posts', currentUserId, [postId]),
      this.getUserPostFlags('post_shares', currentUserId, [postId]),
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
      isReposted: repostedSet.has(postId),
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
    const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
    const visibleRows = rows.filter((row) => !hiddenUserIds.has(row.user_id?.toString() ?? ''));
    const needsSaveCountFallback = visibleRows.some((row) => row.saves_count == null);
    const needsShareCountFallback = visibleRows.some((row) => row.shares_count == null);
    const postIds = visibleRows.map((row) => row.id?.toString()).filter((id): id is string => Boolean(id));

    const [likedSet, savedSet, repostedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, postIds),
      this.getUserPostFlags('saved_posts', currentUserId, postIds),
      this.getUserPostFlags('post_shares', currentUserId, postIds),
      needsSaveCountFallback ? this.getAggregateCounts('saved_posts', postIds) : Promise.resolve(new Map()),
      needsShareCountFallback ? this.getAggregateCounts('post_shares', postIds) : Promise.resolve(new Map()),
    ]);

    return {
      posts: visibleRows.map((row) => {
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
            isReposted: repostedSet.has(postId),
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
  static async getPostLikes(postId: string, page = 1, limit = 20, currentUserId?: string): Promise<Like[]> {
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    const likesWithProfiles = await supabase
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

    if (!likesWithProfiles.error) {
      const rows = (likesWithProfiles.data ?? []) as unknown as Like[];
      if (!currentUserId) {
        return rows;
      }

      const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
      return rows.filter((like) => !hiddenUserIds.has(like.user_id));
    }

    // Fallback for stricter RLS or schema differences on joined profile relation.
    const likesOnly = await supabase
      .from('likes')
      .select('id, user_id, post_id, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (likesOnly.error) {
      console.warn('FeedService.getPostLikes fallback failed:', {
        primary: readErrorMessage(likesWithProfiles.error),
        fallback: readErrorMessage(likesOnly.error),
      });
      return [];
    }

    const rawLikes = (likesOnly.data ?? []) as unknown as Array<Record<string, unknown>>;
    const likeRows = rawLikes.map((row) => ({
      id: row.id?.toString() ?? createRandomUUID(),
      user_id: row.user_id?.toString() ?? '',
      post_id: row.post_id?.toString() ?? postId,
      created_at: row.created_at?.toString() ?? new Date().toISOString(),
    }));

    let resolvedLikeRows = likeRows;
    if (currentUserId) {
      const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
      resolvedLikeRows = likeRows.filter((like) => !hiddenUserIds.has(like.user_id));
    }
    const likerIds = resolvedLikeRows.map((row) => row.user_id).filter((id) => id.length > 0);
    if (likerIds.length === 0) {
      return resolvedLikeRows as unknown as Like[];
    }

    const profilesResult = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', likerIds);

    const profileMap = new Map<string, { id: string; full_name?: string; avatar_url?: string }>();
    if (!profilesResult.error) {
      for (const profile of (profilesResult.data ?? []) as unknown as Array<Record<string, unknown>>) {
        const id = profile.id?.toString();
        if (!id) continue;
        profileMap.set(id, {
          id,
          full_name: profile.full_name?.toString(),
          avatar_url: profile.avatar_url?.toString(),
        });
      }
    }

    return resolvedLikeRows.map((row) => ({
      ...row,
      profile: profileMap.get(row.user_id),
    })) as Like[];
  }

  // Add comment
  static async addComment(
    userId: string,
    postId: string,
    content: string,
    options?: { parentId?: string; replyToName?: string }
  ): Promise<Comment> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Komentar tidak boleh kosong');
    }

    const selectComment = `
      *,
      profiles:user_id (
        id,
        full_name,
        avatar_url,
        role
      )
    `;

    const firstInsertPayload: Record<string, unknown> = {
      user_id: userId,
      post_id: postId,
      content: trimmed,
    };

    if (options?.parentId) {
      firstInsertPayload.parent_id = options.parentId;
    }

    let insertResult = await supabase
      .from('comments')
      .insert(firstInsertPayload)
      .select(selectComment)
      .single();

    // Backward compatibility: some environments may not have `parent_id` yet.
    if (
      insertResult.error &&
      options?.parentId &&
      isMissingColumnError(insertResult.error.message, 'parent_id')
    ) {
      const mentionPrefix =
        options.replyToName && !trimmed.startsWith(`@${options.replyToName}`)
          ? `@${options.replyToName} `
          : '';

      insertResult = await supabase
        .from('comments')
        .insert({
          user_id: userId,
          post_id: postId,
          content: `${mentionPrefix}${trimmed}`.trim(),
        })
        .select(selectComment)
        .single();
    }

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message || 'Gagal menambahkan komentar');
    }

    await this.syncAggregateCount('comments', 'comments_count', postId);
    return insertResult.data as Comment;
  }

  // Get post comments
  static async getPostComments(postId: string, page = 1, limit = 20, currentUserId?: string): Promise<Comment[]> {
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

    const rows = (data ?? []) as Record<string, unknown>[];
    if (!currentUserId) {
      return rows as unknown as Comment[];
    }

    const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
    return rows.filter((row) => !hiddenUserIds.has(row.user_id?.toString() ?? '')) as unknown as Comment[];
  }

  // Delete comment
  static async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  static async reportComment(userId: string, commentId: string, reason: string): Promise<void> {
    const normalizedReason = reason.trim();
    const payloads: Array<{ table: string; row: Record<string, unknown> }> = [
      {
        table: 'comment_reports',
        row: {
          comment_id: commentId,
          reporter_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'comment_reports',
        row: {
          comment_id: commentId,
          user_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'reports',
        row: {
          comment_id: commentId,
          reporter_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'reports',
        row: {
          comment_id: commentId,
          user_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
    ];

    let lastCompatibilityError: string | null = null;

    for (const payload of payloads) {
      const result = await supabase.from(payload.table).insert(payload.row);
      if (!result.error) {
        return;
      }

      if (isDuplicateError(result.error.message)) {
        return;
      }

      if (isMissingSchemaObjectError(result.error.message)) {
        lastCompatibilityError = result.error.message;
        continue;
      }

      throw new Error(result.error.message);
    }

    throw new Error(lastCompatibilityError || 'Gagal mengirim laporan komentar');
  }

  static async reportPost(userId: string, postId: string, reason: string): Promise<void> {
    const normalizedReason = reason.trim();
    const payloads: Array<{ table: string; row: Record<string, unknown> }> = [
      {
        table: 'reports',
        row: {
          post_id: postId,
          reporter_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'reports',
        row: {
          post_id: postId,
          user_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'post_reports',
        row: {
          post_id: postId,
          reporter_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
      {
        table: 'post_reports',
        row: {
          post_id: postId,
          user_id: userId,
          reason: normalizedReason,
          created_at: new Date().toISOString(),
        },
      },
    ];

    let lastCompatibilityError: string | null = null;

    for (const payload of payloads) {
      const result = await supabase.from(payload.table).insert(payload.row);
      if (!result.error) {
        return;
      }

      if (isDuplicateError(result.error.message)) {
        return;
      }

      if (isMissingSchemaObjectError(result.error.message)) {
        lastCompatibilityError = result.error.message;
        continue;
      }

      throw new Error(result.error.message);
    }

    throw new Error(lastCompatibilityError || 'Gagal mengirim laporan postingan');
  }

  static async blockUser(blockerId: string, blockedUserId: string): Promise<void> {
    if (!blockerId || !blockedUserId) {
      throw new Error('User tidak valid');
    }
    if (blockerId === blockedUserId) {
      throw new Error('Tidak bisa memblokir diri sendiri');
    }

    let lastCompatibilityError: string | null = null;

    for (const config of BLOCK_RELATION_CONFIGS) {
      const payloads = getBlockInsertPayloads(config, blockerId, blockedUserId);

      for (const payload of payloads) {
        const result = await supabase.from(config.table).insert(payload);
        if (!result.error) {
          return;
        }

        if (isDuplicateError(result.error.message)) {
          return;
        }

        if (
          isMissingSchemaObjectError(result.error.message) ||
          isNotNullViolationError(result.error.message)
        ) {
          lastCompatibilityError = result.error.message;
          continue;
        }

        throw new Error(result.error.message);
      }
    }

    if (lastCompatibilityError) {
      console.warn('FeedService.blockUser compatibility fallback exhausted:', lastCompatibilityError);
      throw new Error('Konfigurasi blokir di database belum sinkron. Jalankan ulang SQL hotfix blokir.');
    }

    throw new Error('Fitur blokir belum tersedia di server');
  }

  static async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    if (!blockerId || !blockedUserId) {
      throw new Error('User tidak valid');
    }

    let lastCompatibilityError: string | null = null;
    let hasCompatibleSource = false;

    for (const config of BLOCK_RELATION_CONFIGS) {
      const result = await supabase
        .from(config.table)
        .delete()
        .eq(config.blockerColumn, blockerId)
        .eq(config.blockedColumn, blockedUserId);

      if (!result.error) {
        hasCompatibleSource = true;
        continue;
      }

      if (isMissingSchemaObjectError(result.error.message)) {
        lastCompatibilityError = result.error.message;
        continue;
      }

      throw new Error(result.error.message);
    }

    if (hasCompatibleSource) {
      return;
    }

    throw new Error(lastCompatibilityError || 'Fitur unblock belum tersedia di server');
  }

  static async getBlockedUsers(userId: string): Promise<BlockedUser[]> {
    if (!userId) {
      return [];
    }

    const rpcBlockedUsers = await supabase.rpc('get_blocked_users_for_auth');
    if (!rpcBlockedUsers.error) {
      return ((rpcBlockedUsers.data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({
          id: row.blocked_user_id?.toString() ?? '',
          full_name:
            row.full_name?.toString()?.trim() ||
            row.display_name?.toString()?.trim() ||
            row.name?.toString()?.trim() ||
            'Umat',
          avatar_url: row.avatar_url?.toString(),
          blocked_at: row.blocked_at?.toString() ?? new Date().toISOString(),
        }))
        .filter((row) => row.id.length > 0);
    }

    const blockedAtMap = new Map<string, string>();
    let hasCompatibleSource = false;

    for (const config of BLOCK_RELATION_CONFIGS) {
      const result = await supabase
        .from(config.table)
        .select(`${config.blockedColumn}, created_at`)
        .eq(config.blockerColumn, userId)
        .order('created_at', { ascending: false });

      if (result.error) {
        if (isMissingSchemaObjectError(result.error.message)) {
          continue;
        }
        throw new Error(result.error.message);
      }

      hasCompatibleSource = true;
      for (const row of ((result.data ?? []) as unknown as Record<string, unknown>[])) {
        const blockedId = row[config.blockedColumn]?.toString();
        if (!blockedId) continue;
        const blockedAt = row.created_at?.toString() ?? new Date().toISOString();

        const existing = blockedAtMap.get(blockedId);
        if (!existing || new Date(blockedAt).getTime() > new Date(existing).getTime()) {
          blockedAtMap.set(blockedId, blockedAt);
        }
      }
    }

    if (!hasCompatibleSource || blockedAtMap.size === 0) {
      return [];
    }

    const blockedIds = Array.from(blockedAtMap.keys());
    const profilesResult = await supabase.from('profiles').select('*').in('id', blockedIds);
    const profileRows = profilesResult.error
      ? []
      : ((profilesResult.data ?? []) as unknown as Record<string, unknown>[]);

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const row of profileRows) {
      const id = row.id?.toString();
      if (!id) continue;
      profileMap.set(id, row);
    }

    return blockedIds
      .map((id) => {
        const profile = profileMap.get(id);
        const profileName =
          profile?.full_name?.toString()?.trim() ||
          profile?.username?.toString()?.trim() ||
          profile?.display_name?.toString()?.trim() ||
          profile?.name?.toString()?.trim() ||
          'Umat';
        return {
          id,
          full_name: profileName,
          avatar_url: profile?.avatar_url?.toString(),
          blocked_at: blockedAtMap.get(id) ?? new Date().toISOString(),
        } satisfies BlockedUser;
      })
      .sort((a, b) => new Date(b.blocked_at).getTime() - new Date(a.blocked_at).getTime());
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

  static async toggleRepost(userId: string, postId: string): Promise<{ reposted: boolean; count: number }> {
    const existing = await supabase
      .from('post_shares')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .limit(1);

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    const hasReposted = Boolean(existing.data && existing.data.length > 0);

    if (hasReposted) {
      const removeResult = await supabase
        .from('post_shares')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (removeResult.error) {
        throw new Error(removeResult.error.message);
      }
    } else {
      const createResult = await supabase.from('post_shares').insert({
        user_id: userId,
        post_id: postId,
        created_at: new Date().toISOString(),
      });

      if (createResult.error) {
        throw new Error(createResult.error.message);
      }
    }

    const count = await this.syncAggregateCount('post_shares', 'shares_count', postId);
    return { reposted: !hasReposted, count };
  }

  private static async getUserPostFlags(
    table: 'likes' | 'saved_posts' | 'post_shares',
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

  private static async getBlockedUserSets(userId?: string): Promise<{
    blockedByMe: Set<string>;
    blockedMe: Set<string>;
    hiddenUserIds: Set<string>;
  }> {
    const empty = {
      blockedByMe: new Set<string>(),
      blockedMe: new Set<string>(),
      hiddenUserIds: new Set<string>(),
    };

    if (!userId) {
      return empty;
    }

    const blockedByMe = new Set<string>();
    const blockedMe = new Set<string>();
    let hasCompatibleSource = false;

    for (const config of BLOCK_RELATION_CONFIGS) {
      const [blockedByMeResult, blockedMeResult] = await Promise.all([
        supabase.from(config.table).select(config.blockedColumn).eq(config.blockerColumn, userId),
        supabase.from(config.table).select(config.blockerColumn).eq(config.blockedColumn, userId),
      ]);

      const blockerSideError = blockedByMeResult.error;
      const blockedSideError = blockedMeResult.error;

      const isCompatibilityError =
        (blockerSideError && isMissingSchemaObjectError(blockerSideError.message)) ||
        (blockedSideError && isMissingSchemaObjectError(blockedSideError.message));
      if (isCompatibilityError) {
        continue;
      }

      if (blockerSideError || blockedSideError) {
        console.error('Error fetching block relations:', blockerSideError || blockedSideError);
        continue;
      }

      hasCompatibleSource = true;

      for (const row of ((blockedByMeResult.data ?? []) as unknown as Record<string, unknown>[])) {
        const id = row[config.blockedColumn]?.toString();
        if (id) blockedByMe.add(id);
      }

      for (const row of ((blockedMeResult.data ?? []) as unknown as Record<string, unknown>[])) {
        const id = row[config.blockerColumn]?.toString();
        if (id) blockedMe.add(id);
      }
    }

    if (!hasCompatibleSource) {
      return empty;
    }

    return {
      blockedByMe,
      blockedMe,
      hiddenUserIds: new Set<string>([...blockedByMe, ...blockedMe]),
    };
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
    const { hiddenUserIds } = await this.getBlockedUserSets(currentUserId);
    const visibleRows = ((postsData ?? []) as Record<string, unknown>[]).filter(
      (row) =>
        orderedIds.has(row.id?.toString() ?? '') &&
        !hiddenUserIds.has(row.user_id?.toString() ?? '')
    );
    const visiblePostIds = visibleRows
      .map((row) => row.id?.toString())
      .filter((id): id is string => Boolean(id));

    const [likesSet, savedSetFromDb, repostedSet, saveCounts, shareCounts] = await Promise.all([
      this.getUserPostFlags('likes', currentUserId, visiblePostIds),
      this.getUserPostFlags('saved_posts', currentUserId, visiblePostIds),
      this.getUserPostFlags('post_shares', currentUserId, visiblePostIds),
      this.getAggregateCounts('saved_posts', visiblePostIds),
      this.getAggregateCounts('post_shares', visiblePostIds),
    ]);
    const savedSet = savedSetOverride ?? savedSetFromDb;

    return visibleRows
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
            isReposted: repostedSet.has(postId),
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
