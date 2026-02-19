// App Header Component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Compass, Home, MessageCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const centerNavItems = [
  { href: '/home', icon: Home, label: 'Beranda' },
  { href: '/radar', icon: Compass, label: 'Radar' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
];

export function AppHeader() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { openNotifications, openCreatePost, openSearch } = useUIStore();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  if (!user) {
    return null;
  }

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-md',
        isChatRoute
          ? 'border-border bg-card/95 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
          : 'border-border/80 bg-background/95 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/home" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg signature-gradient text-sm font-bold text-white shadow">
              M
            </div>
            <span className={cn('hidden text-base font-bold tracking-tight sm:inline', isChatRoute && 'text-foreground')}>
              MyCatholic
            </span>
          </Link>
          <div className="relative hidden md:block">
            <Search
              className={cn(
                'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
                isChatRoute ? 'text-muted-foreground/80' : 'text-muted-foreground'
              )}
            />
            <Input
              readOnly
              onClick={openSearch}
              placeholder="Cari orang, post, komunitas..."
              className={cn(
                'h-10 w-[280px] rounded-xl pl-9 shadow-none transition-colors focus-visible:ring-primary/30 xl:w-[340px]',
                isChatRoute
                  ? 'border-border bg-card text-foreground placeholder:text-muted-foreground/80'
                  : 'border-border bg-card/70 placeholder:text-muted-foreground/80'
              )}
            />
          </div>
        </div>

        <nav className="hidden items-center gap-1 rounded-2xl border border-border bg-card/70 p-1 lg:flex">
          {centerNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-[108px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? isChatRoute
                      ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(155,96,245,0.35)]'
                      : 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(31,93,140,0.35)]'
                    : isChatRoute
                      ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreatePost}
            className={cn(
              'hidden h-10 rounded-xl border border-border bg-card px-4 font-semibold text-foreground hover:bg-muted/50 sm:inline-flex',
              isChatRoute ? 'bg-muted/40 hover:bg-muted/60' : ''
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Buat
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={openCreatePost}
            className={cn(
              'h-10 w-10 rounded-xl border border-border bg-card text-foreground hover:bg-muted/50 sm:hidden',
              isChatRoute && 'bg-muted/40 hover:bg-muted/60'
            )}
          >
            <Plus className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={openNotifications}
            className={cn(
              'h-10 w-10 rounded-xl border border-border',
              isChatRoute
                ? 'bg-muted/40 text-foreground hover:bg-muted/60'
                : 'bg-card text-foreground hover:bg-muted/50'
            )}
          >
            <Bell className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn('relative h-10 w-10 rounded-xl border border-border bg-card p-0 hover:bg-muted/50', isChatRoute && 'hover:bg-muted/60')}
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn('w-56', isChatRoute && 'border-border bg-card text-foreground')}>
              <div className="p-2">
                <p className="text-sm font-semibold">{profile?.full_name || user.email}</p>
                {profile?.role && (
                  <p className={cn('text-xs capitalize', isChatRoute ? 'text-muted-foreground' : 'text-muted-foreground')}>{profile.role}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Pengaturan</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
