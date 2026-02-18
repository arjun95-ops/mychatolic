// Chat Types

export interface SocialChat {
  id: string;
  is_group: boolean;
  group_name?: string;
  group_avatar_url?: string;
  admin_id?: string;
  creator_id?: string;
  participants: string[];
  last_message?: string;
  last_message_at?: string;
  last_message_sender_id?: string;
  chat_room_id?: string;
  allow_member_invite?: boolean;
  invite_mode: 'open' | 'approval' | 'admin_only';
  invite_code?: string;
  invite_link_enabled: boolean;
  invite_link_expires_at?: string;
  created_at: string;
  updated_at: string;
  profiles?: Record<string, ChatProfile>;
  unread_count?: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_archived?: boolean;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status?: 'JOINED' | 'PENDING' | 'LEFT' | 'KICKED';
  pinned_at?: string;
  archived_at?: string;
  muted_until?: string;
  last_read_at?: string;
  joined_at: string;
  left_at?: string;
  kicked_at?: string;
  profile?: ChatProfile;
}

export interface SocialMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content?: string;
  message_type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'location';
  media_url?: string;
  file_name?: string;
  file_size?: number;
  reply_to_id?: string;
  reactions: Record<string, string[]>;
  created_at: string;
  updated_at: string;
  sender?: ChatProfile;
  reply_to?: SocialMessage;
}

export interface GroupJoinRequest {
  id: string;
  chat_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  invited_by?: string;
  created_at: string;
  profile?: ChatProfile;
}

export interface ChatProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  online_status?: 'online' | 'offline' | 'busy' | 'unknown';
}
