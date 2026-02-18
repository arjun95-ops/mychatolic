// Auth Types

import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile } from './profile';

export type User = SupabaseUser;

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
