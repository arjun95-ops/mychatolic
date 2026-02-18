// Notifications Page

'use client';

import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Bell, Heart, Loader2, MessageSquare, UserPlus, X } from 'lucide-react';
import { useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/features/notifications/use-notifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

function iconByType(type: Notification['type']) {
  switch (type) {
    case 'like':
      return <Heart className="h-4 w-4 text-destructive" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4 text-ring" />;
    case 'follow':
      return <UserPlus className="h-4 w-4 text-success" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications(100);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
  const { mutate: removeNotification } = useDeleteNotification();

  const unread = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">Notifikasi</h1>
          <p className="text-xs text-muted-foreground">{unread} belum dibaca</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isMarkingAll || unread === 0}
          onClick={() => markAllAsRead()}
        >
          {isMarkingAll ? 'Memproses...' : 'Tandai semua dibaca'}
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 border-border/70 bg-card p-10 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat notifikasi...
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="border-border/70 bg-card p-12 text-center shadow-sm">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">Tidak ada notifikasi</h3>
          <p className="mt-1 text-sm text-muted-foreground">Anda akan menerima notifikasi di halaman ini.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'flex items-start gap-3 border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40',
                !notification.is_read && 'bg-primary/10'
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={notification.sender?.avatar_url} alt={notification.sender?.full_name || ''} />
                <AvatarFallback>
                  {notification.sender?.full_name
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'NT'}
                </AvatarFallback>
              </Avatar>

              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  if (!notification.is_read) {
                    markAsRead(notification.id);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  {iconByType(notification.type)}
                  <p className="truncate text-sm font-semibold">
                    {notification.sender?.full_name || notification.title}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notification.message || notification.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: id,
                  })}
                </p>
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeNotification(notification.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
