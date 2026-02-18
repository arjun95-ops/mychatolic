// App Constants

export const APP_NAME = 'MyCatholic';
export const APP_DESCRIPTION = 'Platform sosial networking untuk komunitas Katolik';

// Pagination
export const PAGINATION = {
  POSTS_PAGE_SIZE: 12,
  CHATS_PAGE_SIZE: 20,
  NOTIFICATIONS_PAGE_SIZE: 30,
  COMMENTS_PAGE_SIZE: 20,
  BIBLE_CHAPTERS_PER_PAGE: 10,
} as const;

// File Upload Limits
export const UPLOAD_LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

// Story Settings
export const STORY_SETTINGS = {
  DURATION_MS: 5000, // 5 seconds per story
  EXPIRY_HOURS: 24,
  MAX_TEXT_LENGTH: 500,
} as const;

// Chat Settings
export const CHAT_SETTINGS = {
  MAX_MESSAGE_LENGTH: 2000,
  TYPING_DEBOUNCE_MS: 300,
  REACTIONS: ['❤️', '👍', '😂', '😮', '😢', '🎉', '🔥', '👏'],
} as const;

// Radar Settings
export const RADAR_SETTINGS = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 100,
  DEFAULT_MAX_PARTICIPANTS: 50,
  INVITE_EXPIRY_HOURS: 24,
} as const;

// User Roles
export const USER_ROLES = {
  UMAT: 'umat',
  KATEKUMEN: 'katekumen',
  PASTOR: 'pastor',
  SUSTER: 'suster',
  BRUDER: 'bruder',
  FRATER: 'frater',
  KATEKIS: 'katekis',
  UNKNOWN: 'unknown',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  [USER_ROLES.UMAT]: 'Umat',
  [USER_ROLES.KATEKUMEN]: 'Katekumen',
  [USER_ROLES.PASTOR]: 'Pastor',
  [USER_ROLES.SUSTER]: 'Suster',
  [USER_ROLES.BRUDER]: 'Bruder',
  [USER_ROLES.FRATER]: 'Frater',
  [USER_ROLES.KATEKIS]: 'Katekis',
  [USER_ROLES.UNKNOWN]: 'Unknown',
};

// Verification Status
export const VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED_CATHOLIC: 'verified_catholic',
  VERIFIED_PASTORAL: 'verified_pastoral',
  REJECTED: 'rejected',
  BANNED: 'banned',
} as const;

// Faith Status
export const FAITH_STATUS = {
  BAPTIZED: 'baptized',
  CATECHUMEN: 'catechumen',
  UNKNOWN: 'unknown',
} as const;

// Marital Status
export const MARITAL_STATUS = {
  SINGLE: 'single',
  MARRIED: 'married',
  WIDOWED: 'widowed',
  DIVORCED: 'divorced',
  UNKNOWN: 'unknown',
} as const;

// Gender
export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  UNKNOWN: 'unknown',
} as const;

// Testament Types
export const TESTAMENT = {
  OLD: 'old',
  NEW: 'new',
  DEUTERO: 'deutero',
} as const;

export const TESTAMENT_LABELS: Record<string, string> = {
  [TESTAMENT.OLD]: 'Perjanjian Lama',
  [TESTAMENT.NEW]: 'Perjanjian Baru',
  [TESTAMENT.DEUTERO]: 'Deutero',
};

// Languages
export const LANGUAGES = {
  INDONESIA: 'id',
  ENGLISH: 'en',
} as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  [LANGUAGES.INDONESIA]: 'Indonesia',
  [LANGUAGES.ENGLISH]: 'English',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  FOLLOW: 'follow',
  LIKE: 'like',
  COMMENT: 'comment',
  MENTION: 'mention',
  RADAR_INVITE: 'radar_invite',
  MASS_INVITE: 'mass_invite',
  CHAT_MESSAGE: 'chat_message',
  STORY_REACTION: 'story_reaction',
} as const;

// Chat Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  AUDIO: 'audio',
  LOCATION: 'location',
} as const;

// Story Media Types
export const STORY_MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

// Story Audience
export const STORY_AUDIENCE = {
  FOLLOWERS: 'followers',
  CLOSE_FRIENDS: 'close_friends',
  EVERYONE: 'everyone',
} as const;

// Radar Join Mode
export const RADAR_JOIN_MODE = {
  OPEN: 'OPEN',
  APPROVAL: 'APPROVAL',
} as const;

// Radar Status
export const RADAR_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  UPDATED: 'UPDATED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

// Check-in Status
export const CHECKIN_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

// Check-in Visibility
export const CHECKIN_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  GHOST: 'GHOST',
} as const;

// Feed Scope
export const FEED_SCOPE = {
  ALL: 'all',
  COUNTRY: 'country',
  DIOCESE: 'diocese',
  PARISH: 'parish',
} as const;

export const FEED_SCOPE_LABELS: Record<string, string> = {
  [FEED_SCOPE.ALL]: 'All',
  [FEED_SCOPE.COUNTRY]: 'Country',
  [FEED_SCOPE.DIOCESE]: 'Diocese',
  [FEED_SCOPE.PARISH]: 'Parish',
};

// Breakpoints
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

export const MOBILE_MAX = BREAKPOINTS.LG - 1;
export const DESKTOP_MIN = BREAKPOINTS.LG;
