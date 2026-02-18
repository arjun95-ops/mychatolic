// Chat Hooks

'use client';

import { useEffect, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChatService } from './chat-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import type { SocialChat } from '@/lib/types';

type ChatFilter = 'all' | 'unread' | 'groups' | 'archived';

type CreateChatInput =
  | { otherUserId: string }
  | {
      groupName: string;
      avatarUrl?: string;
      memberIds: string[];
      inviteMode?: 'open' | 'approval' | 'admin_only';
      allowMemberInvite?: boolean;
    };

// Get user's chats
export function useChats(params?: { filter?: ChatFilter }) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['chats', user?.id, params?.filter ?? 'all'],
    queryFn: async ({ pageParam }) => {
      if (!user?.id) {
        return { chats: [], hasMore: false };
      }

      return ChatService.getChats({
        userId: user.id,
        page: pageParam,
        limit: 20,
        filter: params?.filter ?? 'all',
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
    enabled: Boolean(user?.id),
  });
}

// Get single chat with recent messages
export function useChat(chatId: string) {
  const { user } = useAuth();
  const { activeChatId } = useUIStore();

  const query = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => ChatService.getChatWithMessages(chatId),
    enabled: Boolean(chatId && user?.id),
  });

  return {
    ...query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isActive: activeChatId === chatId,
  };
}

// Create 1:1 chat or group chat
export function useCreateChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveChatId } = useUIStore();

  return useMutation({
    mutationFn: async (data: CreateChatInput) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      if ('otherUserId' in data) {
        return ChatService.createChat(user.id, data.otherUserId);
      }

      return ChatService.createGroup(user.id, {
        groupName: data.groupName,
        avatarUrl: data.avatarUrl,
        memberIds: data.memberIds,
        inviteMode: data.inviteMode,
        allowMemberInvite: data.allowMemberInvite,
      });
    },
    onSuccess: (chat) => {
      toast.success('Chat berhasil dibuat');
      setActiveChatId(chat.id);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Join group by invite code
export function useJoinGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveChatId } = useUIStore();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user?.id) {
        throw new Error('Anda harus login untuk bergabung grup');
      }

      return ChatService.joinGroup(user.id, inviteCode);
    },
    onSuccess: (chat) => {
      toast.success('Berhasil bergabung ke grup');
      if (chat?.id) {
        setActiveChatId(chat.id);
      }
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Leave chat/group
export function useLeaveChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveChatId } = useUIStore();

  return useMutation({
    mutationFn: async (chatId: string) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      await ChatService.leaveChat(user.id, chatId);
    },
    onSuccess: (_, chatId) => {
      toast.success('Anda keluar dari grup');
      setActiveChatId(null);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', chatId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Send message
export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      chatId: string;
      content?: string;
      imageUrl?: string;
      file?: File;
      replyToId?: string;
    }) => {
      if (!user?.id) {
        throw new Error('Anda harus login untuk mengirim pesan');
      }

      const messageType =
        data.file
          ? (
              data.file.type.startsWith('image/')
                ? 'image'
                : data.file.type.startsWith('video/')
                  ? 'video'
                  : data.file.type.startsWith('audio/')
                    ? 'audio'
                    : 'file'
            )
          : data.imageUrl
            ? ('image' as const)
            : ('text' as const);

      return ChatService.sendMessage(user.id, {
        chatId: data.chatId,
        content: data.content,
        imageUrl: data.imageUrl,
        imageFile: data.file,
        messageType,
        replyToId: data.replyToId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Archive or unarchive chat
export function useSetChatArchived() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, archived }: { chatId: string; archived: boolean }) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      await ChatService.setChatArchived(user.id, chatId, archived);
    },
    onSuccess: (_, variables) => {
      toast.success(variables.archived ? 'Chat diarsipkan' : 'Chat dipulihkan');
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', variables.chatId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Pin or unpin chat
export function useSetChatPinned() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, pinned }: { chatId: string; pinned: boolean }) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      await ChatService.setChatPinned(user.id, chatId, pinned);
    },
    onSuccess: (_, variables) => {
      toast.success(variables.pinned ? 'Chat dipin' : 'Pin chat dilepas');
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', variables.chatId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Mute or unmute chat
export function useSetChatMuted() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, muted }: { chatId: string; muted: boolean }) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      await ChatService.setChatMuted(user.id, chatId, muted);
    },
    onSuccess: (_, variables) => {
      toast.success(variables.muted ? 'Notifikasi chat dibisukan' : 'Notifikasi chat diaktifkan');
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', variables.chatId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Mark a chat as read for current user
export function useMarkChatAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }

      await ChatService.markAsRead(user.id, chatId);
    },
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', chatId] });
    },
  });
}

// Get chat messages with pagination
export function useChatMessages(chatId: string) {
  const { user } = useAuth();
  const scrollToBottom = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: async ({ pageParam }) => ChatService.getMessages(chatId, pageParam, 50),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 50 ? allPages.length + 1 : undefined,
    enabled: Boolean(chatId && user?.id),
  });

  const flatMessages = query.data?.pages.flatMap((page) => page) ?? [];

  useEffect(() => {
    if (flatMessages.length === 0) return;
    scrollToBottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [flatMessages.length]);

  return {
    messages: flatMessages,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    scrollToBottom,
  };
}

// Search messages from full chat history
export function useChatSearch(chatId: string, searchQuery: string, limit = 120) {
  const { user } = useAuth();
  const normalized = searchQuery.trim();

  return useQuery({
    queryKey: ['chat-search', chatId, normalized, limit],
    queryFn: () => ChatService.searchMessages(chatId, normalized, limit),
    enabled: Boolean(chatId && user?.id && normalized.length >= 2),
    staleTime: 15_000,
  });
}

// Get chat members
export function useChatMembers(chatId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['chat-members', chatId],
    queryFn: () => ChatService.getChatMembers(chatId),
    enabled: Boolean(chatId && user?.id),
  });
}

// Get pending join requests for group moderation
export function useJoinRequests(chatId: string, enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['chat-join-requests', chatId],
    queryFn: () => ChatService.getJoinRequests(chatId),
    enabled: Boolean(chatId && user?.id && enabled),
  });
}

// Approve join request
export function useApproveJoinRequest(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (joinRequestId: string) => ChatService.acceptJoinRequest(joinRequestId),
    onSuccess: () => {
      toast.success('Permintaan disetujui');
      queryClient.invalidateQueries({ queryKey: ['chat-join-requests', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-members', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Reject join request
export function useRejectJoinRequest(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (joinRequestId: string) => ChatService.rejectJoinRequest(joinRequestId),
    onSuccess: () => {
      toast.success('Permintaan ditolak');
      queryClient.invalidateQueries({ queryKey: ['chat-join-requests', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete message
export function useDeleteMessage(chatId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => ChatService.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      toast.success('Pesan dihapus');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Toggle message reaction
export function useToggleReaction(chatId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: string; reaction: string }) => {
      if (!user?.id) {
        throw new Error('Anda harus login');
      }
      return ChatService.toggleReaction(user.id, messageId, reaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useMessageReactions(messageId: string) {
  return useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: () => ChatService.getMessageReactions(messageId),
    enabled: Boolean(messageId),
  });
}

// Get user's mutual follows
export function useMutualFollows() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['mutual-follows', user?.id],
    queryFn: () => {
      if (!user?.id) {
        return Promise.resolve([]);
      }
      return ChatService.getMutualFollows(user.id);
    },
    enabled: Boolean(user?.id),
  });
}

export function useSetActiveChat() {
  const { setActiveChatId } = useUIStore();
  return {
    setActiveChatId,
  };
}

export function useActiveChatId() {
  return useUIStore((state) => state.activeChatId);
}
