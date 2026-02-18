'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  BellOff,
  ChevronDown,
  Loader2,
  MessageCircle,
  Pin,
  Search,
  SquarePen,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useChats, useSetChatArchived } from '@/lib/features/chat/use-chat';
import { useAuthStore } from '@/lib/store/auth-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatGroupActionsDialog } from '@/components/chat/chat-group-actions-dialog';
import { cn } from '@/lib/utils';

type ChatFilter = 'all' | 'unread' | 'groups' | 'archived';

interface ChatInboxPanelProps {
  className?: string;
  selectedChatId?: string;
}

export function ChatInboxPanel({ className, selectedChatId }: ChatInboxPanelProps) {
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [chatQuery, setChatQuery] = useState('');
  const [archivingChatId, setArchivingChatId] = useState<string | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const { profile } = useAuthStore();
  const { mutateAsync: setChatArchived } = useSetChatArchived();
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useChats({ filter });

  const chats = useMemo(() => data?.pages.flatMap((page) => page.chats) ?? [], [data]);
  const accountLabel = profile?.full_name?.split(' ')[0] || 'Messages';
  const normalizedQuery = chatQuery.trim().toLowerCase();
  const visibleChats = useMemo(() => {
    if (!normalizedQuery) {
      return chats;
    }

    return chats.filter((chat) => {
      const displayName = chat.group_name || (chat.is_group ? 'Grup Tanpa Nama' : 'Kontak');
      const haystacks = [displayName, chat.last_message, chat.invite_mode]
        .filter(Boolean)
        .map((value) => value!.toString().toLowerCase());

      return haystacks.some((value) => value.includes(normalizedQuery));
    });
  }, [chats, normalizedQuery]);

  const handleToggleArchive = async (chatId: string, archived: boolean) => {
    setArchivingChatId(chatId);
    try {
      await setChatArchived({ chatId, archived });
    } finally {
      setArchivingChatId(null);
    }
  };

  return (
    <section
      className={cn(
        'flex h-full min-h-0 touch-pan-y flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground',
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-5 pb-3 pt-5">
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{accountLabel}</h1>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-foreground/80 hover:bg-muted/60 hover:text-foreground"
          onClick={() => setIsGroupDialogOpen(true)}
          aria-label="Tulis pesan baru"
        >
          <SquarePen className="h-5 w-5" />
        </Button>
      </header>

      <div className="border-b border-border px-4 pb-2 pt-2">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as ChatFilter)}>
          <TabsList className="h-auto w-full justify-start gap-5 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="h-auto rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 text-sm font-semibold text-muted-foreground/80 data-[state=active]:border-border data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              Primary
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              className="h-auto rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 text-sm font-semibold text-muted-foreground/80 data-[state=active]:border-border data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              General
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="h-auto rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 text-sm font-semibold text-muted-foreground/80 data-[state=active]:border-border data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              Requests
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="h-auto rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 text-sm font-semibold text-muted-foreground/80 data-[state=active]:border-border data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            value={chatQuery}
            onChange={(event) => setChatQuery(event.target.value)}
            placeholder="Search"
            className="h-9 rounded-xl border border-border bg-card pl-9 text-sm text-foreground/90 placeholder:text-muted-foreground/80 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
        {isLoading ? (
          <Card className="m-4 flex items-center justify-center gap-2 border-border bg-card p-8 text-sm text-muted-foreground shadow-none">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat percakapan...
          </Card>
        ) : visibleChats.length === 0 ? (
          <Card className="m-4 border-border bg-card p-8 text-center shadow-none">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              {normalizedQuery ? (
                <Search className="h-6 w-6 text-muted-foreground" />
              ) : filter === 'groups' ? (
                <Users className="h-6 w-6 text-muted-foreground" />
              ) : filter === 'archived' ? (
                <Archive className="h-6 w-6 text-muted-foreground" />
              ) : (
                <MessageCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground">Belum ada percakapan</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {normalizedQuery
                ? 'Tidak ada chat yang cocok dengan kata kunci.'
                : filter === 'groups'
                  ? 'Anda belum tergabung dalam grup.'
                  : filter === 'archived'
                    ? 'Belum ada chat yang diarsipkan.'
                    : 'Mulai percakapan baru dari profil pengguna.'}
            </p>
          </Card>
        ) : (
          <div className="divide-y divide-border">
            {visibleChats.map((chat) => (
              <ChatTile
                key={chat.id}
                chat={chat}
                isActive={selectedChatId === chat.id}
                isArchiving={archivingChatId === chat.id}
                onToggleArchive={handleToggleArchive}
              />
            ))}

            {hasNextPage && !normalizedQuery && (
              <div className="flex justify-center p-3">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-full border-border bg-transparent text-foreground/90 hover:bg-muted/60"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memuat...
                    </>
                  ) : (
                    'Muat lebih banyak'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatGroupActionsDialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen} />
    </section>
  );
}

function ChatTile({
  chat,
  isActive,
  isArchiving,
  onToggleArchive,
}: {
  chat: {
    id: string;
    group_name?: string;
    group_avatar_url?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
    is_archived?: boolean;
    is_pinned?: boolean;
    is_muted?: boolean;
    is_group: boolean;
  };
  isActive: boolean;
  isArchiving: boolean;
  onToggleArchive: (chatId: string, archived: boolean) => Promise<void>;
}) {
  const displayName = chat.group_name || (chat.is_group ? 'Grup Tanpa Nama' : 'Kontak');
  const initials = displayName.slice(0, 2).toUpperCase();
  const hasUnread = (chat.unread_count ?? 0) > 0;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2',
        isActive ? 'bg-muted/60' : 'hover:bg-muted/40'
      )}
    >
      <Link
        href={`/chat/${chat.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1"
        aria-current={isActive ? 'page' : undefined}
      >
        <Avatar className="h-12 w-12 border border-border">
          <AvatarImage src={chat.group_avatar_url} alt={displayName} />
          <AvatarFallback className="bg-card text-xs text-foreground/80">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm text-foreground/80', hasUnread && 'font-semibold text-foreground')}>
              {displayName}
            </p>
            <p className="shrink-0 text-[11px] text-muted-foreground/80">
              {chat.last_message_at
                ? formatDistanceToNow(new Date(chat.last_message_at), {
                    addSuffix: false,
                  }).replace('about ', '')
                : ''}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className={cn('truncate text-xs text-muted-foreground/80', hasUnread && 'font-semibold text-foreground/80')}>
                {chat.last_message || 'Mulai percakapan'}
              </p>
              {chat.is_pinned && <Pin className="h-3 w-3 rotate-45 text-muted-foreground/80" />}
              {chat.is_muted && <BellOff className="h-3 w-3 text-muted-foreground/80" />}
            </div>
            {hasUnread && <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-ring" />}
          </div>
        </div>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground/80 opacity-0 transition-opacity hover:bg-muted/60 hover:text-foreground/90 group-hover:opacity-100"
        disabled={isArchiving}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onToggleArchive(chat.id, !chat.is_archived);
        }}
        aria-label={chat.is_archived ? 'Keluarkan dari arsip' : 'Arsipkan chat'}
      >
        {isArchiving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : chat.is_archived ? (
          <ArchiveRestore className="h-4 w-4" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
