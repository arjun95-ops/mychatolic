// Search Panel

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { ChatService } from '@/lib/features/chat/chat-service';
import { useCreateChat } from '@/lib/features/chat/use-chat';
import { useUIStore } from '@/lib/store/ui-store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function SearchPanel() {
  const { isSearchOpen } = useUIStore();
  if (!isSearchOpen) return null;
  return <SearchPanelContent />;
}

function SearchPanelContent() {
  const router = useRouter();
  const { closeSearch } = useUIStore();
  const { mutateAsync: createChat, isPending: isCreatingChat } = useCreateChat();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['search-users', debouncedKeyword],
    queryFn: () => ChatService.searchUsers(debouncedKeyword),
    enabled: debouncedKeyword.length >= 2,
  });

  const emptyMessage = useMemo(() => {
    if (debouncedKeyword.length < 2) return 'Ketik minimal 2 karakter untuk mulai mencari.';
    if (isLoading) return 'Mencari pengguna...';
    if (users.length === 0) return 'Tidak ada pengguna yang cocok.';
    return null;
  }, [debouncedKeyword.length, isLoading, users.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
      <Card className="w-full max-w-xl border-border/70 bg-card shadow-xl">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Cari nama user..."
                className="pl-9"
                autoFocus
              />
            </div>
            <Button variant="ghost" size="icon" onClick={closeSearch}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {emptyMessage ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {emptyMessage}
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-border/70 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  onClick={async () => {
                    const chat = await createChat({ otherUserId: user.id });
                    closeSearch();
                    router.push(`/chat/${chat.id}`);
                  }}
                  disabled={isCreatingChat}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url} alt={user.full_name || ''} />
                    <AvatarFallback>
                      {user.full_name
                        ?.split(' ')
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user.full_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user.role || 'umat'}</p>
                  </div>
                  {isCreatingChat && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
