// Feed Hooks

'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedService } from './feed-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { toast } from 'sonner';
import type { BlockedUser, Post, Comment, Like } from '@/lib/types';

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

export function useUpdatePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { postId: string; caption: string }) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      const normalizedCaption = data.caption.trim();
      return await FeedService.updatePost(data.postId, {
        caption: normalizedCaption.length > 0 ? normalizedCaption : undefined,
      });
    },
    onSuccess: (_data, variables) => {
      toast.success('Postingan berhasil diperbarui');
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
                    caption: variables.caption.trim() || undefined,
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
          caption: variables.caption.trim() || undefined,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeletePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await FeedService.deletePost(postId);
      return postId;
    },
    onSuccess: (postId) => {
      toast.success('Postingan dihapus');
      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((post: Post) => post.id !== postId),
          })),
        };
      });
      queryClient.setQueryData(['post', postId], null);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
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
  const { user } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ['comments', postId, user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      return await FeedService.getPostComments(postId, pageParam, 20, user?.id);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length >= 20) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(postId && enabled),
  });
  const comments = query.data?.pages.flatMap((page) => page) ?? [];
  const loadMore = () => query.fetchNextPage();

  return {
    ...query,
    comments,
    loadMore,
    hasMore: Boolean(query.hasNextPage),
  };
}

export function useBlockUser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }
      await FeedService.blockUser(user.id, targetUserId);
      return targetUserId;
    },
    onMutate: async (targetUserId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['profile-posts'] });
      await queryClient.cancelQueries({ queryKey: ['saved-posts'] });
      await queryClient.cancelQueries({ queryKey: ['shared-posts'] });
      await queryClient.cancelQueries({ queryKey: ['replied-posts'] });
      await queryClient.cancelQueries({ queryKey: ['comments'] });
      await queryClient.cancelQueries({ queryKey: ['post-likes'] });
      await queryClient.cancelQueries({ queryKey: ['post'] });

      const previousPosts = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousProfilePosts = queryClient.getQueriesData({ queryKey: ['profile-posts'] });
      const previousSavedPosts = queryClient.getQueriesData({ queryKey: ['saved-posts'] });
      const previousSharedPosts = queryClient.getQueriesData({ queryKey: ['shared-posts'] });
      const previousRepliedPosts = queryClient.getQueriesData({ queryKey: ['replied-posts'] });
      const previousComments = queryClient.getQueriesData({ queryKey: ['comments'] });
      const previousPostLikes = queryClient.getQueriesData({ queryKey: ['post-likes'] });
      const previousPost = queryClient.getQueriesData({ queryKey: ['post'] });

      const prunePagedPosts = (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => {
            if (Array.isArray(page)) {
              return page.filter((post: Post) => post?.user_id !== targetUserId);
            }

            if (Array.isArray(page?.posts)) {
              return {
                ...page,
                posts: page.posts.filter((post: Post) => post?.user_id !== targetUserId),
              };
            }

            return page;
          }),
        };
      };

      queryClient.setQueriesData({ queryKey: ['posts'] }, prunePagedPosts);
      queryClient.setQueriesData({ queryKey: ['profile-posts'] }, prunePagedPosts);
      queryClient.setQueriesData({ queryKey: ['saved-posts'] }, prunePagedPosts);
      queryClient.setQueriesData({ queryKey: ['shared-posts'] }, prunePagedPosts);
      queryClient.setQueriesData({ queryKey: ['replied-posts'] }, prunePagedPosts);
      queryClient.setQueriesData({ queryKey: ['comments'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((comment) => comment?.user_id !== targetUserId);
      });
      queryClient.setQueriesData({ queryKey: ['post-likes'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((like) => like?.user_id !== targetUserId);
      });

      queryClient.setQueriesData({ queryKey: ['post'] }, (old: any) => {
        if (!old || typeof old !== 'object') return old;
        if ((old as Post).user_id === targetUserId) return null;
        return old;
      });

      return {
        previousPosts,
        previousProfilePosts,
        previousSavedPosts,
        previousSharedPosts,
        previousRepliedPosts,
        previousComments,
        previousPostLikes,
        previousPost,
      };
    },
    onSuccess: () => {
      toast.success('User berhasil diblokir');
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['post-likes'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['shared-posts'] });
      queryClient.invalidateQueries({ queryKey: ['replied-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
    },
    onError: (error: Error, _targetUserId, context) => {
      context?.previousPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousProfilePosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousSavedPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousSharedPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousRepliedPosts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousComments?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousPostLikes?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context?.previousPost?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      toast.error(error.message);
    },
  });
}

export function useBlockedUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as BlockedUser[];
      return await FeedService.getBlockedUsers(user.id);
    },
    enabled: Boolean(user?.id),
  });
}

export function useUnblockUser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }
      await FeedService.unblockUser(user.id, targetUserId);
      return targetUserId;
    },
    onSuccess: () => {
      toast.success('User berhasil dibuka blokirnya');
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['post-likes'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['shared-posts'] });
      queryClient.invalidateQueries({ queryKey: ['replied-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Add comment mutation
export function useAddComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { postId: string; content: string; parentId?: string; replyToName?: string }) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await FeedService.addComment(user.id, data.postId, data.content, {
        parentId: data.parentId,
        replyToName: data.replyToName,
      });
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

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { postId: string; commentId: string }) => {
      await FeedService.deleteComment(data.commentId);
      return data;
    },
    onSuccess: ({ postId, commentId }) => {
      toast.success('Komentar dihapus');
      queryClient.setQueriesData({ queryKey: ['comments', postId] }, (old: any) => {
        if (Array.isArray(old)) {
          return old.filter((comment) => comment?.id !== commentId);
        }
        if (!old?.pages) {
          return old;
        }
        return {
          ...old,
          pages: old.pages.map((page: any) => {
            if (!Array.isArray(page)) return page;
            return page.filter((comment) => comment?.id !== commentId);
          }),
        };
      });
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
                    comments_count: Math.max((post.comments_count ?? 0) - 1, 0),
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
          comments_count: Math.max((old.comments_count ?? 0) - 1, 0),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReportComment() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { commentId: string; reason: string }) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await FeedService.reportComment(user.id, data.commentId, data.reason);
      return data;
    },
    onSuccess: () => {
      toast.success('Laporan komentar terkirim');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReportPost() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { postId: string; reason: string }) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await FeedService.reportPost(user.id, data.postId, data.reason);
      return data;
    },
    onSuccess: () => {
      toast.success('Laporan postingan terkirim');
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

export function useToggleRepost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      return await FeedService.toggleRepost(user.id, postId);
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
              post.id === postId ? toggleRepostState(post) : post
            ),
          })),
        };
      });
      queryClient.setQueryData(['post', postId], (old: Post | null | undefined) => {
        if (!old) return old;
        return toggleRepostState(old);
      });

      return { previousPosts, previousPost };
    },
    onSuccess: (result) => {
      toast.success(result.reposted ? 'Post di-repost' : 'Repost dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
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
export function usePostLikes(postId: string, enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['post-likes', postId, user?.id],
    queryFn: () => FeedService.getPostLikes(postId, 1, 20, user?.id),
    enabled: Boolean(postId && enabled),
    staleTime: 1000 * 30,
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

function toggleRepostState(post: Post): Post {
  const currentlyReposted = Boolean(post.is_reposted);
  return {
    ...post,
    shares_count: currentlyReposted ? Math.max((post.shares_count ?? 0) - 1, 0) : (post.shares_count ?? 0) + 1,
    is_reposted: !currentlyReposted,
  };
}
