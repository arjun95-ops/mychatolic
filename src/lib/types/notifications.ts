// Notifications Types

export interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'like' | 'comment' | 'mention' | 'radar_invite' | 'mass_invite' | 'chat_message' | 'story_reaction';
  title: string;
  message?: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
  };
  post?: {
    id: string;
    caption?: string;
    image_url?: string[];
  };
  radar?: {
    id: string;
    title: string;
  };
  chat?: {
    id: string;
    is_group: boolean;
    group_name?: string;
  };
}
