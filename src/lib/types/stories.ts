// Stories Types

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  audience: 'followers' | 'close_friends' | 'everyone';
  created_at: string;
  expires_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    verification_status?: string;
    role?: string;
  };
  files?: StoryFile[];
}

export interface StoryFile {
  id: string;
  story_id: string;
  file_url: string;
  file_type: string;
  file_size: number;
  file_name: string;
  created_at: string;
  updated_at: string;
}

export type StoryAudience = 'followers' | 'close_friends' | 'everyone';

export interface StoryReaction {
  id: string;
  story_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
  created_at: string;
}

export interface StoryReply {
  id: string;
  story_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
