// Chat Service

import { supabase } from '@/lib/supabase/client';
import { createRandomToken, createRandomUUID } from '@/lib/utils';
import type {
  ChatMember,
  ChatProfile,
  GroupJoinRequest,
  SocialChat,
  SocialMessage,
} from '@/lib/types';

type ChatFilter = 'all' | 'unread' | 'groups' | 'archived';

interface ChatMemberRow {
  chat_id: string;
  unread_count?: number | null;
  pinned_at?: string | null;
  archived_at?: string | null;
  muted_until?: string | null;
}

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(column.toLowerCase()) &&
    (normalized.includes('does not exist') || normalized.includes('42703'))
  );
}

function isMissingObjectError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('42p01') ||
    normalized.includes('could not find')
  );
}

function asStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => item?.toString()).filter((item): item is string => Boolean(item));
  }
  return [];
}

function escapePostgrestLike(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll(',', '\\,');
}

function isMutedActive(mutedUntil?: string | null) {
  if (!mutedUntil) return false;
  const mutedUntilTime = new Date(mutedUntil).getTime();
  if (!Number.isFinite(mutedUntilTime)) return false;
  return mutedUntilTime > Date.now();
}

const MESSAGE_INSERT_SELECT_COLUMNS = [
  'id',
  'chat_id',
  'sender_id',
  'content',
  'message_type',
  'type',
  'media_url',
  'file_name',
  'file_size',
  'reply_to_id',
  'reactions',
  'created_at',
].join(',');

function toChatProfile(input: unknown): ChatProfile | undefined {
  const row = input as Record<string, unknown> | null;
  if (!row?.id) {
    return undefined;
  }

  return {
    id: row.id.toString(),
    full_name: row.full_name?.toString(),
    avatar_url: row.avatar_url?.toString(),
    role: row.role?.toString(),
  };
}

function mapMessageRow(row: Record<string, unknown>): SocialMessage {
  const sender = toChatProfile(row.profiles ?? row.sender);
  const createdAt = row.created_at?.toString() ?? new Date().toISOString();
  const rawType = row.message_type ?? row.type ?? 'text';

  return {
    id: row.id?.toString() ?? createRandomUUID(),
    chat_id: row.chat_id?.toString() ?? '',
    sender_id: row.sender_id?.toString() ?? '',
    content: row.content?.toString(),
    message_type: rawType.toString() as SocialMessage['message_type'],
    media_url: row.media_url?.toString(),
    file_name: row.file_name?.toString(),
    file_size: typeof row.file_size === 'number' ? row.file_size : undefined,
    reply_to_id: row.reply_to_id?.toString(),
    reactions: (row.reactions as Record<string, string[]>) ?? {},
    created_at: createdAt,
    updated_at: row.updated_at?.toString() ?? createdAt,
    sender,
  };
}

function mapChatRow(
  row: Record<string, unknown>,
  member?: ChatMemberRow,
  directChatProfile?: ChatProfile
): SocialChat {
  const isGroup = row.is_group === true;
  const participants = asStringArray(row.participants);
  const createdAt = row.created_at?.toString() ?? new Date().toISOString();
  const updatedAt = row.updated_at?.toString() ?? createdAt;

  return {
    id: row.id?.toString() ?? createRandomUUID(),
    is_group: isGroup,
    group_name: isGroup ? row.group_name?.toString() : directChatProfile?.full_name,
    group_avatar_url: isGroup ? row.group_avatar_url?.toString() : directChatProfile?.avatar_url,
    admin_id: row.admin_id?.toString(),
    creator_id: row.creator_id?.toString(),
    participants,
    last_message: row.last_message?.toString(),
    last_message_at: row.last_message_at?.toString(),
    last_message_sender_id: row.last_message_sender_id?.toString(),
    chat_room_id: row.chat_room_id?.toString(),
    allow_member_invite:
      typeof row.allow_member_invite === 'boolean' ? row.allow_member_invite : undefined,
    invite_mode: (row.invite_mode?.toString() as SocialChat['invite_mode']) || 'open',
    invite_code: row.invite_code?.toString(),
    invite_link_enabled: row.invite_link_enabled !== false,
    invite_link_expires_at: row.invite_link_expires_at?.toString(),
    created_at: createdAt,
    updated_at: updatedAt,
    unread_count: member?.unread_count ?? 0,
    is_pinned: Boolean(member?.pinned_at),
    is_muted: isMutedActive(member?.muted_until),
    is_archived: Boolean(member?.archived_at),
  };
}

export class ChatService {
  // Get user's chats with metadata
  static async getChats(params: {
    userId: string;
    page?: number;
    limit?: number;
    filter?: ChatFilter;
  }): Promise<{ chats: SocialChat[]; hasMore: boolean }> {
    const { userId, page = 1, limit = 20, filter = 'all' } = params;
    const fromRange = (page - 1) * limit;
    const toRange = page * limit;

    const inbox = await this.getChatsFromInboxRpc(userId, page, limit, filter);
    if (inbox) {
      return inbox;
    }

    const memberRows = await this.getMemberRows(userId);
    if (memberRows.length === 0) {
      return { chats: [], hasMore: false };
    }

    const scopedMembers =
      filter === 'archived'
        ? memberRows.filter((member) => Boolean(member.archived_at))
        : memberRows.filter((member) => !member.archived_at);

    const chatIds = scopedMembers.map((member) => member.chat_id);
    if (chatIds.length === 0) {
      return { chats: [], hasMore: false };
    }

    const { data: chatsData, error: chatsError } = await supabase
      .from('social_chats')
      .select('*')
      .in('id', chatIds)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (chatsError) {
      console.error('Error fetching chats:', chatsError);
      return { chats: [], hasMore: false };
    }

    const chatsById = new Map<string, Record<string, unknown>>();
    const directChatIds: string[] = [];
    const directChatPartnerById = new Map<string, string>();

    for (const row of (chatsData ?? []) as Record<string, unknown>[]) {
      const chatId = row.id?.toString();
      if (!chatId) continue;
      chatsById.set(chatId, row);

      if (row.is_group !== true) {
        directChatIds.push(chatId);
        const participantId = asStringArray(row.participants).find((id) => id !== userId);
        if (participantId) {
          directChatPartnerById.set(chatId, participantId);
        }
      }
    }

    if (directChatIds.length > 0) {
      await this.fillMissingDirectPartners(userId, directChatIds, directChatPartnerById);
    }

    const partnerProfiles = await this.getProfilesByIds([
      ...new Set(Array.from(directChatPartnerById.values())),
    ]);

    const mapped = scopedMembers
      .map((member) => {
        const row = chatsById.get(member.chat_id);
        if (!row) return null;

        const partnerId = directChatPartnerById.get(member.chat_id);
        const partnerProfile = partnerId ? partnerProfiles.get(partnerId) : undefined;

        return mapChatRow(row, member, partnerProfile);
      })
      .filter((chat): chat is SocialChat => Boolean(chat))
      .filter((chat) => {
        if (filter === 'groups') {
          return chat.is_group;
        }
        if (filter === 'unread') {
          return (chat.unread_count ?? 0) > 0;
        }
        if (filter === 'archived') {
          return chat.is_archived;
        }
        return true;
      });

    const sortedChats = mapped.sort((a, b) => {
      const aPinned = Boolean(a.is_pinned);
      const bPinned = Boolean(b.is_pinned);
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }

      const aTime = new Date(a.last_message_at ?? a.updated_at).getTime();
      const bTime = new Date(b.last_message_at ?? b.updated_at).getTime();
      return bTime - aTime;
    });

    const pagedChats = sortedChats.slice(fromRange, toRange);
    return {
      chats: pagedChats,
      hasMore: sortedChats.length > toRange,
    };
  }

  static async getChatWithMessages(chatId: string, beforeCreatedAt?: string) {
    const [chat, messages] = await Promise.all([
      this.getChatById(chatId),
      this.getMessages(chatId, 1, 50, beforeCreatedAt),
    ]);

    return {
      chat,
      messages,
    };
  }

  // Create 1:1 chat
  static async createChat(userId: string, otherUserId: string): Promise<SocialChat> {
    const existingChatId = await this.findExistingDirectChat(userId, otherUserId);
    if (existingChatId) {
      const existingChat = await this.getChatById(existingChatId);
      if (existingChat) {
        return existingChat;
      }
    }

    const now = new Date().toISOString();
    const { data: chatRow, error } = await supabase
      .from('social_chats')
      .insert({
        is_group: false,
        admin_id: userId,
        creator_id: userId,
        participants: [userId, otherUserId],
        invite_mode: 'open',
        invite_link_enabled: false,
        last_message: null,
        last_message_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const chatId = chatRow.id?.toString();
    if (!chatId) {
      throw new Error('Gagal membuat chat');
    }

    await this.ensureMembers(chatId, [
      { userId, role: 'admin' },
      { userId: otherUserId, role: 'member' },
    ]);

    return mapChatRow(chatRow as Record<string, unknown>);
  }

  // Create group chat
  static async createGroup(
    userId: string,
    data: {
      groupName: string;
      avatarUrl?: string;
      memberIds: string[];
      inviteMode?: 'open' | 'approval' | 'admin_only';
      inviteCode?: string;
      allowMemberInvite?: boolean;
    }
  ): Promise<SocialChat> {
    const uniqueMembers = Array.from(new Set(data.memberIds.filter((id) => id && id !== userId)));
    const participants = [userId, ...uniqueMembers];

    const now = new Date().toISOString();
    const { data: chatRow, error } = await supabase
      .from('social_chats')
      .insert({
        is_group: true,
        group_name: data.groupName,
        group_avatar_url: data.avatarUrl,
        admin_id: userId,
        creator_id: userId,
        participants,
        invite_mode: data.inviteMode ?? 'open',
        invite_code: data.inviteCode ?? createRandomToken(12),
        invite_link_enabled: true,
        allow_member_invite: data.allowMemberInvite ?? true,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const chatId = chatRow.id?.toString();
    if (!chatId) {
      throw new Error('Gagal membuat grup');
    }

    await this.ensureMembers(chatId, [
      { userId, role: 'admin' },
      ...uniqueMembers.map((memberId) => ({ userId: memberId, role: 'member' as const })),
    ]);

    return mapChatRow(chatRow as Record<string, unknown>);
  }

  // Send message
  static async sendMessage(
    userId: string,
    data: {
      chatId: string;
      content?: string;
      imageUrl?: string;
      imageFile?: File;
      messageType: SocialMessage['message_type'];
      replyToId?: string;
    }
  ): Promise<SocialMessage> {
    let mediaUrl: string | undefined = data.imageUrl;

    if (data.imageFile) {
      mediaUrl = await this.uploadMedia(data.imageFile, 'chat-uploads', userId);
    }

    const now = new Date().toISOString();
    const insertedRow = await this.insertMessageWithFallback({
      chat_id: data.chatId,
      sender_id: userId,
      content: data.content ?? '',
      message_type: data.messageType,
      media_url: mediaUrl,
      file_name: data.imageFile?.name,
      file_size: data.imageFile?.size,
      reply_to_id: data.replyToId,
      created_at: now,
      updated_at: now,
    });

    await this.updateChatMetadata(data.chatId, data.content || '[Media]', now);
    return mapMessageRow(insertedRow);
  }

  // Get messages with pagination
  static async getMessages(
    chatId: string,
    page = 1,
    limit = 50,
    beforeCreatedAt?: string
  ): Promise<SocialMessage[]> {
    const fromRange = (page - 1) * limit;
    const toRange = page * limit - 1;

    let query = supabase
      .from('social_messages')
      .select(
        `
        *,
        profiles:sender_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `
      )
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (beforeCreatedAt) {
      query = query.lt('created_at', beforeCreatedAt);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map(mapMessageRow).reverse();
  }

  static async searchMessages(
    chatId: string,
    rawQuery: string,
    limit = 120
  ): Promise<SocialMessage[]> {
    const normalized = rawQuery.trim();
    if (normalized.length < 2) {
      return [];
    }

    const pattern = `%${escapePostgrestLike(normalized)}%`;
    const { data, error } = await supabase
      .from('social_messages')
      .select(
        `
        *,
        profiles:sender_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `
      )
      .eq('chat_id', chatId)
      .or(
        `content.ilike.${pattern},file_name.ilike.${pattern},message_type.ilike.${pattern}`
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error searching messages:', error);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map(mapMessageRow);
  }

  // Toggle message reaction
  static async toggleReaction(userId: string, messageId: string, reaction: string) {
    const { data: existingReaction } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .maybeSingle();

    if (existingReaction?.id) {
      await supabase.from('message_reactions').delete().eq('id', existingReaction.id);
      return;
    }

    await supabase.from('message_reactions').insert({
      message_id: messageId,
      user_id: userId,
      reaction,
      created_at: new Date().toISOString(),
    });
  }

  // Get message reactions grouped by emoji key
  static async getMessageReactions(messageId: string): Promise<Record<string, string[]>> {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('reaction, user_id')
      .eq('message_id', messageId);

    if (error) {
      if (isMissingObjectError(error.message)) {
        return {};
      }
      console.error('Error fetching message reactions:', error);
      return {};
    }

    const grouped: Record<string, string[]> = {};
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const reaction = row.reaction?.toString();
      const userId = row.user_id?.toString();
      if (!reaction || !userId) continue;
      if (!grouped[reaction]) {
        grouped[reaction] = [];
      }
      grouped[reaction].push(userId);
    }

    return grouped;
  }

  // Delete message
  static async deleteMessage(messageId: string) {
    const { error } = await supabase.from('social_messages').delete().eq('id', messageId);
    if (error) {
      throw new Error(error.message);
    }
  }

  // Mark messages as read
  static async markAsRead(userId: string, chatId: string) {
    const rpcResult = await supabase.rpc('mark_messages_as_read', {
      p_chat_id: chatId,
      p_message_ids: null,
    });

    if (!rpcResult.error) {
      return;
    }

    const now = new Date().toISOString();
    const withLastRead = await supabase
      .from('chat_members')
      .update({ last_read_at: now })
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (withLastRead.error && !isMissingColumnError(withLastRead.error.message, 'last_read_at')) {
      console.error('Error marking chat as read:', withLastRead.error);
    }
  }

  static async setChatArchived(userId: string, chatId: string, archived: boolean) {
    const payload = {
      archived_at: archived ? new Date().toISOString() : null,
    };

    const result = await supabase
      .from('chat_members')
      .update(payload)
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (result.error && isMissingColumnError(result.error.message, 'archived_at')) {
      const fallback = await supabase
        .from('chat_members')
        .update({
          status: archived ? 'LEFT' : 'JOINED',
        })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (fallback.error && !isMissingColumnError(fallback.error.message, 'status')) {
        throw new Error(fallback.error.message);
      }

      return;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  static async setChatPinned(userId: string, chatId: string, pinned: boolean) {
    const payload = {
      pinned_at: pinned ? new Date().toISOString() : null,
    };

    const result = await supabase
      .from('chat_members')
      .update(payload)
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (result.error && isMissingColumnError(result.error.message, 'pinned_at')) {
      // Legacy schema may not have pinning support.
      return;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  static async setChatMuted(userId: string, chatId: string, muted: boolean) {
    const payload = {
      muted_until: muted ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
    };

    const result = await supabase
      .from('chat_members')
      .update(payload)
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (result.error && isMissingColumnError(result.error.message, 'muted_until')) {
      // Legacy schema may not have mute support.
      return;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  // Get user's mutual follows (for friend search)
  static async getMutualFollows(userId: string): Promise<ChatProfile[]> {
    const [followingRes, followersRes] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('follows').select('follower_id').eq('following_id', userId),
    ]);

    if (followingRes.error || followersRes.error) {
      console.error('Error fetching mutual follows:', followingRes.error || followersRes.error);
      return [];
    }

    const followingIds = new Set(
      ((followingRes.data ?? []) as Record<string, unknown>[])
        .map((row) => row.following_id?.toString())
        .filter((id): id is string => Boolean(id))
    );
    const followerIds = new Set(
      ((followersRes.data ?? []) as Record<string, unknown>[])
        .map((row) => row.follower_id?.toString())
        .filter((id): id is string => Boolean(id))
    );

    const mutualIds = Array.from(followingIds).filter((id) => followerIds.has(id)).slice(0, 10);
    if (mutualIds.length === 0) {
      return [];
    }

    const profiles = await this.getProfilesByIds(mutualIds);
    return Array.from(profiles.values());
  }

  // Search users
  static async searchUsers(query: string): Promise<ChatProfile[]> {
    const keyword = query.trim();
    if (!keyword) {
      return [];
    }

    const escaped = keyword.replace(/[%_]/g, '\\$&');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .or(`full_name.ilike.%${escaped}%,baptism_name.ilike.%${escaped}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => toChatProfile(row))
      .filter((row): row is ChatProfile => Boolean(row));
  }

  // Join group via invite code/link
  static async joinGroup(userId: string, inviteCode: string): Promise<SocialChat | null> {
    const normalizedCode = inviteCode.trim();
    if (!normalizedCode) {
      throw new Error('Kode undangan tidak valid');
    }

    const inviteResult =
      (await this.tryJoinGroupRpc('join_group_by_invite', normalizedCode)) ??
      (await this.tryJoinGroupRpc('join_group_by_link', normalizedCode));

    if (inviteResult?.chat_id) {
      const chat = await this.getChatById(inviteResult.chat_id);
      if (chat) return chat;
    }

    const { data: chatRow, error } = await supabase
      .from('social_chats')
      .select('*')
      .eq('invite_code', normalizedCode)
      .eq('invite_link_enabled', true)
      .maybeSingle();

    if (error || !chatRow) {
      throw new Error('Kode undangan tidak ditemukan atau sudah tidak aktif');
    }

    await this.ensureMembers(chatRow.id.toString(), [{ userId, role: 'member' }]);
    return mapChatRow(chatRow as Record<string, unknown>);
  }

  // Get chat members
  static async getChatMembers(chatId: string): Promise<ChatMember[]> {
    const { data, error } = await supabase
      .from('chat_members')
      .select('*, profiles:user_id(id, full_name, avatar_url, role)')
      .eq('chat_id', chatId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat members:', error);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id?.toString() ?? `${row.chat_id?.toString()}:${row.user_id?.toString()}`,
      chat_id: row.chat_id?.toString() ?? chatId,
      user_id: row.user_id?.toString() ?? '',
      role: (row.role?.toString() as ChatMember['role']) || 'member',
      status: row.status?.toString() as ChatMember['status'],
      pinned_at: row.pinned_at?.toString(),
      archived_at: row.archived_at?.toString(),
      muted_until: row.muted_until?.toString(),
      last_read_at: row.last_read_at?.toString(),
      joined_at: row.joined_at?.toString() ?? new Date().toISOString(),
      left_at: row.left_at?.toString(),
      kicked_at: row.kicked_at?.toString(),
      profile: toChatProfile(row.profiles),
    }));
  }

  // Leave chat
  static async leaveChat(userId: string, chatId: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await supabase
      .from('chat_members')
      .update({
        status: 'LEFT',
        left_at: now,
      })
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (result.error && isMissingColumnError(result.error.message, 'status')) {
      const fallback = await supabase
        .from('chat_members')
        .update({
          left_at: now,
        })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  // Create group join request
  static async createJoinRequest(userId: string, chatId: string): Promise<void> {
    const { error } = await supabase.from('group_join_requests').insert({
      chat_id: chatId,
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  // Accept join request (Admin action)
  static async acceptJoinRequest(joinRequestId: string): Promise<void> {
    const { data: request, error } = await supabase
      .from('group_join_requests')
      .select('*')
      .eq('id', joinRequestId)
      .single();

    if (error || !request) {
      throw new Error(error?.message ?? 'Permintaan tidak ditemukan');
    }

    await this.ensureMembers(request.chat_id.toString(), [
      { userId: request.user_id.toString(), role: 'member' },
    ]);

    await supabase.from('group_join_requests').delete().eq('id', request.id);
  }

  // Reject join request (Admin action)
  static async rejectJoinRequest(joinRequestId: string) {
    const { error } = await supabase.from('group_join_requests').delete().eq('id', joinRequestId);
    if (error) {
      throw new Error(error.message);
    }
  }

  // Get pending join requests (Admin view)
  static async getJoinRequests(chatId: string): Promise<GroupJoinRequest[]> {
    const primary = await supabase
      .from('group_join_requests')
      .select(
        `
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `
      )
      .eq('chat_id', chatId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    let data = primary.data as Record<string, unknown>[] | null;
    let error = primary.error;

    if (error && isMissingObjectError(error.message)) {
      const fallback = await supabase
        .from('group_join_requests')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      data = fallback.data as Record<string, unknown>[] | null;
      error = fallback.error;
    }

    if (error) {
      console.error('Error fetching join requests:', error);
      return [];
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const userIds = rows
      .map((row) => row.user_id?.toString())
      .filter((userId): userId is string => Boolean(userId));
    const profilesById = await this.getProfilesByIds([...new Set(userIds)]);

    return rows.map((row) => ({
      id: row.id?.toString() ?? createRandomUUID(),
      chat_id: row.chat_id?.toString() ?? chatId,
      user_id: row.user_id?.toString() ?? '',
      status: (row.status?.toString() as GroupJoinRequest['status']) || 'pending',
      invited_by: row.invited_by?.toString(),
      created_at: row.created_at?.toString() ?? new Date().toISOString(),
      profile: toChatProfile(row.profiles) ?? profilesById.get(row.user_id?.toString() ?? ''),
    }));
  }

  private static async getChatsFromInboxRpc(
    userId: string,
    page: number,
    limit: number,
    filter: ChatFilter
  ): Promise<{ chats: SocialChat[]; hasMore: boolean } | null> {
    const { data, error } = await supabase.rpc('get_chat_inbox');
    if (error || !Array.isArray(data)) {
      return null;
    }

    const rows = data as Record<string, unknown>[];
    const directChatIds = rows
      .filter((row) => row.is_group !== true)
      .map((row) => row.chat_id?.toString())
      .filter((id): id is string => Boolean(id));
    const directPartnerByChatId = new Map<string, string>();
    for (const row of rows) {
      if (row.is_group === true) continue;
      const chatId = row.chat_id?.toString();
      const otherUserId = row.other_user_id?.toString();
      if (!chatId || !otherUserId) continue;
      directPartnerByChatId.set(chatId, otherUserId);
    }
    if (directChatIds.length > 0) {
      await this.fillMissingDirectPartners(userId, directChatIds, directPartnerByChatId);
    }

    const directPartnerIds = Array.from(new Set(Array.from(directPartnerByChatId.values())));
    const directProfilesById = await this.getProfilesByIds(directPartnerIds);

    const chats = rows
      .map((row) => {
        const chatId = row.chat_id?.toString();
        if (!chatId) return null;

        const isGroup = row.is_group === true;
        const participants = asStringArray(row.participants);
        const participantFallback = participants.find((id) => id !== userId);
        const otherUserId =
          row.other_user_id?.toString() ??
          directPartnerByChatId.get(chatId) ??
          participantFallback;
        const fallbackProfile = otherUserId ? directProfilesById.get(otherUserId) : undefined;
        const profile: ChatProfile | undefined = isGroup
          ? undefined
          : {
              id: otherUserId ?? fallbackProfile?.id ?? '',
              full_name:
                row.other_user_name?.toString() ||
                row.other_user_full_name?.toString() ||
                row.full_name?.toString() ||
                fallbackProfile?.full_name ||
                'User',
              avatar_url:
                row.other_user_avatar_url?.toString() ||
                row.other_user_avatar?.toString() ||
                fallbackProfile?.avatar_url,
              role: fallbackProfile?.role,
            };

        const mapped = mapChatRow(
          {
            id: chatId,
            is_group: isGroup,
            group_name: row.group_name,
            group_avatar_url: row.group_avatar_url,
            participants: isGroup
              ? participants
              : participants.length > 0
                ? participants
                : [userId, otherUserId].filter(Boolean),
            last_message: row.last_message,
            last_message_at: row.last_message_at,
            updated_at: row.updated_at ?? row.last_message_at,
            invite_mode: row.invite_mode ?? 'open',
            invite_link_enabled: row.invite_link_enabled ?? false,
          },
          {
            chat_id: chatId,
            unread_count: Number(row.unread_count ?? 0),
            pinned_at: row.pinned_at?.toString(),
            archived_at: row.archived_at?.toString(),
            muted_until: row.muted_until?.toString(),
          },
          profile
        );

        return mapped;
      })
      .filter((chat): chat is SocialChat => Boolean(chat))
      .filter((chat) => {
        if (filter === 'archived') return chat.is_archived;
        if (chat.is_archived) return false;
        if (filter === 'groups') return chat.is_group;
        if (filter === 'unread') return (chat.unread_count ?? 0) > 0;
        return true;
      });

    const fromRange = (page - 1) * limit;
    const toRange = page * limit;
    return {
      chats: chats.slice(fromRange, toRange),
      hasMore: chats.length > toRange,
    };
  }

  private static async getMemberRows(userId: string): Promise<ChatMemberRow[]> {
    const result = await supabase
      .from('chat_members')
      .select('chat_id, unread_count, pinned_at, archived_at, muted_until')
      .eq('user_id', userId);

    if (result.error && isMissingColumnError(result.error.message, 'unread_count')) {
      const fallback = await supabase
        .from('chat_members')
        .select('chat_id, pinned_at, archived_at, muted_until')
        .eq('user_id', userId);

      if (fallback.error) {
        console.error('Error fetching member rows:', fallback.error);
        return [];
      }

      return (fallback.data ?? []) as ChatMemberRow[];
    }

    if (result.error) {
      console.error('Error fetching member rows:', result.error);
      return [];
    }

    return (result.data ?? []) as ChatMemberRow[];
  }

  private static async getProfilesByIds(userIds: string[]): Promise<Map<string, ChatProfile>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching profiles:', error);
      return new Map();
    }

    const map = new Map<string, ChatProfile>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const profile = toChatProfile(row);
      if (profile) {
        map.set(profile.id, profile);
      }
    }
    return map;
  }

  private static async fillMissingDirectPartners(
    userId: string,
    chatIds: string[],
    partnerByChatId: Map<string, string>
  ) {
    const missingChatIds = chatIds.filter((chatId) => !partnerByChatId.has(chatId));
    if (missingChatIds.length === 0) return;

    const { data, error } = await supabase
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', missingChatIds)
      .neq('user_id', userId);

    if (error) {
      return;
    }

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const chatId = row.chat_id?.toString();
      const otherId = row.user_id?.toString();
      if (!chatId || !otherId || partnerByChatId.has(chatId)) continue;
      partnerByChatId.set(chatId, otherId);
    }
  }

  private static async findExistingDirectChat(userId: string, otherUserId: string): Promise<string | null> {
    const myChats = await supabase.from('chat_members').select('chat_id').eq('user_id', userId);
    if (myChats.error) {
      return null;
    }

    const chatIds = ((myChats.data ?? []) as Record<string, unknown>[])
      .map((row) => row.chat_id?.toString())
      .filter((id): id is string => Boolean(id));

    if (chatIds.length === 0) {
      return null;
    }

    const shared = await supabase
      .from('chat_members')
      .select('chat_id')
      .in('chat_id', chatIds)
      .eq('user_id', otherUserId);

    if (shared.error) {
      return null;
    }

    for (const row of (shared.data ?? []) as Record<string, unknown>[]) {
      const chatId = row.chat_id?.toString();
      if (!chatId) continue;

      const chat = await this.getChatById(chatId);
      if (chat && !chat.is_group) {
        return chat.id;
      }
    }

    return null;
  }

  private static async getChatById(chatId: string): Promise<SocialChat | null> {
    const { data, error } = await supabase.from('social_chats').select('*').eq('id', chatId).maybeSingle();
    if (error || !data) {
      return null;
    }
    return mapChatRow(data as Record<string, unknown>);
  }

  private static async ensureMembers(
    chatId: string,
    members: Array<{ userId: string; role: 'admin' | 'member' }>
  ) {
    if (members.length === 0) return;

    const now = new Date().toISOString();
    const insertRows = members.map((member) => ({
      chat_id: chatId,
      user_id: member.userId,
      role: member.role,
      status: 'JOINED',
      joined_at: now,
    }));

    const insertResult = await supabase.from('chat_members').insert(insertRows);
    if (!insertResult.error) {
      return;
    }

    if (!isMissingColumnError(insertResult.error.message, 'status')) {
      // Conflict means members already exist; best effort update status.
      if (!insertResult.error.message.toLowerCase().includes('duplicate')) {
        throw new Error(insertResult.error.message);
      }
    }

    for (const member of members) {
      const updateResult = await supabase
        .from('chat_members')
        .update({
          role: member.role,
          joined_at: now,
          status: 'JOINED',
        })
        .eq('chat_id', chatId)
        .eq('user_id', member.userId);

      if (updateResult.error && isMissingColumnError(updateResult.error.message, 'status')) {
        await supabase
          .from('chat_members')
          .update({
            role: member.role,
            joined_at: now,
          })
          .eq('chat_id', chatId)
          .eq('user_id', member.userId);
      }
    }
  }

  private static async updateChatMetadata(chatId: string, lastMessage: string, lastMessageAt: string) {
    const rpcRes = await supabase.rpc('update_chat_metadata', {
      p_chat_id: chatId,
      p_last_message: lastMessage,
      p_last_message_at: lastMessageAt,
    });

    if (!rpcRes.error) {
      return;
    }

    await supabase
      .from('social_chats')
      .update({
        last_message: lastMessage,
        last_message_at: lastMessageAt,
        updated_at: lastMessageAt,
      })
      .eq('id', chatId);
  }

  private static async insertMessageWithFallback(payload: Record<string, unknown>) {
    const insertPayload: Record<string, unknown> = { ...payload };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const insertResult = await supabase
        .from('social_messages')
        .insert(insertPayload)
        .select(MESSAGE_INSERT_SELECT_COLUMNS)
        .single();

      if (!insertResult.error) {
        const row = insertResult.data;
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          throw new Error('Data pesan tidak valid setelah insert.');
        }
        return row as Record<string, unknown>;
      }

      const errorMessage = insertResult.error.message;

      if (isMissingColumnError(errorMessage, 'message_type') && 'message_type' in insertPayload) {
        insertPayload.type = insertPayload['message_type'];
        delete insertPayload['message_type'];
        continue;
      }

      if (isMissingColumnError(errorMessage, 'updated_at')) {
        if ('updated_at' in insertPayload) {
          delete insertPayload['updated_at'];
          continue;
        }

        if ('created_at' in insertPayload) {
          delete insertPayload['created_at'];
          continue;
        }
      }

      if (isMissingColumnError(errorMessage, 'created_at') && 'created_at' in insertPayload) {
        delete insertPayload['created_at'];
        continue;
      }

      if (isMissingColumnError(errorMessage, 'reply_to_id') && 'reply_to_id' in insertPayload) {
        delete insertPayload['reply_to_id'];
        continue;
      }

      if (isMissingColumnError(errorMessage, 'file_size') && 'file_size' in insertPayload) {
        delete insertPayload['file_size'];
        continue;
      }

      throw new Error(errorMessage);
    }

    throw new Error('Gagal menyimpan pesan karena skema tabel tidak kompatibel.');
  }

  private static async tryJoinGroupRpc(
    rpcName: 'join_group_by_invite' | 'join_group_by_link',
    inviteCode: string
  ): Promise<{ status?: string; chat_id?: string } | null> {
    const { data, error } = await supabase.rpc(rpcName, { p_code: inviteCode });
    if (error || !data) {
      return null;
    }

    if (typeof data === 'object') {
      return {
        status: (data as Record<string, unknown>).status?.toString(),
        chat_id: (data as Record<string, unknown>).chat_id?.toString(),
      };
    }

    return { status: data.toString() };
  }

  private static async uploadMedia(file: File, bucket: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const safeExt = fileExt ? `.${fileExt}` : '';
    const filePath = `chat/${userId}/${Date.now()}-${createRandomToken(12)}${safeExt}`;

    const uploadResult = await supabase.storage.from(bucket).upload(filePath, file);
    if (uploadResult.error && uploadResult.error.message.toLowerCase().includes('bucket')) {
      const fallbackUpload = await supabase.storage.from('avatars').upload(filePath, file);
      if (fallbackUpload.error) {
        throw new Error(fallbackUpload.error.message);
      }
      return supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
    }

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }

    return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  }
}
