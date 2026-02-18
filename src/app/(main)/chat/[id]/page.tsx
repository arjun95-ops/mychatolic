// Chat Detail Page

'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Copy,
  FileText,
  Info,
  Images,
  Loader2,
  LogOut,
  Music2,
  Paperclip,
  Pin,
  Search as SearchIcon,
  Send,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  useApproveJoinRequest,
  useChat,
  useChatMembers,
  useChatMessages,
  useChatSearch,
  useJoinRequests,
  useLeaveChat,
  useMarkChatAsRead,
  useRejectJoinRequest,
  useSendMessage,
  useSetChatArchived,
  useSetChatMuted,
  useSetChatPinned,
} from '@/lib/features/chat/use-chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatInboxPanel } from '@/components/chat/chat-inbox-panel';

function getInitials(name?: string) {
  return (
    name
      ?.split(' ')
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US'
  );
}

function formatInviteMode(mode?: 'open' | 'approval' | 'admin_only') {
  switch (mode) {
    case 'approval':
      return 'Perlu Persetujuan';
    case 'admin_only':
      return 'Admin Saja';
    default:
      return 'Terbuka';
  }
}

type MediaFilter = 'all' | 'image' | 'video' | 'audio' | 'file';

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const chatId = decodeURIComponent(params.id);
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isThreadDialogOpen, setIsThreadDialogOpen] = useState(false);
  const [threadRootMessageId, setThreadRootMessageId] = useState<string | null>(null);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [activeJoinRequestId, setActiveJoinRequestId] = useState<string | null>(null);
  const [jumpingMessageId, setJumpingMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markAsReadKeyRef = useRef<string | null>(null);

  const { chat, isLoading } = useChat(chatId);
  const {
    messages,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: isMessagesLoading,
    scrollToBottom,
  } = useChatMessages(chatId);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const debouncedNormalizedSearch = debouncedSearchQuery.trim().toLowerCase();
  const usesRemoteSearch = normalizedSearch.length >= 2;
  const isSearchDebouncing =
    usesRemoteSearch && debouncedNormalizedSearch !== normalizedSearch;
  const {
    data: searchedMessages = [],
    isLoading: isSearchingMessages,
  } = useChatSearch(chatId, debouncedNormalizedSearch);
  const { data: members = [], isLoading: isMembersLoading } = useChatMembers(chatId);
  const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
  const { mutateAsync: setChatArchived, isPending: isArchiving } = useSetChatArchived();
  const { mutateAsync: setChatPinned, isPending: isPinning } = useSetChatPinned();
  const { mutateAsync: setChatMuted, isPending: isMuting } = useSetChatMuted();
  const { mutateAsync: leaveChat, isPending: isLeavingChat } = useLeaveChat();
  const { mutate: markChatAsRead } = useMarkChatAsRead();
  const { mutateAsync: approveJoinRequest } = useApproveJoinRequest(chatId);
  const { mutateAsync: rejectJoinRequest } = useRejectJoinRequest(chatId);

  const isGroupChat = Boolean(chat?.is_group);
  const membership = useMemo(
    () => members.find((member) => member.user_id === user?.id),
    [members, user?.id]
  );
  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== 'LEFT' && member.status !== 'KICKED'),
    [members]
  );
  const directChatPartner = useMemo(() => {
    if (isGroupChat) return undefined;
    return (
      members.find(
        (member) =>
          member.user_id !== user?.id &&
          member.status !== 'LEFT' &&
          member.status !== 'KICKED'
      ) ?? members.find((member) => member.user_id !== user?.id)
    );
  }, [isGroupChat, members, user?.id]);
  const title = isGroupChat
    ? chat?.group_name || 'Grup Tanpa Nama'
    : directChatPartner?.profile?.full_name || chat?.group_name || 'User';
  const avatar = isGroupChat
    ? chat?.group_avatar_url
    : directChatPartner?.profile?.avatar_url || chat?.group_avatar_url;
  const isCurrentUserAdmin = Boolean(chat?.admin_id === user?.id || membership?.role === 'admin');
  const canModerateJoinRequests = Boolean(
    isGroupChat && isCurrentUserAdmin && chat?.invite_mode === 'approval'
  );
  const { data: joinRequests = [], isLoading: isJoinRequestsLoading } = useJoinRequests(
    chatId,
    canModerateJoinRequests
  );
  const isPinned = Boolean(membership?.pinned_at);
  const isMuted = Boolean(
    membership?.muted_until &&
      new Date(membership.muted_until).getTime() > Date.now()
  );
  const isArchived = Boolean(membership?.archived_at || membership?.status === 'LEFT');
  const canSendMessage = Boolean(
    user?.id &&
      !isLoading &&
      !isMembersLoading &&
      membership &&
      membership.status !== 'LEFT' &&
      membership.status !== 'KICKED'
  );
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  );
  const loadedMessageIdSet = useMemo(
    () => new Set(sortedMessages.map((message) => message.id)),
    [sortedMessages]
  );
  const readStatsByMessageId = useMemo(() => {
    const result = new Map<string, number>();

    const otherActiveMembers = members.filter(
      (member) =>
        member.user_id !== user?.id &&
        member.status !== 'LEFT' &&
        member.status !== 'KICKED'
    );

    for (const message of sortedMessages) {
      if (message.sender_id !== user?.id) continue;

      const messageTime = new Date(message.created_at).getTime();
      if (!Number.isFinite(messageTime)) {
        result.set(message.id, 0);
        continue;
      }

      let readers = 0;
      for (const member of otherActiveMembers) {
        if (!member.last_read_at) continue;
        const memberReadTime = new Date(member.last_read_at).getTime();
        if (Number.isFinite(memberReadTime) && memberReadTime >= messageTime) {
          readers += 1;
        }
      }

      result.set(message.id, readers);
    }

    return {
      byMessageId: result,
      totalRecipients: otherActiveMembers.length,
    };
  }, [members, sortedMessages, user?.id]);
  const messagesById = useMemo(
    () => new Map(sortedMessages.map((message) => [message.id, message])),
    [sortedMessages]
  );
  const replyToMessage = useMemo(
    () => (replyToMessageId ? messagesById.get(replyToMessageId) : undefined),
    [messagesById, replyToMessageId]
  );
  const rootMessageByReply = useMemo(() => {
    const result = new Map<string, string>();

    for (const message of sortedMessages) {
      let rootId = message.id;
      let parentId = message.reply_to_id;
      let guard = 0;

      while (parentId && guard < 40) {
        const parent = messagesById.get(parentId);
        if (!parent) break;
        rootId = parent.id;
        parentId = parent.reply_to_id;
        guard += 1;
      }

      result.set(message.id, rootId);
    }

    return result;
  }, [messagesById, sortedMessages]);
  const repliesCountByRoot = useMemo(() => {
    const result = new Map<string, number>();

    for (const message of sortedMessages) {
      if (!message.reply_to_id) continue;
      const rootId = rootMessageByReply.get(message.id) ?? message.reply_to_id;
      result.set(rootId, (result.get(rootId) ?? 0) + 1);
    }

    return result;
  }, [rootMessageByReply, sortedMessages]);
  const unreadMarkerMessageId = useMemo(() => {
    const nonMineMessages = sortedMessages.filter((message) => message.sender_id !== user?.id);
    if (nonMineMessages.length === 0) return null;

    const rawLastReadAt = membership?.last_read_at;
    if (!rawLastReadAt) {
      return nonMineMessages[0]?.id ?? null;
    }

    const lastReadAt = new Date(rawLastReadAt).getTime();
    if (!Number.isFinite(lastReadAt)) {
      return nonMineMessages[0]?.id ?? null;
    }

    const firstUnread = nonMineMessages.find((message) => {
      const createdAt = new Date(message.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt > lastReadAt;
    });

    return firstUnread?.id ?? null;
  }, [membership?.last_read_at, sortedMessages, user?.id]);
  const latestIncomingMessageId = useMemo(() => {
    for (let index = sortedMessages.length - 1; index >= 0; index -= 1) {
      const message = sortedMessages[index];
      if (message.sender_id !== user?.id) {
        return message.id;
      }
    }
    return null;
  }, [sortedMessages, user?.id]);
  const threadMessages = useMemo(() => {
    if (!threadRootMessageId) return [];

    const threadIds = new Set<string>([threadRootMessageId]);
    let didGrow = true;

    while (didGrow) {
      didGrow = false;

      for (const message of sortedMessages) {
        if (!message.reply_to_id) continue;
        if (threadIds.has(message.reply_to_id) && !threadIds.has(message.id)) {
          threadIds.add(message.id);
          didGrow = true;
        }
      }
    }

    return sortedMessages.filter((message) => threadIds.has(message.id));
  }, [sortedMessages, threadRootMessageId]);
  const threadRootMessage = useMemo(
    () => (threadRootMessageId ? messagesById.get(threadRootMessageId) : undefined),
    [messagesById, threadRootMessageId]
  );
  const localSearchMessages = useMemo(() => {
    if (!normalizedSearch) return sortedMessages;

    return sortedMessages.filter((message) => {
      const haystacks = [
        message.content,
        message.file_name,
        message.sender?.full_name,
        message.message_type,
      ]
        .filter(Boolean)
        .map((value) => value!.toString().toLowerCase());

      return haystacks.some((value) => value.includes(normalizedSearch));
    });
  }, [sortedMessages, normalizedSearch]);
  const visibleMessages = useMemo(() => {
    if (!normalizedSearch) return sortedMessages;
    if (!usesRemoteSearch) return localSearchMessages;
    if (debouncedNormalizedSearch !== normalizedSearch) return localSearchMessages;
    if (searchedMessages.length > 0) return searchedMessages;
    return localSearchMessages;
  }, [
    debouncedNormalizedSearch,
    localSearchMessages,
    normalizedSearch,
    searchedMessages,
    sortedMessages,
    usesRemoteSearch,
  ]);
  const mediaMessages = useMemo(
    () =>
      sortedMessages.filter(
        (message) =>
          ['image', 'video', 'audio', 'file'].includes(message.message_type) &&
          (Boolean(message.media_url) || Boolean(message.file_name))
      ),
    [sortedMessages]
  );
  const filteredMediaMessages = useMemo(() => {
    if (mediaFilter === 'all') return mediaMessages;
    return mediaMessages.filter((message) => message.message_type === mediaFilter);
  }, [mediaFilter, mediaMessages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 260);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !chatId || !latestIncomingMessageId) return;
    const markerKey = `${chatId}:${latestIncomingMessageId}`;
    if (markAsReadKeyRef.current === markerKey) return;

    const timer = setTimeout(() => {
      markChatAsRead(chatId);
      markAsReadKeyRef.current = markerKey;
    }, 280);

    return () => clearTimeout(timer);
  }, [chatId, latestIncomingMessageId, markChatAsRead, user?.id]);

  const setMessageRef = (messageId: string, node: HTMLDivElement | null) => {
    if (node) {
      messageRefs.current.set(messageId, node);
      return;
    }
    messageRefs.current.delete(messageId);
  };

  const focusMessage = (messageId: string, clearSearch = false) => {
    const hadSearch = Boolean(searchQuery.trim());
    if (clearSearch && hadSearch) {
      setSearchQuery('');
    }

    const waitMs = clearSearch && hadSearch ? 90 : 0;
    setTimeout(() => {
      const node = messageRefs.current.get(messageId);
      if (!node) {
        toast.error('Pesan tidak ditemukan');
        return;
      }

      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === messageId ? null : current));
      }, 2200);
    }, waitMs);
  };

  const handleJumpToSearchResult = async (messageId: string) => {
    setJumpingMessageId(messageId);
    try {
      let found = loadedMessageIdSet.has(messageId);
      let canLoadMore = hasNextPage;
      let attempt = 0;

      while (!found && canLoadMore && attempt < 24) {
        const result = await fetchNextPage();
        const pages = result.data?.pages ?? [];
        found = pages.some((page) => page.some((message) => message.id === messageId));
        canLoadMore = Boolean(result.hasNextPage);
        attempt += 1;
      }

      if (!found) {
        toast.error('Pesan tidak bisa dibuka dari riwayat saat ini');
        return;
      }

      setSearchQuery('');
      setTimeout(() => {
        focusMessage(messageId, false);
      }, 140);
    } finally {
      setJumpingMessageId(null);
    }
  };

  const openThread = (messageId: string) => {
    const rootId = rootMessageByReply.get(messageId) ?? messageId;
    setThreadRootMessageId(rootId);
    setIsThreadDialogOpen(true);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSendMessage) {
      toast.error('Anda tidak bisa mengirim pesan pada chat ini');
      return;
    }

    const content = text.trim();
    if (!content && !selectedFile) return;

    try {
      await sendMessage({
        chatId,
        content: content || selectedFile?.name,
        file: selectedFile ?? undefined,
        replyToId: replyToMessageId ?? undefined,
      });

      setText('');
      setSelectedFile(null);
      setReplyToMessageId(null);
    } catch {
      // Error toast handled by mutation hook.
    }
  };

  const handleToggleArchive = async () => {
    await setChatArchived({
      chatId,
      archived: !isArchived,
    });
  };

  const handleTogglePinned = async () => {
    await setChatPinned({
      chatId,
      pinned: !isPinned,
    });
  };

  const handleToggleMuted = async () => {
    await setChatMuted({
      chatId,
      muted: !isMuted,
    });
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setSelectedFile(nextFile);
    event.target.value = '';
  };

  const handleCopyInviteCode = async () => {
    const inviteCode = chat?.invite_code;
    if (!inviteCode) {
      toast.error('Kode undangan belum tersedia');
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success('Kode undangan disalin');
    } catch {
      toast.error('Gagal menyalin kode undangan');
    }
  };

  const handleModerateJoinRequest = async (
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    setActiveJoinRequestId(requestId);
    try {
      if (action === 'approve') {
        await approveJoinRequest(requestId);
        return;
      }
      await rejectJoinRequest(requestId);
    } finally {
      setActiveJoinRequestId(null);
    }
  };

  const handleLeaveGroup = async () => {
    await leaveChat(chatId);
    setIsGroupInfoOpen(false);
    router.push('/chat');
  };

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-[1280px] gap-3 overflow-hidden text-foreground md:grid-cols-[360px_minmax(0,1fr)]">
      <div className="hidden h-full min-h-0 md:block">
        <ChatInboxPanel
          className="h-full"
          selectedChatId={chatId}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <Card className="border border-border bg-card py-0 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground/80 hover:bg-muted/60 hover:text-foreground md:hidden"
              onClick={() => router.back()}
              aria-label="Kembali ke daftar chat"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatar} alt={title} />
              <AvatarFallback className="bg-card text-foreground/90">{title.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground">Chat realtime terhubung Supabase</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {isGroupChat && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={() => setIsGroupInfoOpen(true)}
                  aria-label="Info grup"
                >
                  <Info className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => void handleTogglePinned()}
                disabled={isPinning}
                aria-label={isPinned ? 'Lepas pin chat' : 'Pin chat'}
              >
                {isPinning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pin className={`h-5 w-5 ${isPinned ? 'fill-current' : ''}`} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => void handleToggleMuted()}
                disabled={isMuting}
                aria-label={isMuted ? 'Aktifkan notifikasi chat' : 'Bisukan notifikasi chat'}
              >
                {isMuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isMuted ? (
                  <BellOff className="h-5 w-5" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => void handleToggleArchive()}
                disabled={isArchiving}
                aria-label={isArchived ? 'Keluarkan dari arsip' : 'Arsipkan chat'}
              >
                {isArchiving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isArchived ? (
                  <ArchiveRestore className="h-5 w-5" />
                ) : (
                  <Archive className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col border border-border bg-card py-0 shadow-sm">
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-card p-4">
          <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-card/95 p-2 backdrop-blur">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari pesan, nama, atau file..."
                className="border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground/80"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsMediaGalleryOpen(true)}
              className="border-border bg-transparent text-foreground/90 hover:bg-muted/60"
              aria-label="Buka galeri media chat"
            >
              <Images className="h-4 w-4" />
            </Button>
          </div>

          {hasNextPage && !normalizedSearch && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full border-border bg-transparent text-foreground/90 hover:bg-muted/60"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  'Muat pesan sebelumnya'
                )}
              </Button>
            </div>
          )}

          {normalizedSearch && (
            <p className="px-1 text-[11px] text-muted-foreground/80">
              {!usesRemoteSearch
                ? `${visibleMessages.length} hasil ditemukan dari riwayat yang sudah dimuat. Ketik minimal 2 karakter untuk mencari seluruh riwayat chat.`
                : isSearchDebouncing
                  ? 'Menyiapkan pencarian...'
                  : isSearchingMessages
                    ? 'Mencari di seluruh riwayat chat...'
                : `${visibleMessages.length} hasil ditemukan ${
                    usesRemoteSearch
                      ? 'dari seluruh riwayat chat'
                      : 'dari riwayat yang sudah dimuat'
                  }. Klik "Buka konteks" untuk lompat ke posisi pesan.`}
            </p>
          )}

          {isLoading || isMessagesLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat percakapan...
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/80">
              Belum ada pesan. Mulai percakapan sekarang.
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/80">
              Tidak ada pesan yang cocok dengan kata kunci.
            </div>
          ) : (
            visibleMessages.map((message) => {
              const isMine = message.sender_id === user?.id;
              const repliedMessage = message.reply_to_id
                ? messagesById.get(message.reply_to_id)
                : undefined;
              const hasMedia = Boolean(message.media_url);
              const messageText = message.content || message.file_name || '[media]';
              const replyCount = repliesCountByRoot.get(message.id) ?? 0;
              const showUnreadDivider =
                !normalizedSearch &&
                Boolean(unreadMarkerMessageId) &&
                unreadMarkerMessageId === message.id;
              const readCount = readStatsByMessageId.byMessageId.get(message.id) ?? 0;
              const showReadStatus =
                isMine &&
                readStatsByMessageId.totalRecipients > 0 &&
                message.message_type !== 'location';
              const isSearchMode = Boolean(normalizedSearch);
              const senderLabel =
                message.sender?.full_name || (isMine ? 'Anda' : 'Pengguna');

              return (
                <Fragment key={message.id}>
                  {showUnreadDivider && (
                    <div className="my-2 flex items-center gap-2 px-1">
                      <span className="h-px flex-1 bg-muted/60" />
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent/90">
                        Pesan belum dibaca
                      </span>
                      <span className="h-px flex-1 bg-muted/60" />
                    </div>
                  )}

                  <div
                    ref={(node) => setMessageRef(message.id, node)}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`chat-bubble-interactive max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        isMine ? 'chat-bubble-enter-mine chat-bubble-mine' : 'chat-bubble-enter-other chat-bubble-other'
                      } ${
                        isMine ? 'bg-accent text-white' : 'bg-card text-foreground/90'
                      } ${
                        highlightedMessageId === message.id
                          ? 'ring-2 ring-accent/70'
                          : ''
                      }`}
                    >
                      {isSearchMode && (
                        <p
                          className={`mb-1 text-[10px] font-semibold ${
                            isMine
                              ? 'text-white/90'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {senderLabel}
                        </p>
                      )}

                      {repliedMessage && (
                        <button
                          type="button"
                          onClick={() => focusMessage(repliedMessage.id, true)}
                          className={`mb-2 rounded-lg px-2 py-1 text-left text-xs ${
                            isMine
                              ? 'bg-card/15 text-white/90'
                              : 'bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          Balas: {repliedMessage.content || repliedMessage.file_name || '[media]'}
                        </button>
                      )}

                      {hasMedia && message.message_type === 'image' && (
                        <img
                          src={message.media_url}
                          alt={message.file_name || 'chat-media'}
                          className="mb-2 max-h-64 rounded-xl object-cover"
                        />
                      )}
                      {hasMedia && message.message_type === 'video' && (
                        <video
                          src={message.media_url}
                          controls
                          className="mb-2 max-h-64 rounded-xl"
                        />
                      )}
                      {hasMedia && message.message_type === 'audio' && (
                        <audio src={message.media_url} controls className="mb-2 w-full" />
                      )}
                      {hasMedia && message.message_type === 'file' && (
                        <a
                          href={message.media_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mb-2 block underline ${
                            isMine ? 'text-white' : 'text-foreground'
                          }`}
                        >
                          {message.file_name || 'Buka lampiran'}
                        </a>
                      )}

                      {messageText}
                      <div className={`mt-1 text-[11px] ${isMine ? 'text-white/75' : 'text-muted-foreground/80'}`}>
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </div>
                      {showReadStatus && (
                        <div
                          className={`mt-0.5 inline-flex items-center gap-1 text-[10px] ${
                            isMine ? 'text-white/85' : 'text-muted-foreground/80'
                          }`}
                        >
                          {readCount > 0 ? (
                            <>
                              <CheckCheck className="h-3.5 w-3.5" />
                              {isGroupChat ? `Dibaca ${readCount}` : 'Dibaca'}
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Terkirim
                            </>
                          )}
                        </div>
                      )}
                      {isSearchMode ? (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => void handleJumpToSearchResult(message.id)}
                            disabled={jumpingMessageId === message.id || jumpingMessageId !== null}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium underline ${
                              isMine ? 'text-white/90' : 'text-muted-foreground'
                            } disabled:opacity-60`}
                          >
                            {jumpingMessageId === message.id ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Membuka...
                              </>
                            ) : (
                              'Buka konteks'
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setReplyToMessageId(message.id)}
                            className={`text-[11px] font-medium ${
                              isMine ? 'text-white/90' : 'text-muted-foreground'
                            }`}
                          >
                            Balas
                          </button>
                          {(replyCount > 0 || message.reply_to_id) && (
                            <button
                              type="button"
                              onClick={() => openThread(message.id)}
                              className={`text-[11px] font-medium ${
                                isMine ? 'text-white/90' : 'text-muted-foreground'
                              }`}
                            >
                              {replyCount > 0 ? `${replyCount} balasan` : 'Lihat thread'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
          <div ref={scrollToBottom} />
        </CardContent>

        <form onSubmit={handleSend} className="border-t border-border bg-card px-4 py-3">
          {!canSendMessage && !isLoading && !isMembersLoading && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Anda tidak lagi menjadi anggota chat ini. Anda hanya bisa membaca riwayat pesan.
            </div>
          )}

          {replyToMessage && (
            <div className="composer-chip-enter mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Membalas:</p>
                <p className="truncate text-muted-foreground">
                  {replyToMessage.content || replyToMessage.file_name || '[media]'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                onClick={() => setReplyToMessageId(null)}
                aria-label="Batal balas pesan"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {selectedFile && (
            <div className="composer-chip-enter mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Lampiran dipilih:</p>
                <p className="truncate text-muted-foreground">{selectedFile.name}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                onClick={() => setSelectedFile(null)}
                aria-label="Hapus lampiran"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
            onChange={handleAttachmentChange}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || !canSendMessage}
              className="border-border bg-transparent text-foreground/90 hover:bg-muted/60"
              aria-label="Tambah lampiran"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={selectedFile ? 'Tambahkan caption...' : 'Tulis pesan...'}
              disabled={isSending || !canSendMessage}
              className="border-border bg-card text-foreground placeholder:text-muted-foreground/80"
            />
            <Button
              type="submit"
              disabled={isSending || !canSendMessage || (!text.trim() && !selectedFile)}
              className="bg-accent text-white hover:bg-accent/90"
              aria-label="Kirim pesan"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </Card>

      </div>

      <Dialog open={isMediaGalleryOpen} onOpenChange={setIsMediaGalleryOpen}>
        <DialogContent className="max-w-3xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Galeri Media Chat</DialogTitle>
            <DialogDescription>
              Jelajahi lampiran media lalu lompat ke pesan aslinya.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mediaFilter} onValueChange={(value) => setMediaFilter(value as MediaFilter)}>
            <TabsList className="grid h-10 w-full grid-cols-5 bg-card">
              <TabsTrigger value="all" className="data-[state=active]:bg-accent data-[state=active]:text-white">Semua</TabsTrigger>
              <TabsTrigger value="image" className="data-[state=active]:bg-accent data-[state=active]:text-white">Gambar</TabsTrigger>
              <TabsTrigger value="video" className="data-[state=active]:bg-accent data-[state=active]:text-white">Video</TabsTrigger>
              <TabsTrigger value="audio" className="data-[state=active]:bg-accent data-[state=active]:text-white">Audio</TabsTrigger>
              <TabsTrigger value="file" className="data-[state=active]:bg-accent data-[state=active]:text-white">File</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-xl border border-border p-2">
            {filteredMediaMessages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Belum ada media pada filter ini.
              </div>
            ) : (
              filteredMediaMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className="w-full rounded-xl border border-border bg-card p-2 text-left transition-colors hover:bg-muted/60"
                  onClick={() => {
                    setIsMediaGalleryOpen(false);
                    focusMessage(message.id, true);
                  }}
                >
                  {message.message_type === 'image' && message.media_url ? (
                    <img
                      src={message.media_url}
                      alt={message.file_name || 'chat-image'}
                      className="mb-2 h-40 w-full rounded-lg object-cover"
                    />
                  ) : message.message_type === 'video' && message.media_url ? (
                    <video
                      src={message.media_url}
                      className="mb-2 h-40 w-full rounded-lg object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      {message.message_type === 'audio' ? (
                        <Music2 className="h-4 w-4" />
                      ) : message.message_type === 'video' ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span className="truncate">{message.file_name || message.content || 'Lampiran'}</span>
                    </div>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {message.content || message.file_name || 'Media'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                      locale: id,
                    })}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isThreadDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsThreadDialogOpen(nextOpen);
          if (!nextOpen) {
            setThreadRootMessageId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Thread Balasan</DialogTitle>
            <DialogDescription>
              {threadRootMessage
                ? `Diskusi dari: ${threadRootMessage.content || threadRootMessage.file_name || '[media]'}`
                : 'Lihat alur balasan dalam satu rangkaian pesan.'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-xl border border-border p-2">
            {threadMessages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Belum ada balasan pada thread ini.
              </div>
            ) : (
              threadMessages.map((message) => {
                const isMine = message.sender_id === user?.id;
                const repliedMessage = message.reply_to_id
                  ? messagesById.get(message.reply_to_id)
                  : undefined;

                return (
                  <div
                    key={message.id}
                    className={`rounded-xl border border-border p-2 ${
                      isMine ? 'border-accent/30 bg-accent/15' : 'border-border bg-card'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        {message.sender?.full_name || (isMine ? 'Anda' : message.sender_id)}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </span>
                    </div>

                    {repliedMessage && (
                      <button
                        type="button"
                        className="mb-2 block w-full rounded-md bg-muted/60 px-2 py-1 text-left text-xs text-muted-foreground"
                        onClick={() => openThread(repliedMessage.id)}
                      >
                        Balas: {repliedMessage.content || repliedMessage.file_name || '[media]'}
                      </button>
                    )}

                    {message.media_url && message.message_type === 'image' && (
                      <img
                        src={message.media_url}
                        alt={message.file_name || 'thread-image'}
                        className="mb-2 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    {message.media_url && message.message_type === 'video' && (
                      <video
                        src={message.media_url}
                        controls
                        className="mb-2 max-h-48 rounded-lg"
                      />
                    )}
                    {message.media_url && message.message_type === 'audio' && (
                      <audio src={message.media_url} controls className="mb-2 w-full" />
                    )}
                    {message.media_url && message.message_type === 'file' && (
                      <a
                        href={message.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-2 block text-sm underline"
                      >
                        {message.file_name || 'Buka lampiran'}
                      </a>
                    )}

                    <p className="text-sm">{message.content || message.file_name || '[media]'}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border bg-transparent text-foreground/90 hover:bg-muted/60"
                        onClick={() => {
                          setReplyToMessageId(message.id);
                          setIsThreadDialogOpen(false);
                        }}
                      >
                        Balas
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                        onClick={() => {
                          setIsThreadDialogOpen(false);
                          focusMessage(message.id, true);
                        }}
                      >
                        Lompat ke Pesan
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isGroupChat && (
        <Dialog open={isGroupInfoOpen} onOpenChange={setIsGroupInfoOpen}>
          <DialogContent className="max-w-2xl border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>{chat?.group_name || 'Info Grup'}</DialogTitle>
              <DialogDescription>
                Kelola anggota, undangan, dan moderasi permintaan bergabung.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{formatInviteMode(chat?.invite_mode)}</Badge>
                <Badge variant="outline">
                  {chat?.allow_member_invite ? 'Member boleh invite' : 'Hanya admin bisa invite'}
                </Badge>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold">Kode Undangan</p>
                <div className="mt-2 flex items-center gap-2">
                  <Input value={chat?.invite_code || '-'} readOnly className="border-border bg-card text-foreground" />
                  <Button variant="outline" className="border-border bg-transparent text-foreground/90 hover:bg-muted/60" onClick={() => void handleCopyInviteCode()}>
                    <Copy className="h-4 w-4" />
                    Salin
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Anggota Grup</p>
                  <Badge variant="secondary">{activeMembers.length} orang</Badge>
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                  {activeMembers.map((member) => {
                    const memberName =
                      member.profile?.full_name ||
                      (member.user_id === user?.id ? 'Anda' : member.user_id);

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={member.profile?.avatar_url}
                            alt={member.profile?.full_name || member.user_id}
                          />
                          <AvatarFallback>{getInitials(member.profile?.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{memberName}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.user_id}</p>
                        </div>
                        <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {canModerateJoinRequests && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Permintaan Bergabung</p>
                      {isJoinRequestsLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {joinRequests.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                        Belum ada permintaan yang menunggu persetujuan.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {joinRequests.map((request) => {
                          const isActing = activeJoinRequestId === request.id;
                          return (
                            <div
                              key={request.id}
                              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={request.profile?.avatar_url}
                                  alt={request.profile?.full_name || request.user_id}
                                />
                                <AvatarFallback>{getInitials(request.profile?.full_name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {request.profile?.full_name || request.user_id}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {request.user_id}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border bg-transparent text-foreground/90 hover:bg-muted/60"
                                disabled={isActing}
                                onClick={() =>
                                  void handleModerateJoinRequest(request.id, 'reject')
                                }
                              >
                                {isActing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-accent text-white hover:bg-accent/90"
                                disabled={isActing}
                                onClick={() =>
                                  void handleModerateJoinRequest(request.id, 'approve')
                                }
                              >
                                {isActing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-border bg-transparent text-foreground/90 hover:bg-muted/60" onClick={() => setIsGroupInfoOpen(false)}>
                Tutup
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleLeaveGroup()}
                disabled={isLeavingChat}
              >
                {isLeavingChat ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Keluar Grup
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
