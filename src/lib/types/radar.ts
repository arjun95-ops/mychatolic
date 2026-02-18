// Radar Types

export interface RadarEvent {
  id: string;
  creator_id: string;
  country_id: string;
  diocese_id: string;
  church_id: string;
  mass_schedule_id?: string;
  title: string;
  description: string;
  join_mode: 'OPEN' | 'APPROVAL';
  allow_member_invite: boolean;
  max_participants: number;
  event_starts_at_utc: string;
  event_ends_at_utc: string;
  church_timezone: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UPDATED' | 'CANCELLED' | 'COMPLETED';
  published_at?: string;
  completed_at?: string;
  chat_room_id?: string;
  created_at: string;
  updated_at: string;
  creator?: RadarProfile;
  church?: {
    id: string;
    name: string;
    address?: string;
  };
  participants?: RadarParticipant[];
  participant_count?: number;
  is_member?: boolean;
  is_host?: boolean;
}

export interface RadarParticipant {
  id: string;
  radar_id: string;
  user_id: string;
  role: 'HOST' | 'ADMIN' | 'MEMBER';
  status: 'JOINED' | 'PENDING' | 'LEFT' | 'KICKED' | 'REJECTED';
  joined_at?: string;
  left_at?: string;
  kicked_at?: string;
  created_at: string;
  updated_at: string;
  profile?: RadarProfile;
}

export interface RadarInvite {
  id: string;
  source: 'RADAR_GROUP' | 'PERSONAL';
  radar_id?: string;
  inviter_id: string;
  invitee_id: string;
  country_id?: string;
  diocese_id?: string;
  church_id?: string;
  mass_schedule_id?: string;
  event_starts_at_utc?: string;
  note?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  expires_at?: string;
  responded_at?: string;
  created_at: string;
  updated_at: string;
  inviter?: RadarProfile;
  radar?: RadarEvent;
}

export interface MassCheckIn {
  id: string;
  user_id: string;
  country_id: string;
  diocese_id: string;
  church_id: string;
  mass_schedule_id?: string;
  checkin_date: string;
  checkin_at: string;
  church_timezone: string;
  visibility: 'PUBLIC' | 'GHOST';
  status: 'ACTIVE' | 'ARCHIVED';
  archived_at?: string;
  created_at: string;
  updated_at: string;
  church?: {
    id: string;
    name: string;
  };
  profile?: RadarProfile;
}

export interface RadarProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
}
