// Bottom Navigation Component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BookOpen, Radar, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home', icon: Home, label: 'Beranda' },
  { href: '/schedule', icon: Calendar, label: 'Jadwal' },
  { href: '/bible', icon: BookOpen, label: 'Alkitab' },
  { href: '/radar', icon: Radar, label: 'Radar' },
  { href: '/chat', icon: MessageSquare, label: 'Pesan' },
  { href: '/profile', icon: User, label: 'Profil' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.35rem)' }}
    >
      <div className="mx-auto grid h-[68px] w-full max-w-[680px] grid-cols-6 items-center gap-1 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1 text-[10px] font-medium transition-colors',
                isActive
                  ? 'border-primary/35 bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="max-w-full truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
