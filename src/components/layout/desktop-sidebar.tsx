// Desktop Sidebar Component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpen,
  Calendar,
  Compass,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home', icon: Home, label: 'Feed' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/radar', icon: Compass, label: 'Radar Misa' },
  { href: '/schedule', icon: Calendar, label: 'Jadwal' },
  { href: '/bible', icon: BookOpen, label: 'Alkitab' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { openCreatePost, openNotifications, openSearch } = useUIStore();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';

  if (isChatRoute) {
    const compactLinks = [
      { href: '/home', icon: Home, label: 'Beranda' },
      { href: '/radar', icon: Compass, label: 'Explore' },
      { href: '/chat', icon: MessageCircle, label: 'Chat' },
      { href: '/schedule', icon: Calendar, label: 'Jadwal' },
      { href: '/bible', icon: BookOpen, label: 'Alkitab' },
    ];

    const compactActions = [
      { icon: Search, label: 'Cari', onClick: openSearch },
      { icon: Bell, label: 'Notifikasi', onClick: openNotifications },
      { icon: Plus, label: 'Buat', onClick: openCreatePost },
    ];

    return (
      <aside className="fixed bottom-0 left-0 top-16 hidden w-20 border-r border-border bg-card/95 px-3 py-4 backdrop-blur-md lg:flex lg:flex-col">
        <Link
          href="/home"
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl signature-gradient text-sm font-bold text-white shadow transition-all duration-200 ease-out hover:scale-[1.04] hover:shadow-[0_10px_28px_rgba(155,96,245,0.45)] active:scale-[0.98]"
          aria-label="Kembali ke beranda"
        >
          M
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {compactLinks.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ease-out hover:scale-[1.04] active:scale-[0.97]',
                      isActive
                        ? 'bg-accent/20 text-accent shadow-[0_0_0_1px_rgba(216,194,255,0.32),0_10px_24px_rgba(155,96,245,0.32)]'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:shadow-[0_10px_24px_rgba(0,0,0,0.28)]'
                    )}
                    aria-label={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="[--tooltip-bg:var(--card)] border border-border text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}

          <div className="my-1 h-px w-8 bg-muted/60" />

          {compactActions.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={item.onClick}
                    className="h-11 w-11 rounded-2xl text-muted-foreground transition-all duration-200 ease-out hover:scale-[1.04] hover:bg-muted/60 hover:text-foreground hover:shadow-[0_10px_24px_rgba(0,0,0,0.28)] active:scale-[0.97]"
                    aria-label={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="[--tooltip-bg:var(--card)] border border-border text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mt-2 flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/profile"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card transition-all duration-200 ease-out hover:scale-[1.04] hover:bg-muted/60 hover:shadow-[0_10px_24px_rgba(0,0,0,0.32)] active:scale-[0.97]"
                aria-label="Buka profil"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
                  <AvatarFallback className="bg-card text-[11px] text-foreground/90">{initials}</AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="[--tooltip-bg:var(--card)] border border-border text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              Profile
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-200 ease-out hover:scale-[1.04] hover:bg-muted/60 hover:text-foreground hover:shadow-[0_10px_24px_rgba(0,0,0,0.28)] active:scale-[0.97]"
                aria-label="More"
              >
                <Menu className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="[--tooltip-bg:var(--card)] border border-border text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              More
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed bottom-0 left-0 top-16 hidden w-72 border-r border-border bg-card/90 px-4 py-4 backdrop-blur-md lg:flex lg:flex-col">
      <div className="mb-4 rounded-2xl border border-border bg-card/95 p-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
        <Link href="/profile" className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-bold">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'umat'}</p>
          </div>
        </Link>
        <Button
          onClick={openCreatePost}
          className="mt-3 h-10 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Buat Postingan
        </Button>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
