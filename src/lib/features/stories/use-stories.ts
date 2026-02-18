// Stories Hooks

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StoriesService } from './stories-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { toast } from 'sonner';
import type { Story } from '@/lib/types/stories';

export function useStories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stories'],
    queryFn: StoriesService.getStories,
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute for new stories
  });
}

export function useStory(storyId: string) {
  return useQuery({
    queryKey: ['story', storyId],
    queryFn: () => StoriesService.getStory(storyId),
    enabled: !!storyId,
  });
}

export function useUserStories(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['user-stories', targetUserId],
    queryFn: () => StoriesService.getUserStories(targetUserId || ''),
    enabled: !!targetUserId,
  });
}

export function useStoriesByUserIds(userIds: string[]) {
  return useQuery({
    queryKey: ['stories-by-ids', userIds],
    queryFn: () => StoriesService.getStoriesByUserIds(userIds),
    enabled: userIds.length > 0,
  });
}

export function useCreateStory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      mediaUrl: string;
      mediaType: 'image' | 'video';
      caption?: string;
      audience?: 'followers' | 'close_friends' | 'everyone';
    }) => {
      if (!user?.id) {
        throw new Error('You must be logged in to create a story');
      }

      return await StoriesService.createStory(user.id, data);
    },
    onSuccess: () => {
      toast.success('Story berhasil dibuat!');
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['user-stories', user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteStory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await StoriesService.deleteStory(storyId);
    },
    onSuccess: () => {
      toast.success('Story berhasil dihapus!');
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useMarkStoryViewed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!user?.id || !storyId) return;
      await StoriesService.markStoryViewed(storyId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-viewed-ids'] });
    },
  });
}

export function useReactToStory() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ storyId, reaction }: { storyId: string; reaction: string }) => {
      if (!user?.id) {
        throw new Error('Anda harus login.');
      }
      await StoriesService.reactToStory(storyId, user.id, reaction);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReplyToStory() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ storyId, content }: { storyId: string; content: string }) => {
      if (!user?.id) {
        throw new Error('Anda harus login.');
      }
      await StoriesService.replyToStory(storyId, user.id, content);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUserHasStories(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['user-has-stories', targetUserId],
    queryFn: () => StoriesService.userHasActiveStories(targetUserId || ''),
    enabled: !!targetUserId,
  });
}

export function useViewedStoryIds(storyIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['story-viewed-ids', user?.id, storyIds],
    queryFn: async () => {
      if (!user?.id || storyIds.length === 0) {
        return new Set<string>();
      }
      return StoriesService.getViewedStoryIds(storyIds, user.id);
    },
    enabled: Boolean(user?.id) && storyIds.length > 0,
    staleTime: 30_000,
  });
}
