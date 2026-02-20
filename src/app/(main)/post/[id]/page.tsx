// Post Detail Page

'use client';

import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { usePost } from '@/lib/features/feed/use-posts';
import { PostCard } from '@/components/feed/post-card';
import { Card } from '@/components/ui/card';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = decodeURIComponent(params.id);
  const { data: post, isLoading } = usePost(postId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Post</h1>

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat post...
        </Card>
      ) : !post ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Post tidak ditemukan.
        </Card>
      ) : (
        <PostCard post={post} showFullImage initialCommentsOpen />
      )}
    </div>
  );
}
