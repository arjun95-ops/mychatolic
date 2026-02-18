// Home / Feed Page

'use client';

import { useState } from 'react';
import {
  Church,
  Globe,
  Landmark,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { PostCard } from '@/components/feed/post-card';
import { StoryRail } from '@/components/stories/story-rail';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePosts } from '@/lib/features/feed/use-posts';
import { InfiniteScroll } from '@/components/shared/infinite-scroll';
import { getProfileLocation } from '@/lib/features/profile/profile-status';
import { cn } from '@/lib/utils';

type ScopeKey = 'all' | 'country' | 'diocese' | 'parish';

type ScopeOption = {
  key: ScopeKey;
  label: string;
  description: string;
  icon: LucideIcon;
  scopeId?: string;
};

export default function HomePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { openCreatePost } = useUIStore();
  const location = getProfileLocation(profile);

  const scopeOptions: ScopeOption[] = [
    {
      key: 'all',
      label: 'All Feed',
      description: 'Semua postingan komunitas',
      icon: Globe,
    },
    ...(profile?.country_id
      ? [
          {
            key: 'country' as const,
            label: location.country || profile.country_text?.trim() || 'Country',
            description: 'Postingan satu negara',
            icon: Landmark,
            scopeId: profile.country_id,
          },
        ]
      : []),
    ...(profile?.diocese_id
      ? [
          {
            key: 'diocese' as const,
            label: location.diocese || profile.diocese_text?.trim() || 'Diocese',
            description: 'Postingan satu keuskupan',
            icon: Church,
            scopeId: profile.diocese_id,
          },
        ]
      : []),
    ...(profile?.church_id
      ? [
          {
            key: 'parish' as const,
            label: location.parish || profile.parish_text?.trim() || 'Parish',
            description: 'Postingan satu paroki',
            icon: Sparkles,
            scopeId: profile.church_id,
          },
        ]
      : []),
  ];

  const [scopeKey, setScopeKey] = useState<ScopeKey>('all');
  const resolvedScopeKey = scopeOptions.some((option) => option.key === scopeKey) ? scopeKey : 'all';
  const activeScope = scopeOptions.find((option) => option.key === resolvedScopeKey) ?? scopeOptions[0];
  const postQueryParams =
    activeScope.key === 'all'
      ? undefined
      : {
          scope: activeScope.key,
          scopeId: activeScope.scopeId,
        };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePosts(postQueryParams);

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const initials =
    profile?.full_name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';

  return (
    <section className="mx-auto w-full max-w-[860px] space-y-3 sm:space-y-4">
      <Card className="overflow-hidden border-border bg-card">
        <CardContent className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Stories</h2>
            <span className="text-xs text-muted-foreground">24 jam terakhir</span>
          </div>
          <StoryRail />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0 border border-border">
                <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={openCreatePost}
                className="h-11 w-full rounded-full border border-border bg-muted/25 px-4 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/45"
              >
                Apa yang sedang kamu pikirkan hari ini?
              </button>
            </div>
            <Button onClick={openCreatePost} className="h-11 w-full shrink-0 rounded-full px-6 sm:w-auto">
              Buat postingan
            </Button>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Filter feed sinkron dengan aplikasi mobile
            </div>
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = resolvedScopeKey === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setScopeKey(option.key)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                      isActive
                        ? 'border-primary/60 bg-primary/12 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{activeScope.description}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => <PostCardSkeleton key={index} />)
        ) : posts.length === 0 ? (
          <Card className="border-border bg-card p-8 text-center sm:p-12">
            <div className="mb-3 text-4xl">🕊️</div>
            <h3 className="text-lg font-semibold">Feed masih kosong</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Belum ada posting untuk scope <span className="font-semibold">{activeScope.label}</span>.
            </p>
            <Button onClick={openCreatePost} className="mt-4 w-full rounded-full px-6 sm:w-auto">
              Buat Postingan
            </Button>
          </Card>
        ) : (
          <>
            <InfiniteScroll
              hasMore={hasNextPage || false}
              loadMore={async () => {
                await fetchNextPage();
              }}
              isLoading={isFetchingNextPage}
            >
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => router.push(`/post/${post.id}`)}
                />
              ))}
            </InfiniteScroll>

            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="px-4 pb-3">
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-72 w-full" />
        <div className="p-4">
          <Skeleton className="h-4 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
