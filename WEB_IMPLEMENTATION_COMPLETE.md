# MyCatholic Web App - Rencana Implementasi Lengkap (SELESAI)

> **Status Dokumen**: Versi 1.0 (Complete)
> **Tanggal**: 2024
> **Target**: Developer Frontend & Fullstack
> **Scope**: User Portal Only (NO Backend Creation, NO Admin Dashboard)

---

## DAFTAR ISI

1. [Overview & Scope](#1-overview--scope)
2. [Feature Mapping: Mobile → Web](#2-feature-mapping-mobile--web)
3. [Arsitektur Web Rekomendasi](#3-arsitektur-web-rekomendasi)
4. [Struktur Folder Proyek](#4-struktur-folder-proyek)
5. [Design System](#5-design-system)
6. [Komponen UI Reusable](#6-komponen-ui-reusable)
7. [Integrasi Supabase](#7-integrasi-supabase)
8. [Implementasi Detail per Modul](#8-implementasi-detail-per-modul)
9. [Definition of Done / Acceptance Criteria](#9-definition-of-done--acceptance-criteria)

---

## 1. OVERVIEW & SCOPE

### 1.1 Proyek Ini Adalah

**MyCatholic Web App** adalah versi web dari aplikasi mobile yang sudah ada. Ini adalah platform sosial networking untuk komunitas Katolik.

### 1.2 Apa yang TIDAK Perlu Dibuat

❌ **TIDAK** membuat backend baru (sudah ada Supabase)
❌ **TIDAK** membuat database/tabel baru (schema sudah lengkap)
❌ **TIDAK** membuat Admin Dashboard (sudah ada)
❌ **TIDAK** mengubah sistem admin

### 1.3 Apa yang HARUS Dibuat

✅ Web App untuk User Portal saja
✅ UI/UX frontend yang SEMIRIP mungkin dengan mobile
✅ Integrasi langsung ke Supabase yang sudah ada
✅ Responsive design (mobile & desktop)
✅ Tampilan premium dan modern

### 1.4 Target Platform

- Web browsers (Chrome, Firefox, Safari, Edge)
- Mobile web (iOS Safari, Android Chrome)
- Tablet web (iPad, Android tablets)
- Desktop web (1920px+)

---

## 2. FEATURE MAPPING: MOBILE → WEB

Lihat dokumen terpisah `WEB_IMPLEMENTATION_PLAN.md` untuk detail lengkap feature mapping.

Ringkasan utama:
- **Auth & Onboarding**: Login, Register, Forgot Password, Email Verification
- **Feed & Posts**: Home page, Create post, Post detail, Comments
- **Stories**: Story rail, Story viewer, Create story
- **Chat**: Inbox, Chat room, Group chat, Real-time messaging
- **Profile**: My profile, Other profile, Edit profile, Followers/Following
- **Radar Misa**: Check-in, Create radar, Join radar, Radar chat
- **Bible**: Bible library, Bible reader, Search
- **Schedule**: Mass schedules, Church list, Church detail
- **Notifications**: Notification center
- **Settings**: Account, Security, Preferences

---

## 3. ARSITEKTUR WEB REKOMENDASI

### 3.1 Technology Stack

```
Framework:     Next.js 16 with App Router
Language:      TypeScript 5
Styling:       Tailwind CSS 4
UI Library:    shadcn/ui (New York style)
Icons:         Lucide React
State:         Zustand (client) + TanStack Query (server)
Database:      Supabase (PostgreSQL, Auth, Storage, Realtime)
Auth:          Supabase Auth
Real-time:     Supabase Realtime
```

### 3.2 Layered Architecture

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│   (Pages, Components, UI)              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Application Logic Layer           │
│   (Custom hooks, services)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Data Layer                     │
│   (TanStack Query, Zustand)            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Infrastructure Layer           │
│   (Supabase, Storage, Realtime)        │
└─────────────────────────────────────────┘
```

---

## 4. STRUKTUR FOLDER PROYEK

Lihat `WEB_IMPLEMENTATION_PLAN.md` (lines 549-896) untuk detail lengkap struktur folder.

Ringkasan:
```
src/
├── app/                    # Next.js App Router (Routes)
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── auth/               # Auth components
│   ├── feed/               # Feed components
│   ├── stories/            # Story components
│   ├── chat/               # Chat components
│   ├── profile/            # Profile components
│   ├── radar/              # Radar components
│   ├── bible/              # Bible components
│   ├── schedule/           # Schedule components
│   ├── layout/             # Layout components
│   ├── shared/             # Shared components
│   └── forms/              # Form components
├── lib/
│   ├── supabase/           # Supabase configuration
│   ├── db/                 # Database helpers
│   ├── features/           # Feature hooks & services
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   └── hooks/              # Custom hooks
├── styles/                 # Additional styles
└── config/                 # Configuration files
```

---

## 5. DESIGN SYSTEM

### 5.1 Color Palette

**Primary Colors:**
```css
--primary: #0088CC;           /* Telegram Blue */
--primary-dark: #007AB8;
--primary-light: #4DB8FF;
```

**Semantic Colors:**
```css
--success: #2ECC71;          /* Green */
--danger: #E74C3C;           /* Red */
--warning: #F39C12;          /* Orange */
```

### 5.2 Typography

**Font Families:**
- Primary: Inter (body text)
- Headings: Outfit
- Serif: Playfair Display (Bible)

**Font Sizes:**
```
text-xs:   12px
text-sm:   14px
text-base: 16px
text-lg:   18px
text-xl:   20px
text-2xl:  24px
```

### 5.3 Spacing & Radius

**Spacing:**
```css
--space-2: 8px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

**Border Radius:**
```css
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
```

---

## 6. KOMPONEN UI REUSABLE

### 6.1 Button Variants

- `primary` - Main CTA button
- `secondary` - Secondary action
- `outline` - Bordered button
- `ghost` - No background
- `destructive` - Danger action

### 6.2 Card Components

- `PostCard` - Feed posts
- `UserCard` - User profiles
- `ChurchCard` - Church information
- `RadarCard` - Radar events

### 6.3 Modal/Drawer

- `Dialog` - Modal dialogs
- `Sheet` - Bottom sheet (mobile) / Side drawer (desktop)

### 6.4 Other Components

- `Avatar` - User avatars
- `Badge` - Status badges
- `Tabs` - Tab navigation
- `Skeleton` - Loading skeletons
- `Toast` - Notifications
- `DropdownMenu` - Action menus
- `Progress` - Progress bars
- `Tooltip` - Tooltips

---

## 7. INTEGRASI SUPABASE

### 7.1 Setup Client & Server

```typescript
// lib/supabase/client.ts (Browser)
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
export const createClient = createClientComponentClient;

// lib/supabase/server.ts (Server)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
export const createClient = () => createServerComponentClient({ cookies });
```

### 7.2 Auth Flow

**Login:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**Register:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: `${window.location.origin}/verify-email` },
});
```

### 7.3 Data Fetching (TanStack Query)

```typescript
// Infinite query for posts
useInfiniteQuery({
  queryKey: ['posts', params],
  queryFn: async ({ pageParam = 0 }) => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:... ')
      .order('created_at', { ascending: false })
      .range(pageParam * 12, (pageParam + 1) * 12 - 1);
    return data || [];
  },
});
```

### 7.4 Real-time Subscriptions

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`chat:${chatId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'social_messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => setMessages(prev => [...prev, payload.new]))
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, [chatId]);
```

### 7.5 Route Protection (Middleware)

Lihat `WEB_IMPLEMENTATION_PLAN.md` untuk implementasi lengkap middleware.

---

## 8. IMPLEMENTASI DETAIL PER MODUL

### 8.1 Authentication & Onboarding

**Page: `/login`**
- Tujuan: User authentication
- Komponen: `LoginForm` (email input, password input, login button)
- State: isLoading, errorMessage
- Query/Mutation: `login()` mutation
- Interaksi: Form validation, error handling

**Page: `/register`**
- Tujuan: New user registration
- Komponen: `RegisterForm`
- State: isLoading, validation errors
- Query/Mutation: `register()` mutation
- Interaksi: Real-time validation, success → redirect to complete profile

**Page: `/complete-profile`**
- Tujuan: Profile completion after register
- Komponen: `EditProfileForm`
- State: profile data, isLoading
- Query/Mutation: `updateProfile()` mutation
- Interaksi: Cascading dropdowns (country → diocese → church)

### 8.2 Feed & Posts

**Page: `/` (Home)**
- Tujuan: Main feed with posts
- Komponen:
  - `StoryRail` - Horizontal scroll stories
  - `PostComposer` - Create post trigger
  - `FeedFilters` - Scope selector (ALL, Country, Diocese, Parish)
  - `PostCard` - Individual post component
- State: posts list, isLoading, hasMore, scope
- Query/Mutation: `usePosts()` infinite query
- Interaksi:
  - Infinite scroll when reaching bottom
  - Pull-to-refresh (mobile)
  - Like dengan optimistic update
  - Tap post → Navigate to `/post/[id]`
  - Tap comment → Open comments drawer

**Page: `/post/create`**
- Tujuan: Create new post
- Komponen: `CreatePostForm` (image upload, caption input)
- State: images, caption, isUploading
- Query/Mutation: `createPost()` mutation
- Interaksi:
  - Image preview with remove option
  - Progress indicator during upload
  - Success → close modal, refresh feed

**Page: `/post/[id]`**
- Tujuan: View post detail
- Komponen: `PostDetail`, `CommentList`
- State: post data, comments, isLoading
- Query/Mutation: `usePost()`, `useComments()`
- Interaksi:
  - Load post with all comments
  - Add comment dengan optimistic update
  - Navigate to user profile

### 8.3 Stories

**Component: `StoryRail`**
- Tujuan: Display stories horizontal scroll
- Komponen: `StoryRing` (gradient ring untuk unread stories)
- State: stories list, isLoading
- Query: `useStories()`
- Interaksi:
  - Horizontal scroll
  - Tap story ring → Open story viewer

**Component: `StoryViewer`**
- Tujuan: View story fullscreen
- Komponen:
  - `StoryProgressBar` - Auto-advance progress
  - `StoryOverlay` - Reply and reactions
- State: current story index, progress, isPaused
- Query: `useStory()`
- Interaksi:
  - Auto-advance setiap 5 detik
  - Tap left/right → Previous/next story
  - Tap reply → Open chat with author
  - Tap reaction → Send reaction emoji
  - Close button

**Page: `/story/create`**
- Tujuan: Create new story
- Komponen: `StoryComposer` (camera/gallery, text overlay, audience selector)
- State: media, caption, overlays, audience
- Query/Mutation: `createStory()` mutation
- Interaksi:
  - Capture or select image/video
  - Add text overlay
  - Select audience (followers, close friends, everyone)
  - Success → Close modal

### 8.4 Chat & Messaging

**Page: `/chat`**
- Tujuan: Unified chat inbox
- Komponen:
  - `ChatTabs` (All, Unread, Groups)
  - `ChatTile` - Individual chat item
  - `StoryRing` - Unread story indicator
- State: chats list, filter, isLoading
- Query: `useChats()` infinite query
- Interaksi:
  - Filter tabs
  - Tap chat → Navigate to `/chat/[id]`
  - Swipe actions (Pin, Archive, Mute, Delete) - mobile
  - Search bar untuk filter chats

**Page: `/chat/[id]`**
- Tujuan: Chat room (1:1 or group)
- Komponen:
  - `ChatRoom` - Message list
  - `ChatBubble` - Individual message
  - `ChatInput` - Message composer
  - `TypingIndicator`
  - `MessageReactions`
- State: messages list, isLoading, replyToMessage
- Query/Mutation: `useMessages()`, `sendMessage()` mutation
- Real-time: Subscribe to `social_messages` table
- Interaksi:
  - Send text, images, videos, files
  - Reply to message
  - React with emoji
  - Typing indicator (via Supabase Realtime broadcast)
  - Auto-scroll to bottom on new message

**Page: `/chat/create-group`**
- Tujuan: Create new group chat
- Komponen: `CreateGroupForm` (member selector, group name, invite mode)
- State: selectedMembers, groupName, inviteMode
- Query/Mutation: `createGroup()` mutation via RPC
- Interaksi:
  - Search and select members (mutual follows only)
  - Set invite mode (Open, Approval, Admin Only)
  - Success → Navigate to new chat

### 8.5 Profile & Social Connections

**Page: `/profile`**
- Tujuan: My profile page
- Komponen:
  - `ProfileHeader` (banner, avatar, name, badges)
  - `ProfileStats` (Posts, Followers, Following counts)
  - `ProfileActions` (Edit, Share)
  - `ProfileTabs` (Posts, Media)
  - `PostList` - User's posts
- State: profile data, posts, isLoading, isFollowing
- Query: `useProfile()`, `useUserPosts()`
- Interaksi:
  - Tap edit → `/profile/edit`
  - Tap followers → `/profile/me/followers`
  - Tap post → Post detail

**Page: `/profile/[id]`**
- Tujuan: Other user's profile
- Komponen: Same as `/profile` but with Follow/Chat buttons
- State: Same as `/profile` plus isFollowing
- Query/Mutation: `useFollow()`, `toggleFollow()` mutation
- Interaksi:
  - Follow/Unfollow dengan optimistic update
  - Tap chat → Create/open 1:1 chat
  - Tap share → Copy profile link

**Page: `/profile/edit`**
- Tujuan: Edit user profile
- Komponen: `EditProfileForm`
- State: profile form data, isLoading
- Query/Mutation: `updateProfile()` mutation
- Interaksi:
  - Upload avatar/banner
  - Cascading dropdowns (country → diocese → church)
  - Toggle visibility (age, ethnicity, allow_mass_invite, allow_profile_chat)

### 8.6 Radar Misa (Mass Check-in & Events)

**Page: `/radar`**
- Tujuan: Radar Misa hub
- Komponen:
  - `CheckinPanel` - Current check-in status
  - `RadarTabs` (Cari, Riwayat, Ajak Misa)
  - `RadarFilters` - Date, location, mass time filters
  - `RadarCard` - Individual radar event
- State:
  - currentCheckin
  - publicRadars
  - myAgendas
  - ownerRadars
  - invites
- Query:
  - `useCurrentCheckin()`
  - `usePublicRadars()` infinite query
  - `useMyRadars()`
- Interaksi:
  - Tap "Check-in" → `/radar/checkin`
  - Tap "Lihat Umat" → Show community presence
  - Tap radar → `/radar/[id]`
  - Join radar → Open radar chat

**Page: `/radar/checkin`**
- Tujuan: Mass check-in wizard
- Komponen: `CheckinWizard` (church selector, mass schedule, visibility)
- State: church, massSchedule, visibility (PUBLIC/GHOST)
- Query/Mutation: `checkin()` mutation
- Interaksi:
  - Select church
  - Select mass schedule
  - Set visibility
  - Submit → Close modal, update status

**Page: `/radar/create`**
- Tujuan: Create new radar event
- Komponen: `CreateRadarForm`
- State:
  - title, description
  - church, massSchedule
  - joinMode, maxParticipants
  - allowMemberInvite
- Query/Mutation: `createRadar()` mutation via RPC
- Interaksi:
  - Form validation
  - Church selector cascading
  - Success → Navigate to new radar

**Page: `/radar/[id]`**
- Tujuan: Radar detail page
- Komponen:
  - `RadarDetailHeader` - Event info
  - `RadarParticipants` - Participant list (host only)
  - `RadarChatButton` - Join/open chat
- State: radar data, participants, isMember
- Query/Mutation:
  - `useRadar()`
  - `joinRadar()` / `leaveRadar()` mutation
- Interaksi:
  - Join radar
  - Tap chat → Open radar chat
  - Host: Manage participants

### 8.7 Bible (Alkitab)

**Page: `/bible`**
- Tujuan: Bible library
- Komponen:
  - `LanguageSelector` - Indonesia/English
  - `TestamentTabs` (Perjanjian Lama, Perjanjian Baru, Deutero)
  - `BookGrid` - Book list with chapter count
- State:
  - language, selectedTestament
  - books list, isLoading
- Query: `useBibleBooks()`
- Interaksi:
  - Tap book → Open chapter selector
  - Filter by testament
  - Search by book name

**Page: `/bible/[book]/[chapter]`**
- Tujuan: Bible reader
- Komponen:
  - `BibleReader` - Verse display
  - `ChapterNavigation` - Previous/Next chapter
  - `FontSizeControl` - Adjust font size
  - `BookmarkButton` - Bookmark verse
- State:
  - verses, fontSize, bookmarkedVerses
  - isLoading
- Query: `useBibleChapter()`
- Interaksi:
  - Previous/Next chapter
  - Adjust font size
  - Bookmark verse
  - Share verse

### 8.8 Liturgy & Schedule (Jadwal)

**Page: `/schedule`**
- Tujuan: Mass schedules
- Komponen:
  - `ChurchSelector` - Dropdown select
  - `ScheduleList` - Mass times list
  - `MassCard` - Individual mass schedule
- State:
  - selectedChurch, schedules
  - isLoading
- Query: `useMassSchedules()`
- Interaksi:
  - Select church → Filter schedules
  - Tap mass → View details
  - Tap church → `/schedule/church/[id]`

**Page: `/schedule/churches`**
- Tujuan: Church directory
- Komponen:
  - `ChurchGrid` - Church cards
  - `ChurchSearch` - Search input
- State:
  - churches list, searchQuery
  - isLoading
- Query: `useChurches()` infinite query
- Interaksi:
  - Search by church name
  - Tap church → `/schedule/church/[id]`
  - Infinite scroll

### 8.9 Notifications

**Page: `/notifications`**
- Tujuan: Notification center
- Komponen:
  - `NotificationList` - List of notifications
  - `NotificationItem` - Individual notification
- State:
  - notifications list, unreadCount
  - isLoading
- Query/Mutation:
  - `useNotifications()` infinite query
  - `markAsRead()` mutation
- Interaksi:
  - Tap notification → Navigate to content
  - Mark as read on tap
  - Pull-to-refresh (mobile)
  - Mark all as read button

### 8.10 Settings

**Page: `/settings`**
- Tujuan: Settings hub
- Komponen: Settings sections (Account, Security, Privacy, Preferences, Support, About)
- State: user profile, theme, locale
- Query: `useUser()`
- Interaksi:
  - Tap section → Navigate to settings page
  - Theme toggle (Light/Dark)
  - Language toggle (Indonesian/English)

---

## 9. DEFINITION OF DONE / ACCEPTANCE CRITERIA

### 9.1 Functional Requirements

**Authentication:**
✅ User dapat login dengan email dan password
✅ User dapat register baru
✅ Email verification flow lengkap
✅ Password recovery flow lengkap
✅ Profile completion wajib setelah register
✅ Protected routes berfungsi dengan middleware

**Feed & Posts:**
✅ User dapat melihat feed posts dengan infinite scroll
✅ User dapat membuat post baru dengan caption dan gambar
✅ User dapat like post dengan optimistic update
✅ User dapat comment pada post
✅ User dapat share post
✅ User dapat save/bookmark post
✅ Filter berfungsi (ALL, Country, Diocese, Parish)
✅ Story rail ditampilkan dengan benar

**Stories:**
✅ User dapat melihat stories dari friends
✅ User dapat membuat story baru (gambar/video)
✅ Story auto-advance setiap 5 detik
✅ User dapat reply ke story
✅ User dapat react ke story
✅ Story expire setelah 24 jam

**Chat:**
✅ User dapat melihat list chat (All, Unread, Groups)
✅ User dapat mengirim pesan (text, gambar, video, file)
✅ Real-time message updates berfungsi
✅ Typing indicator berfungsi
✅ User dapat reply ke pesan
✅ User dapat react ke pesan dengan emoji
✅ User dapat create group chat
✅ User dapat manage group (add/remove members, promote admin)
✅ Swipe actions berfungsi (Pin, Archive, Mute, Delete) - mobile

**Profile:**
✅ User dapat melihat profile sendiri dan orang lain
✅ User dapat edit profile (avatar, banner, personal info)
✅ User dapat follow/unfollow user lain
✅ User dapat melihat followers dan following list
✅ User dapat upload verification document
✅ Stats (Posts, Followers, Following) tampil dengan benar

**Radar Misa:**
✅ User dapat check-in ke misa
✅ User dapat melihat "Sedang misa" status
✅ User dapat melihat community presence
✅ User dapat create radar event
✅ User dapat join radar event
✅ User dapat invite friend ke radar
✅ Radar chat berfungsi
✅ Filter radar berfungsi (date, location, mass time)

**Bible:**
✅ User dapat melihat list buku Alkitab
✅ User dapat membaca ayat-ayat
✅ Chapter navigation berfungsi
✅ Font size adjustment berfungsi
✅ User dapat bookmark ayat
✅ Search berfungsi

**Schedule:**
✅ User dapat melihat jadwal misa
✅ User dapat select church
✅ User dapat melihat detail gereja
✅ Filter jadwal berfungsi

**Notifications:**
✅ User dapat melihat notifikasi
✅ Notifikasi dikategorikan dengan benar
✅ Tap notifikasi navigate ke konten yang tepat
✅ Mark as read berfungsi

**Settings:**
✅ User dapat ubah password
✅ User dapat ubah email
✅ User dapat ubah profile
✅ Theme toggle berfungsi
✅ Language toggle berfungsi

### 9.2 UI/UX Requirements

**Responsive Design:**
✅ Tampilan mobile-first (320px - 1023px)
✅ Tampilan desktop (1024px+)
✅ Bottom navigation untuk mobile
✅ Sidebar navigation untuk desktop
✅ Grid layouts beradaptasi (1 col → 2 col → 3 col)
✅ Typography responsif

**Design Consistency:**
✅ Colors sama dengan mobile (#0088CC primary)
✅ Typography menggunakan Inter dan Outfit
✅ Border radius konsisten (8, 12, 16, 20px)
✅ Spacing konsisten (4, 8, 12, 16, 24, 32px)
✅ Shadows konsisten (sm, md, lg, xl, 2xl)

**Interaction Parity:**
✅ Infinite scroll berfungsi seperti mobile
✅ Pull-to-refresh (mobile)
✅ Swipe actions (mobile)
✅ Bottom sheets (mobile) / Modals (desktop)
✅ Toast notifications
✅ Loading states (skeleton)
✅ Empty states
✅ Error states

**Animations:**
✅ Page transitions smooth
✅ Like animations
✅ Story progress bar smooth
✅ Modal/drawer transitions smooth
✅ Optimistic update animations

### 9.3 Technical Requirements

**Code Quality:**
✅ TypeScript strict mode enabled
✅ No any types
✅ Proper error handling
✅ Consistent code formatting
✅ ESLint no errors
✅ Proper component composition

**Performance:**
✅ First Contentful Paint < 1.5s
✅ Time to Interactive < 3s
✅ Largest Contentful Paint < 2.5s
✅ Bundle size optimized (code splitting)
✅ Image optimization (Next.js Image component)
✅ Caching strategy (TanStack Query)

**Security:**
✅ Middleware route protection berfungsi
✅ Supabase RLS berfungsi
✅ XSS protection (React built-in)
✅ CSRF protection (SameSite cookies)
✅ Input validation (Zod)
✅ File upload restrictions (size, type)
✅ Secure headers

**Accessibility:**
✅ Semantic HTML
✅ ARIA labels
✅ Keyboard navigation
✅ Screen reader friendly
✅ Color contrast WCAG AA
✅ Focus states visible
✅ Alt text untuk images

### 9.4 Browser Compatibility

✅ Chrome (latest 2 versions)
✅ Firefox (latest 2 versions)
✅ Safari (latest 2 versions)
✅ Edge (latest 2 versions)
✅ iOS Safari (iOS 14+)
✅ Android Chrome (Android 10+)

### 9.5 Testing Requirements

**Unit Tests:**
✅ Utility functions tercover
✅ Custom hooks tercover
✅ Services tercover

**Integration Tests:**
✅ Auth flow
✅ Feed flow
✅ Chat flow

**E2E Tests:**
✅ Critical user paths
✅ Responsive design tests

---

## SUMMARY

Dokumen ini memberikan rencana implementasi lengkap untuk MyCatholic Web App. Developer dapat:

1. **Memulai Setup**: Install Next.js, TypeScript, Tailwind, shadcn/ui
2. **Implementasi Design System**: Configure colors, typography, spacing
3. **Setup Supabase**: Client dan server configuration
4. **Buat Komponen UI**: Button, Card, Modal, dll
5. **Implementasi Fitur**: Mulai dari Auth → Feed → Chat → dll
6. **Testing & QA**: Test sesuai Definition of Done

**Urutan Implementasi yang Disarankan:**

1. Phase 1: Auth + Profile (MVP)
   - Login, Register, Profile
   - Basic UI components

2. Phase 2: Feed + Stories
   - Feed posts
   - Stories
   - Post interactions

3. Phase 3: Chat
   - Chat inbox
   - Chat room
   - Real-time messaging

4. Phase 4: Radar Misa
   - Check-in
   - Radar events
   - Radar chat

5. Phase 5: Bible + Schedule
   - Bible reader
   - Mass schedules
   - Church directory

6. Phase 6: Polish & Optimize
   - Notifications
   - Settings
   - Performance optimization
   - Accessibility

---

**END OF DOCUMENT**
