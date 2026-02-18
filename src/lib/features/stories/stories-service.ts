// Stories Service

import { supabase } from '@/lib/supabase/client';
import { ChatService } from '@/lib/features/chat/chat-service';
import type { Story } from '@/lib/types';

function isMissingObjectError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('42p01') ||
    normalized.includes('could not find') ||
    normalized.includes('pgrst205')
  );
}

function isMissingColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('42703') || normalized.includes('column');
}

function isSpecificMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  const targetColumn = column.toLowerCase();
  return (
    normalized.includes(targetColumn) &&
    (
      normalized.includes('42703') ||
      normalized.includes('pgrst204') ||
      (normalized.includes('could not find') && normalized.includes('column'))
    )
  );
}

function isUniqueViolationError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('23505') || normalized.includes('duplicate key');
}

function isOnConflictUnsupported(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('on conflict') && normalized.includes('constraint');
}

function normalizeSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : 'Unknown error';
  }

  const candidate = error as Record<string, unknown>;
  const code = candidate.code?.toString() ?? '';
  const message = candidate.message?.toString() ?? '';
  const details = candidate.details?.toString() ?? '';
  return [code, message, details].filter(Boolean).join(' | ') || 'Unknown error';
}

type StoryQueryResult = {
  data: Record<string, unknown>[] | null;
  error: {
    message: string;
    details?: string | null;
  } | null;
};

function createUuid() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  // Fallback for non-secure contexts (e.g. local network over http)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mapStoryRow(
  row: Record<string, unknown>,
  profile?: Story['profiles']
): Story {
  const mediaTypeRaw = row.media_type?.toString().toLowerCase();
  const mediaType: Story['media_type'] = mediaTypeRaw === 'video' ? 'video' : 'image';

  const audienceRaw = row.audience?.toString().toLowerCase();
  const audience: Story['audience'] =
    audienceRaw === 'close_friends' || audienceRaw === 'everyone' || audienceRaw === 'followers'
      ? (audienceRaw as Story['audience'])
      : 'followers';

  const createdAt = row.created_at?.toString() || new Date().toISOString();
  const expiresAt =
    row.expires_at?.toString() ||
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    id: row.id?.toString() ?? createUuid(),
    user_id: row.user_id?.toString() ?? '',
    media_url: row.media_url?.toString() ?? '',
    media_type: mediaType,
    caption: row.caption?.toString(),
    audience,
    created_at: createdAt,
    expires_at: expiresAt,
    updated_at: row.updated_at?.toString() ?? createdAt,
    profiles: profile,
  };
}

export class StoriesService {
  private static async getProfilesMap(userIds: string[]) {
    const validIds = [...new Set(userIds.filter(Boolean))];
    if (validIds.length === 0) {
      return new Map<string, Story['profiles']>();
    }

    const profileRes = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, verification_status')
      .in('id', validIds);

    if (profileRes.error) {
      const normalized = normalizeSupabaseError(profileRes.error);
      if (!isMissingObjectError(normalized) && !isMissingColumnError(normalized)) {
        console.warn('Warning hydrating story profiles:', normalized);
      }
      return new Map<string, Story['profiles']>();
    }

    const profilesMap = new Map<string, Story['profiles']>();
    ((profileRes.data ?? []) as Record<string, unknown>[]).forEach((row) => {
      const id = row.id?.toString();
      if (!id) return;
      profilesMap.set(id, {
        id,
        full_name: row.full_name?.toString(),
        avatar_url: row.avatar_url?.toString(),
        verification_status: row.verification_status?.toString(),
      });
    });

    return profilesMap;
  }

  private static async hydrateStories(storyRows: Record<string, unknown>[]) {
    const userIds = storyRows
      .map((row) => row.user_id?.toString() ?? '')
      .filter(Boolean);
    const profilesMap = await this.getProfilesMap(userIds);

    return storyRows.map((row) => {
      const userId = row.user_id?.toString() ?? '';
      return mapStoryRow(row, profilesMap.get(userId));
    });
  }

  private static async runStoryListQuery(
    queryBuilder: () => PromiseLike<StoryQueryResult>
  ) {
    const primary = await queryBuilder();
    let rows = primary.data as Record<string, unknown>[] | null;
    let error = primary.error;

    if (error && isSpecificMissingColumnError(error.message, 'created_at')) {
      const fallback = await supabase
        .from('stories')
        .select('*')
        .order('updated_at', { ascending: false });
      rows = fallback.data as Record<string, unknown>[] | null;
      error = fallback.error;
    }

    if (error && isSpecificMissingColumnError(error.message, 'updated_at')) {
      const fallback = await supabase
        .from('stories')
        .select('*');
      rows = fallback.data as Record<string, unknown>[] | null;
      error = fallback.error;
    }

    return { rows: rows ?? [], error };
  }

  // Get stories from followed users
  static async getStories(): Promise<Story[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { rows, error } = await this.runStoryListQuery(() =>
      supabase
        .from('stories')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
    );

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (isMissingObjectError(normalized)) {
        return [];
      }
      console.error('Error fetching stories:', normalized);
      return [];
    }

    return this.hydrateStories(rows);
  }

  // Get single story by ID
  static async getStory(storyId: string): Promise<Story | null> {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .maybeSingle();

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (isMissingObjectError(normalized)) {
        return null;
      }
      console.error('Error fetching story:', normalized);
      return null;
    }

    if (!data) {
      return null;
    }

    const [hydrated] = await this.hydrateStories([data as Record<string, unknown>]);
    return hydrated ?? null;
  }

  // Create new story
  static async createStory(userId: string, data: {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    audience?: 'followers' | 'close_friends' | 'everyone';
  }): Promise<Story> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const payload: Record<string, unknown> = {
      user_id: userId,
      media_url: data.mediaUrl,
      media_type: data.mediaType,
      caption: data.caption,
      audience: data.audience || 'followers',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };

    let result = await supabase
      .from('stories')
      .insert(payload)
      .select('*')
      .single();

    if (result.error && isSpecificMissingColumnError(result.error.message, 'audience')) {
      delete payload.audience;
      result = await supabase
        .from('stories')
        .insert(payload)
        .select('*')
        .single();
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    const [hydrated] = await this.hydrateStories([result.data as Record<string, unknown>]);
    if (!hydrated) {
      throw new Error('Gagal membuat story');
    }
    return hydrated;
  }

  static async uploadStoryMedia(userId: string, file: File): Promise<string> {
    const extension = file.name.split('.').pop();
    const safeExtension = extension ? `.${extension}` : '';
    const primaryPath = `${userId}/${createUuid()}${safeExtension}`;
    const fallbackPath = `stories/${userId}/${Date.now()}-${createUuid()}${safeExtension}`;
    const pathCandidates = [primaryPath, fallbackPath];
    const bucketCandidates = ['stories', 'story-media', 'post-images', 'avatars'];

    let lastError: string | null = null;

    for (const bucket of bucketCandidates) {
      for (const path of pathCandidates) {
        const uploadResult = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: true, contentType: file.type || undefined });

        if (!uploadResult.error) {
          return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
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
    }

    throw new Error(lastError || 'Gagal upload media story');
  }

  // Delete story
  static async deleteStory(storyId: string): Promise<void> {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // Get user's stories
  static async getUserStories(userId: string): Promise<Story[]> {
    const { rows, error } = await this.runStoryListQuery(() =>
      supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
    );

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (isMissingObjectError(normalized)) {
        return [];
      }
      console.error('Error fetching user stories:', normalized);
      return [];
    }

    const hydrated = await this.hydrateStories(rows);
    return hydrated.filter((story) => story.user_id === userId);
  }

  // Get stories by user IDs
  static async getStoriesByUserIds(userIds: string[]): Promise<Map<string, Story[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const { rows, error } = await this.runStoryListQuery(() =>
      supabase
        .from('stories')
        .select('*')
        .in('user_id', userIds)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
    );

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (isMissingObjectError(normalized)) {
        return new Map();
      }
      console.error('Error fetching stories:', normalized);
      return new Map();
    }

    const hydratedStories = (await this.hydrateStories(rows))
      .filter((story) => userIds.includes(story.user_id));
    const storiesByUser = new Map<string, Story[]>();
    hydratedStories.forEach((story) => {
      const userId = story.user_id;
      if (!storiesByUser.has(userId)) {
        storiesByUser.set(userId, []);
      }
      storiesByUser.get(userId)!.push(story);
    });

    return storiesByUser;
  }

  // Check if user has active stories
  static async userHasActiveStories(userId: string): Promise<boolean> {
    const stories = await this.getUserStories(userId);
    return stories.length > 0;
  }

  static async getViewedStoryIds(storyIds: string[], viewerId: string): Promise<Set<string>> {
    if (!viewerId || storyIds.length === 0) {
      return new Set<string>();
    }

    const uniqueStoryIds = [...new Set(storyIds.filter(Boolean))];
    if (uniqueStoryIds.length === 0) {
      return new Set<string>();
    }

    const primary = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', viewerId)
      .in('story_id', uniqueStoryIds);

    let rows = primary.data as Record<string, unknown>[] | null;
    let error = primary.error;

    if (error && isSpecificMissingColumnError(error.message, 'viewer_id')) {
      const fallback = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', viewerId)
        .in('story_id', uniqueStoryIds);
      rows = fallback.data as Record<string, unknown>[] | null;
      error = fallback.error;
    }

    if (error) {
      console.error('Error fetching viewed story ids:', normalizeSupabaseError(error));
      return new Set<string>();
    }

    return new Set(
      (rows ?? [])
        .map((row) => row.story_id?.toString())
        .filter((id): id is string => Boolean(id))
    );
  }

  // Mark story as viewed
  static async markStoryViewed(storyId: string, viewerId: string): Promise<void> {
    const payloads: Record<string, unknown>[] = [
      {
        story_id: storyId,
        viewer_id: viewerId,
        viewed_at: new Date().toISOString(),
      },
      {
        story_id: storyId,
        user_id: viewerId,
        viewed_at: new Date().toISOString(),
      },
      {
        story_id: storyId,
        viewer_id: viewerId,
        created_at: new Date().toISOString(),
      },
    ];

    for (const payload of payloads) {
      const upsertResult = await supabase
        .from('story_views')
        .upsert(payload, { onConflict: 'story_id,viewer_id' });

      if (!upsertResult.error) {
        return;
      }

      if (isOnConflictUnsupported(upsertResult.error.message)) {
        const insertResult = await supabase.from('story_views').insert(payload);
        if (!insertResult.error || isUniqueViolationError(insertResult.error.message)) {
          return;
        }
      }

      const message = upsertResult.error.message.toLowerCase();
      if (isUniqueViolationError(message)) {
        return;
      }

      if (isMissingObjectError(message) || isMissingColumnError(message)) {
        continue;
      }

      console.error('Error tracking story view:', normalizeSupabaseError(upsertResult.error));
      return;
    }
  }

  // React to story
  static async reactToStory(storyId: string, userId: string, reaction: string): Promise<void> {
    const payloads: Record<string, unknown>[] = [
      {
        story_id: storyId,
        user_id: userId,
        reaction,
      },
      {
        story_id: storyId,
        user_id: userId,
        emoji: reaction,
      },
      {
        story_id: storyId,
        viewer_id: userId,
        reaction,
      },
    ];

    for (const payload of payloads) {
      const upsertResult = await supabase
        .from('story_reactions')
        .upsert(payload, { onConflict: 'story_id,user_id' });

      if (!upsertResult.error) {
        return;
      }

      if (isOnConflictUnsupported(upsertResult.error.message)) {
        const insertResult = await supabase.from('story_reactions').insert(payload);
        if (!insertResult.error || isUniqueViolationError(insertResult.error.message)) {
          return;
        }
      }

      const message = upsertResult.error.message.toLowerCase();
      if (isUniqueViolationError(message)) {
        return;
      }

      if (isMissingObjectError(message) || isMissingColumnError(message)) {
        continue;
      }

      throw new Error(upsertResult.error.message);
    }
  }

  // Reply to story
  static async replyToStory(storyId: string, senderId: string, content: string): Promise<void> {
    const storyRes = await supabase
      .from('stories')
      .select('id, user_id')
      .eq('id', storyId)
      .maybeSingle();

    if (storyRes.error || !storyRes.data?.user_id) {
      throw new Error(storyRes.error?.message || 'Story tidak ditemukan');
    }

    const storyAuthorId = storyRes.data.user_id.toString();
    if (!storyAuthorId || storyAuthorId === senderId) {
      return;
    }

    try {
      const chat = await ChatService.createChat(senderId, storyAuthorId);
      await ChatService.sendMessage(senderId, {
        chatId: chat.id,
        content,
        messageType: 'text',
      });
      return;
    } catch (chatError) {
      const fallbackPayloads: Record<string, unknown>[] = [
        {
          story_id: storyId,
          sender_id: senderId,
          content,
          created_at: new Date().toISOString(),
        },
        {
          story_id: storyId,
          user_id: senderId,
          message: content,
          created_at: new Date().toISOString(),
        },
      ];

      for (const payload of fallbackPayloads) {
        const fallback = await supabase.from('story_replies').insert(payload);
        if (!fallback.error) {
          return;
        }

        const message = fallback.error.message.toLowerCase();
        if (isMissingObjectError(message) || isMissingColumnError(message)) {
          continue;
        }

        throw new Error(fallback.error.message);
      }

      if (chatError instanceof Error) {
        throw chatError;
      }

      throw new Error('Gagal mengirim balasan story');
    }
  }
}
