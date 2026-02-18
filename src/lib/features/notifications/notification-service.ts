// Notifications Service

import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/lib/types';
import { createRandomUUID } from '@/lib/utils';

function isMissingColumnError(message: string, column: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes(column.toLowerCase()) &&
    (lower.includes('does not exist') || lower.includes('42703'))
  );
}

function describeError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {
      code: '',
      message: typeof error === 'string' ? error : '',
      details: '',
      normalized: typeof error === 'string' ? error : 'Unknown error',
    };
  }

  const candidate = error as Record<string, unknown>;
  const code = candidate.code?.toString() ?? '';
  const message = candidate.message?.toString() ?? '';
  const details = candidate.details?.toString() ?? '';
  const normalized = [code, message, details].filter(Boolean).join(' | ') || 'Unknown error';

  return { code, message, details, normalized };
}

function isMissingRelationError(error: unknown, relation: string) {
  const { code, message, details } = describeError(error);
  const lower = `${code} ${message} ${details}`.toLowerCase();
  return (
    lower.includes('could not find a relationship') &&
    lower.includes(relation.toLowerCase())
  );
}

function normalizeSupabaseError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return describeError(error).normalized;
}

function mapNotificationRow(row: Record<string, unknown>): Notification {
  const senderRow =
    (row.sender as Record<string, unknown> | null) ||
    (row.actor as Record<string, unknown> | null) ||
    (row.profiles as Record<string, unknown> | null);

  const typeValue = row.type?.toString() || 'mention';

  const allowedTypes: Notification['type'][] = [
    'follow',
    'like',
    'comment',
    'mention',
    'radar_invite',
    'mass_invite',
    'chat_message',
    'story_reaction',
  ];

  const type = allowedTypes.includes(typeValue as Notification['type'])
    ? (typeValue as Notification['type'])
    : 'mention';

  const title =
    row.title?.toString() ||
    row.subject?.toString() ||
    row.notification_title?.toString() ||
    'Notifikasi';
  const message =
    row.message?.toString() ||
    row.body?.toString() ||
    row.content?.toString() ||
    '';

  return {
    id: row.id?.toString() ?? createRandomUUID(),
    user_id: row.user_id?.toString() ?? '',
    type,
    title,
    message,
    data: (row.data as Record<string, unknown>) ?? {},
    is_read: typeof row.is_read === 'boolean' ? row.is_read : Boolean(row.read_at),
    created_at: row.created_at?.toString() ?? new Date().toISOString(),
    sender: senderRow
      ? {
          id: senderRow.id?.toString() ?? '',
          full_name: senderRow.full_name?.toString(),
          avatar_url: senderRow.avatar_url?.toString(),
          role: senderRow.role?.toString(),
        }
      : undefined,
  };
}

export class NotificationService {
  static async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const primary = await supabase
      .from('notifications')
      .select(
        `
        *,
        sender:sender_id (id, full_name, avatar_url, role),
        actor:actor_id (id, full_name, avatar_url, role)
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    let data = primary.data as Record<string, unknown>[] | null;
    let error = primary.error;

    if (
      error &&
      (
        isMissingColumnError(error.message, 'sender_id') ||
        isMissingColumnError(error.message, 'actor_id') ||
        isMissingRelationError(error, 'sender_id') ||
        isMissingRelationError(error, 'actor_id')
      )
    ) {
      const fallbackByCreatedAt = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      data = fallbackByCreatedAt.data as Record<string, unknown>[] | null;
      error = fallbackByCreatedAt.error;
    }

    if (error && isMissingColumnError(error.message, 'created_at')) {
      const fallbackNoOrder = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .limit(limit);

      data = fallbackNoOrder.data as Record<string, unknown>[] | null;
      error = fallbackNoOrder.error;
    }

    if (error) {
      console.error('Error fetching notifications:', normalizeSupabaseError(error));
      return [];
    }

    return (data ?? []).map(mapNotificationRow);
  }

  static async markAsRead(notificationId: string) {
    const updateResult = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (updateResult.error && isMissingColumnError(updateResult.error.message, 'is_read')) {
      const fallback = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return;
    }

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  static async markAllAsRead(userId: string) {
    const updateResult = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (updateResult.error && isMissingColumnError(updateResult.error.message, 'is_read')) {
      const fallback = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return;
    }

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  static async deleteNotification(notificationId: string) {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) {
      throw new Error(error.message);
    }
  }
}
