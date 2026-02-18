// Following Page

'use client';

import { useParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useFollows } from '@/lib/features/profile/use-profile';

export default function FollowingPage() {
  const params = useParams<{ id: string }>();
  const userId = decodeURIComponent(params.id);
  const { following, isLoading } = useFollows(userId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Following</h1>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Memuat following...</Card>
      ) : following.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Belum mengikuti siapa pun.</Card>
      ) : (
        following.map((item: any) => {
          const profile = item.following || item.following_profile || {};
          const name = profile.full_name || 'User';

          return (
            <Card key={item.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url} alt={name} />
                <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{profile.role || 'umat'}</p>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
