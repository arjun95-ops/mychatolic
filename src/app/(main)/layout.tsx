// Main Layout for Authenticated Routes

'use client';

import { AppHeader } from '@/components/layout/app-header';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useAuth } from '@/lib/features/auth/use-auth';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isInitialized, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    if (profile?.profile_filled !== false) return;
    if (pathname === '/profile/edit') return;
    router.push('/profile/edit');
  }, [isInitialized, isAuthenticated, profile?.profile_filled, pathname, router]);

  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="pt-0">
        <DesktopSidebar />

        <main
          className={cn(
            isChatRoute ? 'lg:pl-20' : 'lg:pl-72',
            isChatRoute ? 'h-[calc(100dvh-4rem)] overflow-hidden' : 'min-h-[calc(100dvh-4rem)]'
          )}
        >
          <div
            className={cn(
              'mx-auto max-w-[1320px] px-4 lg:px-6',
              isChatRoute ? 'h-full py-2 pb-20 lg:py-3 lg:pb-3' : 'py-5 pb-24 lg:pb-8'
            )}
          >
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
