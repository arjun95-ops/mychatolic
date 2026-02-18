// Notification Panel Component

'use client';

import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Bell, Heart, Loader2, MessageSquare, UserPlus, X } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/features/notifications/use-notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

function getNotificationIcon(type: Notification['type']) {
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

export function NotificationPanel() {
  const { isNotificationsOpen, closeNotifications } = useUIStore();
  const { data: notifications = [], isLoading } = useNotifications(30);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
  const { mutate: removeNotification } = useDeleteNotification();

  if (!isNotificationsOpen) return null;

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="w-full max-w-lg overflow-hidden border-border/70 bg-card shadow-lg">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">Notifikasi</h2>
              <p className="text-xs text-muted-foreground">{unreadCount} belum dibaca</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead()}
                disabled={isMarkingAll || unreadCount === 0}
                className="text-xs"
              >
                {isMarkingAll ? 'Memproses...' : 'Tandai semua dibaca'}
              </Button>
              <Button variant="ghost" size="icon" onClick={closeNotifications}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat notifikasi...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40',
                    !notification.is_read && 'bg-primary/10'
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={notification.sender?.avatar_url} alt={notification.sender?.full_name || ''} />
                    <AvatarFallback>
                      {notification.sender?.full_name
                        ?.split(' ')
                        .map((chunk) => chunk[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'NT'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {getNotificationIcon(notification.type)}
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
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeNotification(notification.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
