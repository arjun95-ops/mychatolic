// Feed Hooks

'use client';

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedService } from './feed-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { toast } from 'sonner';
import type { Post, Comment, Like } from '@/lib/types';

// Posts hook with infinite scroll
export function usePosts(params?: {
  scope?: 'all' | 'country' | 'diocese' | 'parish';
  scopeId?: string;
}) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['posts', params],
    queryFn: async ({ pageParam = 1 }) => {
      return await FeedService.getPosts({
        page: pageParam,
        limit: 12,
        currentUserId: user?.id,
        ...params,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!user,
  });
}

export function useProfilePosts(params: { userId?: string; mediaOnly?: boolean }) {
  const { user } = useAuth();
  const targetUserId = params.userId?.trim() || user?.id;

  return useInfiniteQuery({
    queryKey: ['profile-posts', targetUserId, params.mediaOnly ?? false, user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!targetUserId) {
        return { posts: [], hasMore: false };
      }

      const result = await FeedService.getPostsByUser({
        userId: targetUserId,
        page: pageParam,
        limit: params.mediaOnly ? 24 : 12,
        currentUserId: user?.id,
      });

      if (!params.mediaOnly) {
        return result;
      }

      return {
        posts: result.posts.filter((post) => (post.image_url?.length ?? 0) > 0),
        hasMore: result.hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(user?.id && targetUserId),
  });
}

export function useSharedPosts(params: { userId?: string }) {
  const { user } = useAuth();
  const targetUserId = params.userId?.trim() || user?.id;

  return useInfiniteQuery({
    queryKey: ['shared-posts', targetUserId, user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!targetUserId) {
        return { posts: [], hasMore: false };
      }

      return await FeedService.getSharedPostsByUser({
        userId: targetUserId,
        page: pageParam,
        limit: 12,
        currentUserId: user?.id,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(user?.id && targetUserId),
  });
}

export function useRepliedPosts(params: { userId?: string }) {
  const { user } = useAuth();
  const targetUserId = params.userId?.trim() || user?.id;

  return useInfiniteQuery({
    queryKey: ['replied-posts', targetUserId, user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!targetUserId) {
        return { posts: [], hasMore: false };
      }

      return await FeedService.getRepliedPostsByUser({
        userId: targetUserId,
        page: pageParam,
        limit: 12,
        currentUserId: user?.id,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(user?.id && targetUserId),
  });
}

// Single post hook
export function usePost(postId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => FeedService.getPost(postId, user?.id),
    enabled: !!postId,
  });
}

// Create post mutation
export function useCreatePost() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { caption?: string; imageUrls?: string[] }) => {
      if (!user?.id) {
        throw new Error('You must be logged in to create a post');
      }

      return await FeedService.createPost(user.id, {
        ...data,
        countryId: profile?.country_id,
        dioceseId: profile?.diocese_id,
        churchId: profile?.church_id,
      });
    },
    onSuccess: () => {
      toast.success('Post berhasil dibuat!');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Toggle like mutation with optimistic update
export function useToggleLike() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await FeedService.toggleLike(user.id, postId);
    },
    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      // Snapshot previous values for all feed variants
      const previousPosts = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousPost = queryClient.getQueryData<Post | null>(['post', postId]);

      // Optimistically update
      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === postId ? toggleLikeState(post) : post
            ),
          })),
        };
      });
      queryClient.setQueryData(['post', postId], (old: Post | null | undefined) => {
        if (!old) return old;
        return toggleLikeState(old);
      });

      return { previousPosts, previousPost };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      context?.previousPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (context?.previousPost !== undefined) {
        queryClient.setQueryData(['post', variables], context.previousPost);
      }
      toast.error(error.message);
    },
    onSettled: (_result, _error, postId) => {
      // Refetch to ensure data is correct
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

// Comments hook
export function useComments(postId: string, enabled = true) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['comments', postId, page],
    queryFn: () => FeedService.getPostComments(postId, page),
    enabled: !!postId && enabled,
  });

  const loadMore = () => setPage((prev) => prev + 1);
  const reset = () => setPage(1);

  return {
    ...query,
    page,
    loadMore,
    reset,
    hasMore: (query.data?.length || 0) >= 20,
  };
}

// Add comment mutation
export function useAddComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { postId: string; content: string }) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await FeedService.addComment(user.id, data.postId, data.content);
    },
    onSuccess: (_data, variables) => {
      toast.success('Komentar berhasil ditambahkan');
      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === variables.postId
                ? {
                    ...post,
                    comments_count: (post.comments_count ?? 0) + 1,
                  }
                : post
            ),
          })),
        };
      });
      queryClient.setQueryData(['post', variables.postId], (old: Post | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          comments_count: (old.comments_count ?? 0) + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Saved posts hook
export function useSavedPosts() {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['saved-posts', user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!user?.id) {
        return [];
      }
      return await FeedService.getSavedPosts(user.id, pageParam);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length >= 12) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!user,
  });
}

// Toggle save mutation
export function useToggleSave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await FeedService.toggleSave(user.id, postId);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      const previousPosts = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousPost = queryClient.getQueryData<Post | null>(['post', postId]);

      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === postId
                ? {
                    ...post,
                    is_saved: !Boolean(post.is_saved),
                  }
                : post
            ),
          })),
        };
      });
      queryClient.setQueryData(['post', postId], (old: Post | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          is_saved: !Boolean(old.is_saved),
        };
      });

      return { previousPosts, previousPost };
    },
    onSuccess: (result) => {
      toast.success(result.saved ? 'Post disimpan' : 'Post dihapus dari tersimpan');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    },
    onError: (error: Error, postId, context) => {
      context?.previousPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (context?.previousPost !== undefined) {
        queryClient.setQueryData(['post', postId], context.previousPost);
      }
      toast.error(error.message);
    },
    onSettled: (_result, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    },
  });
}

export function useSharePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await FeedService.incrementShareCount(postId, user.id);
      return postId;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      const previousPosts = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousPost = queryClient.getQueryData<Post | null>(['post', postId]);

      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === postId ? incrementShareState(post) : post
            ),
          })),
        };
      });
      queryClient.setQueryData(['post', postId], (old: Post | null | undefined) => {
        if (!old) return old;
        return incrementShareState(old);
      });

      return { previousPosts, previousPost };
    },
    onError: (error: Error, postId, context) => {
      context?.previousPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (context?.previousPost !== undefined) {
        queryClient.setQueryData(['post', postId], context.previousPost);
      }
      toast.error(error.message);
    },
    onSettled: (_result, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

// Post likes hook
export function usePostLikes(postId: string) {
  return useQuery({
    queryKey: ['post-likes', postId],
    queryFn: () => FeedService.getPostLikes(postId),
    enabled: !!postId,
  });
}

function toggleLikeState(post: Post): Post {
  const currentlyLiked = Boolean(post.is_liked);
  return {
    ...post,
    likes_count: currentlyLiked ? Math.max((post.likes_count ?? 0) - 1, 0) : (post.likes_count ?? 0) + 1,
    is_liked: !currentlyLiked,
  };
}

function incrementShareState(post: Post): Post {
  return {
    ...post,
    shares_count: (post.shares_count ?? 0) + 1,
  };
}
