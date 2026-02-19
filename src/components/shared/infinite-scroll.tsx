// Infinite Scroll Component

'use client';

import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollProps {
  children: React.ReactNode;
  hasMore: boolean;
  loadMore: () => void | Promise<void>;
  isLoading?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export function InfiniteScroll({
  children,
  hasMore,
  loadMore,
  isLoading = false,
  threshold = 200,
  rootMargin,
}: InfiniteScrollProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const effectiveRootMargin = rootMargin ?? `0px 0px ${Math.max(0, threshold)}px 0px`;

  useEffect(() => {
    if (!hasMore || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore) {
          loadMore();
        }
      },
      {
        rootMargin: effectiveRootMargin,
        threshold: 0,
      }
    );

    observerRef.current = observer;

    const trigger = triggerRef.current;
    if (trigger) {
      observer.observe(trigger);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [hasMore, isLoading, effectiveRootMargin, loadMore]);

  return (
    <div className="space-y-4">
      {children}
      
      {/* Loading trigger */}
      {(hasMore || isLoading) && (
        <div
          ref={triggerRef}
          className="flex justify-center py-4"
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <p className="text-sm text-muted-foreground">Scroll to load more...</p>
          )}
        </div>
      )}
    </div>
  );
}
