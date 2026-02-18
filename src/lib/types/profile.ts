// Profile Types

export type UserRole =
  | 'umat'
  | 'katekumen'
  | 'pastor'
  | 'suster'
  | 'bruder'
  | 'frater'
  | 'katekis'
  | 'mitra_pending'
  | 'unknown';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified_catholic'
  | 'verified_pastoral'
  | 'rejected'
  | 'banned'
  | 'unknown';

export type FaithStatus = 'baptized' | 'catechumen' | 'unknown';

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  follower_profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
  };
  following_profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
  };
}

export interface Profile {
  id: string;
  full_name?: string;
  baptism_name?: string;
  email?: string;
  avatar_url?: string;
  banner_url?: string;
  role: UserRole;
  verification_status: VerificationStatus;
  account_status?: VerificationStatus;
  faith_status: FaithStatus;
  bio?: string;
  country_id?: string;
  diocese_id?: string;
  church_id?: string;
  country?:
    | {
        id: string;
        name: string;
        code: string;
      }
    | string;
  diocese?:
    | {
        id: string;
        name: string;
      }
    | string;
  church?:
    | {
        id: string;
        name: string;
      }
    | string;
  country_text?: string;
  diocese_text?: string;
  parish?: string;
  parish_text?: string;
  birth_date?: string;
  ethnicity?: string;
  gender?: 'male' | 'female' | 'unknown';
  marital_status?: 'single' | 'married' | 'widowed' | 'divorced' | 'unknown';
  is_catechumen?: boolean;
  profile_filled?: boolean;
  terms_accepted_at?: string;
  faith_verification_consent_at?: string;
  verification_submitted_at?: string;
  verified_at?: string;
  rejection_reason?: string;
  ktp_url?: string;
  baptism_cert_url?: string;
  chrism_cert_url?: string;
  assignment_letter_url?: string;
  selfie_url?: string;
  counselor_status?: 'online' | 'busy' | 'offline' | 'unknown';
  ministry_count?: number;
  is_age_visible?: boolean;
  is_ethnicity_visible?: boolean;
  allow_mass_invite?: boolean;
  allow_profile_chat?: boolean;
  posts_count?: number;
  followers_count?: number;
  following_count?: number;
  updated_at: string;
  created_at: string;
  is_following?: boolean;
}

export interface ProfileStats {
  posts_count: number;
  followers_count: number;
  following_count: number;
}
