// Feed Types

export interface Post {
  id: string;
  user_id: string;
  caption?: string;
  image_url?: string[];
  type?: string;
  country_id?: string;
  diocese_id?: string;
  church_id?: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
    verification_status?: string;
  };
  is_liked?: boolean;
  is_saved?: boolean;
  is_reposted?: boolean;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  parent_id?: string;
  content: string;
  image_url?: string;
  likes_count?: number;
  is_liked?: boolean;
  created_at: string;
  profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
  };
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  post?: Post;
}

export interface BlockedUser {
  id: string;
  full_name?: string;
  avatar_url?: string;
  blocked_at: string;
}
