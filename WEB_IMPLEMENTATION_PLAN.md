# MyCatholic Web App - Rencana Implementasi Lengkap

> **Status Dokumen**: Versi 1.0
> **Tanggal**: 2024
> **Target**: Developer Frontend & Fullstack
> **Scope**: User Portal Only (NO Backend Creation, NO Admin Dashboard)

---

## 📋 DAFTAR ISI

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

### 2.1 Authentication & Onboarding

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Splash Screen | `SplashPage` | Loading Screen | `/` | High |
| Login | `LoginPage` | Login Page | `/login` | High |
| Register | `RegisterPage` | Register Page | `/register` | High |
| Forgot Password | `ForgotPasswordPage` | Forgot Password | `/forgot-password` | High |
| Reset Password | `ResetPasswordPage` | Reset Password | `/reset-password` | High |
| Onboarding | `OnboardingPage` | Onboarding Carousel | `/onboarding` | Medium |
| Email Verification | Auto | Email Verification Page | `/verify-email` | High |
| Profile Completion | Auto after register | Complete Profile | `/complete-profile` | High |

**User Flow Auth:**
```
Unauthenticated User:
  → Visit web app
  → Show landing/onboarding (if not logged in)
  → Click "Login" → Login Page
  → Enter email/password → Validate
  → Check: Email verified? Profile exists? Profile filled?
  → If not verified → Show verification prompt
  → If profile not filled → Redirect to complete profile
  → Success → Navigate to Home Page (protected route)
```

### 2.2 Feed & Posts

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| View Feed | `HomeScreen` + `FeedPage` | Home/Feed Page | `/` (authenticated) | High |
| Create Post | `CreatePostScreen` + `CreatePostPage` | Create Post Modal/Page | `/post/create` (modal preferred) | High |
| Post Detail | `PostDetailScreen` | Post Detail Page | `/post/[id]` | High |
| Comments | `CommentsPage` | Comments Section (drawer/modal) | `/post/[id]/comments` | High |
| Saved Posts | `SavedPostsPage` | Saved Posts Page | `/saved` | Medium |

**Komponen Feed di Web:**
- Story rail di atas feed (horizontal scroll)
- Post composer trigger (user avatar + input)
- Filter chip: ALL, Country, Diocese, Parish (scope selector)
- Priority "Fire" button (highlighted content)
- Radar events section (card horizontal scroll)
- Infinite scroll posts
- Pull-to-refresh (mobile) / Refresh button (desktop)

**Interaksi Feed:**
- Like post dengan optimistic update
- Comment dengan drawer/bottom sheet (mobile) atau modal (desktop)
- Share ke social media
- Bookmark/save post
- Tap user avatar → Profile page
- Tap post → Post detail page
- Infinite scroll saat scroll ke bawah

### 2.3 Stories (Instagram-style)

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| View Story Rail | `StoryRail` component | Story Rail (horizontal scroll) | Integrated in Home/Chat | High |
| View Story | `StoryViewerPage` | Story Viewer (fullscreen modal) | `/story/[id]` | High |
| Create Story | `StoryCameraPage` + `StoryComposerPage` | Create Story Modal | `/story/create` | High |
| Story Interactions | Reply, React | Story Interactions Overlay | Integrated in viewer | High |

**Komponen Story di Web:**
- Story rail di Home dan Chat (horizontal scroll)
- Gradient ring untuk stories yang belum dibaca
- Progress bar untuk story duration (24h)
- Previous/next navigation
- Reply to story dengan message
- Emoji reactions
- Close button

**Interaksi Story:**
- Tap story ring → Open story viewer (fullscreen modal)
- Auto-advance story setiap 5 detik
- Previous/next navigation dengan tap left/right
- Reply button → Open chat with story author
- Tap reaction emoji → Send reaction

### 2.4 Chat & Messaging

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Chat Inbox | `ChatPage` | Chat Inbox Page | `/chat` | High |
| Chat Detail (1:1) | `SocialChatDetailPage` | Chat Room Page | `/chat/[id]` | High |
| Create Group | `CreateGroupPage` | Create Group Modal | `/chat/create-group` | High |
| Group Info | `GroupInfoPage` | Group Info Modal | `/chat/[id]/info` | High |
| Archived Chats | `ArchivedChatsPage` | Archived Chats Section | `/chat/archived` | Medium |
| Friend Search | `FriendSearchPage` | Search Users to Chat | `/chat/search-friends` | High |

**Komponen Chat di Web:**
- Unified chat inbox (All, Unread, Groups tabs)
- Chat tiles dengan avatar, name, preview, time, unread badge
- Story ring pada avatar user yang punya story
- Swipe actions (Pin, Archive, Mute, Delete)
- Real-time message updates
- Typing indicators
- Online/offline status

**Interaksi Chat:**
- Tap chat → Open chat room (mobile: fullscreen, desktop: side panel atau modal)
- Send messages (text, images, videos, files, audio)
- React to messages (emoji reactions)
- Reply to messages
- Typing indicators (user is typing...)
- Real-time updates via Supabase Realtime

### 2.5 Profile & Social Connections

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| My Profile | `ProfilePage` (own) | My Profile Page | `/profile` | High |
| Other Profile | `ProfilePage` (other user) | User Profile Page | `/profile/[id]` | High |
| Edit Profile | `EditProfilePage` | Edit Profile Page | `/profile/edit` | High |
| Followers List | `FollowListPage` | Followers Page | `/profile/[id]/followers` | High |
| Following List | `FollowListPage` | Following Page | `/profile/[id]/following` | High |
| Verification | `VerificationPage` + `UploadDocumentPage` | Verification Page | `/profile/verify` | Medium |

**Komponen Profile di Web:**
- Banner image (parallax effect di desktop)
- Avatar (overlapping banner)
- Name + role badge + verification badge
- Bio text
- Location info (country, diocese, parish)
- Stats row: Posts, Followers, Following
- Action buttons: Follow, Chat, Share
- Tabs: Posts, Media (photos only)
- Posts feed

**Interaksi Profile:**
- Follow/Unfollow dengan optimistic update
- Tap followers/following → Show follow list page
- Tap post → Post detail
- Tap chat → Open/create chat
- Share profile → Copy link atau share sheet

### 2.6 Radar Misa (Mass Check-in & Events)

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Radar Misa Hub | `RadarPage` + `RadarMisaPage` | Radar Page | `/radar` | High |
| Mass Check-in | `MassCheckInWizard` | Check-in Modal | `/radar/checkin` | High |
| Create Radar Event | `CreateRadarScreen` + `CreatePersonalRadarPage` | Create Radar Page | `/radar/create` | High |
| Radar Detail | `RadarDetailPage` | Radar Detail Page | `/radar/[id]` | High |
| Join Radar | Integrated | Join Flow (with animation) | Integrated | High |
| Invite Users | `InviteUserPage` | Invite Users Modal | `/radar/[id]/invite` | High |
| Radar Invites | `InviteInboxPage` | Invites Section | `/radar/invites` | High |

**Komponen Radar di Web:**
- Check-in status panel (animated)
- Quick menu row: Buat Radar, Cari Misa, Riwayat
- Tab bar: Cari, Riwayat, Ajak Misa
- Filter chips: Date (today/tomorrow/this week), Location, Mass time
- Radar event cards
- Community presence list (users yang sedang misa)
- Radar chat room

**Interaksi Radar:**
- Tap "Check-in" → Open check-in wizard (modal)
- Select church and mass time → Submit check-in
- See "Sedang misa" status dengan pulse animation
- Tap "Lihat Umat" → Show community presence list
- Tap radar event → Radar detail page
- Join radar → Open radar chat
- Create radar → Create wizard dengan form
- Invite users → Select users dan send invites

### 2.7 Bible (Alkitab)

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Bible Library | `BibleLibraryScreen` | Bible Library Page | `/bible` | High |
| Bible Reader | `BibleReaderScreen` | Bible Reader Page | `/bible/[book]/[chapter]` | High |
| Verse Search | Integrated | Verse Search | `/bible/search?q=` | Medium |

**Komponen Bible di Web:**
- Language selector: Indonesia, English
- Version selector (if multiple available)
- Search bar
- Testament tabs: Perjanjian Lama, Perjanjian Baru, Deutero
- Book grid/list dengan chapter count
- Chapter/verse selector sheet
- Bible reader dengan:
  - Chapter navigation (prev/next)
  - Verse numbers
  - Font size controls
  - Bookmark button
  - Share button
  - Jump to chapter/verse

**Interaksi Bible:**
- Tap book → Open chapter selection
- Select chapter → Load verses
- Adjust font size dengan slider/buttons
- Bookmark verse
- Share verse
- Jump to specific chapter/verse

### 2.8 Liturgy & Schedule (Jadwal)

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Mass Schedule | `SchedulePage` | Schedule Page | `/schedule` | High |
| Church List | `ChurchListPage` | Church List Page | `/schedule/churches` | High |
| Church Selector | `ChurchSelectorScreen` | Church Selector Modal | `/schedule/select-church` | High |
| Church Detail | `ChurchDetailPage` | Church Detail Page | `/schedule/church/[id]` | High |
| Liturgy Calendar | `LiturgyFullCalendarPage` | Full Calendar Page | `/schedule/calendar` | Medium |

**Komponen Schedule di Web:**
- Church selector dropdown
- Mass schedules list (filtered by selected church)
- Day/week filter
- Mass times dan locations
- Church detail cards dengan:
  - Church info (name, address, phone)
  - Mass schedules
  - Map location (desktop)
  - Get directions button

**Interaksi Schedule:**
- Select church → Filter schedules
- View mass times
- Tap church → Church detail page
- Get directions (link to Google Maps)

### 2.9 Notifications

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Notification Center | `NotificationScreen` | Notifications Page | `/notifications` | High |
| Notification Types | Integrated | Notification Categories | Integrated | High |

**Komponen Notifications di Web:**
- Notification icon di header dengan unread badge
- Notification list dengan:
  - Icon berdasarkan type (follow, like, comment, radar invite)
  - Title dan message
  - Time ago
  - Read/unread indicator
- Pull-to-refresh atau refresh button
- Mark all as read button
- Delete button

**Interaksi Notifications:**
- Tap notification → Navigate to relevant content
- Mark as read on tap
- Pull down to refresh (mobile) / Refresh button (desktop)
- Swipe left untuk mark read/delete (mobile)

### 2.10 Settings & Preferences

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Settings Hub | `SettingsPage` | Settings Page | `/settings` | High |
| Change Password | `ChangePasswordPage` | Change Password | `/settings/change-password` | High |
| Change Email | `ChangeEmailPage` | Change Email | `/settings/change-email` | Medium |
| Change Phone | `ChangePhonePage` | Change Phone | `/settings/change-phone` | Medium |
| Account Security | `AccountSecurityPage` | Account Security | `/settings/security` | Medium |
| Theme Toggle | Integrated | Theme Switcher | Integrated | High |
| Language Toggle | Integrated | Language Switcher | Integrated | High |
| Notification Settings | Integrated | Notification Preferences | Integrated | Medium |

**Komponen Settings di Web:**
- Profile card dengan avatar dan name
- Sections:
  - Account (Edit profile, Change password, Change email, Change phone)
  - Security (Account security, 2FA if available)
  - Privacy (Saved posts, Block users)
  - Preferences (Theme, Language, Notifications)
  - Support (Help center, Report problem, Terms, Privacy)
  - About (Version, Credits)

### 2.11 Search & Explore

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Global Search | `SearchResultsPage` | Search Page | `/search` | High |
| Friend Search | `FriendSearchPage` | Search Friends | `/search/friends` | High |

**Komponen Search di Web:**
- Search bar di header (global search)
- Search results dengan tabs:
  - Users
  - Posts
  - Churches
- Filter chips
- No results state
- Recent searches (if available)

### 2.12 Church Directory

| Fitur Mobile | Screen Mobile | Halaman Web | Route Web | Prioritas |
|--------------|---------------|------------|-----------|----------|
| Church Browse | `ChurchListPage` | Churches Page | `/churches` | High |
| Church Detail | `ChurchDetailPage` | Church Detail | `/church/[id]` | High |

---

## 3. ARSITEKTUR WEB REKOMENDASI

### 3.1 Technology Stack (NON-NEGOTIABLE)

```
Framework:     Next.js 16 with App Router
Language:      TypeScript 5
Styling:       Tailwind CSS 4
UI Library:    shadcn/ui (New York style)
Icons:         Lucide React
State:         Zustand (client) + TanStack Query (server)
Database:      Supabase (PostgreSQL, Auth, Storage, Realtime)
Auth:          Supabase Auth
Real-time:     Supabase Realtime + WebSockets (via Socket.IO mini-service)
```

### 3.2 Mengapa Stack Ini?

**Next.js 16 with App Router:**
- ✅ Server Components by default → Performa lebih baik
- ✅ Built-in routing dan code splitting
- ✅ Server Actions untuk form handling
- ✅ SEO friendly (SSR/SSG)
- ✅ Optimized untuk production
- ✅ React 18+ dengan Server Components

**TypeScript 5:**
- ✅ Type safety untuk semua data models
- ✅ Autocomplete yang lebih baik
- ✅ Prevent bugs di compile time
- ✅ Maintainability jangka panjang

**Tailwind CSS 4:**
- ✅ Utility-first → Development lebih cepat
- ✅ Consistent design dengan mobile (Flutter → Tailwind mapping)
- ✅ Responsive design built-in
- ✅ Small bundle size (JIT mode)

**shadcn/ui:**
- ✅ Component library yang copy-pasteable (fully customizable)
- ✅ Berbasis Radix UI → Accessibility built-in
- ✅ Consistent dengan New York style (modern, clean)
- ✅ Mudah custom sesuai mobile design

**Zustand:**
- ✅ Global state yang sederhana
- ✅ Small footprint (<1KB)
- ✅ No Provider wrapper hell
- ✅ TypeScript support excellent

**TanStack Query:**
- ✅ Server state management yang powerful
- ✅ Caching, refetching, polling, subscriptions
- ✅ Optimistic updates built-in
- ✅ DevTools excellent
- ✅ Perfect match untuk Supabase data

**Supabase:**
- ✅ Sama dengan mobile (consistency)
- ✅ Postgres database dengan RLS
- ✅ Auth built-in
- ✅ Realtime subscriptions
- ✅ Storage untuk file uploads
- ✅ Edge Functions jika needed

### 3.3 Cara Menjaga UI/UX "SAMA" dengan Mobile

**1. Design System Mapping:**

| Flutter | Tailwind | Catatan |
|---------|----------|--------|
| Color(0xFF0088CC) | `bg-[#0088CC]` | Primary blue |
| `TextTheme.bodyMedium` | `text-base` | 16px |
| `TextTheme.bodySmall` | `text-sm` | 14px |
| `BoxDecoration(borderRadius: 12)` | `rounded-xl` | 12px |
- Responsive: Mobile (bottom nav) vs Desktop (sidebar)
- Screen: Mobile (100% width) vs Desktop (max-width container)
- Spacing: Mobile (tight) vs Desktop (lebih lega)

**3. Component Translation:**

| Flutter Widget | React/shadcn/ui | Catatan |
|----------------|----------------|--------|
| `ListView.builder` | `InfiniteScroll` | Use react-intersection-observer |
| `PullToRefresh` | `PullToRefresh` component | Implement custom |
| `BottomSheet` | `Drawer` / `Sheet` (shadcn) | Mobile: bottom sheet, Desktop: modal |
| `TabBar` | `Tabs` (shadcn) | Same functionality |
| `SliverAppBar` | `StickyHeader` | Custom component |
| `Hero` widget | Framer Motion `AnimatePresence` | Shared element transitions |
| `showDialog` | `Dialog` (shadcn) | Same pattern |
| `showModalBottomSheet` | `Sheet` (shadcn) | Mobile: bottom, Desktop: right drawer |

**4. Interaction Parity:**

| Mobile Interaction | Web Counterpart |
|-------------------|-----------------|
| Pull-to-refresh | Refresh button (desktop) + Pull-to-refresh (mobile) |
| Swipe to delete/action | Swipe actions (mobile) + Action buttons (desktop) |
| Bottom sheet navigation | Sheet/Drawer |
| Gesture navigation | Browser navigation + Custom back button (mobile) |
| Haptic feedback | Visual feedback (vibration API mobile) |
| Long press | Right-click context menu (desktop) |

**5. Responsive Breakpoints:**

```css
/* Tailwind breakpoints */
sm: 640px   /* Large mobile */
md: 768px   /* Tablet */
lg: 1024px  /* Small desktop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

**Strategy:**
- Mobile-first design
- Bottom navigation untuk mobile (< lg)
- Sidebar navigation untuk desktop (>= lg)
- Grid layouts: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- Typography: Responsive font sizes

### 3.4 Layered Architecture

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

**Layers explained:**

**Presentation Layer:**
- Pages: Route handlers (Next.js App Router)
- Components: Reusable UI components
- Layouts: Shared layouts (with navbar, sidebar)
- UI: shadcn/ui components

**Application Logic Layer:**
- Custom hooks: `useAuth`, `useChat`, `useFeed`, dll
- Services: Business logic, data transformation
- Utilities: Helper functions

**Data Layer:**
- TanStack Query: Server state, caching, refetching
- Zustand: Global state (auth, theme, locale)
- Forms: React Hook Form + Zod validation

**Infrastructure Layer:**
- Supabase client: Database, Auth, Storage
- Supabase Realtime: WebSockets, subscriptions
- Storage: File uploads

### 3.5 Security Layer

```typescript
// Authentication Flow
Client (Browser)
    ↓
Next.js Middleware (Route protection)
    ↓
Supabase Auth (Session validation)
    ↓
Server Component / API Route
    ↓
Supabase Database (RLS Policies)
```

**Security measures:**
- ✅ Middleware untuk protected routes
- ✅ Supabase RLS di semua tabel
- ✅ Row-level checks di queries
- ✅ XSS protection built-in (React)
- ✅ CSRF protection (SameSite cookies)
- ✅ Secure headers (helmet middleware)
- ✅ Input validation (Zod schemas)
- ✅ File upload restrictions (size, type)

---

## 4. STRUKTUR FOLDER PROYEK

### 4.1 Complete Folder Structure

```
src/
├── app/                           # Next.js App Router (Routes)
│   ├── (auth)/                    # Auth group layout
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   ├── register/
│   │   │   └── page.tsx          # Register page
│   │   ├── forgot-password/
│   │   │   └── page.tsx          # Forgot password page
│   │   ├── reset-password/
│   │   │   └── page.tsx          # Reset password page
│   │   ├── verify-email/
│   │   │   └── page.tsx          # Email verification page
│   │   ├── complete-profile/
│   │   │   └── page.tsx          # Profile completion page
│   │   └── layout.tsx            # Auth layout (no navbar)
│   │
│   ├── (main)/                   # Main app group layout
│   │   ├── layout.tsx            # Main layout (with navbar/sidebar)
│   │   ├── page.tsx              # Home/Feed page (/)
│   │   │
│   │   ├── post/
│   │   │   ├── create/
│   │   │   │   └── page.tsx     # Create post modal/page
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Post detail page
│   │   │       └── comments/
│   │   │           └── page.tsx # Comments page
│   │   │
│   │   ├── chat/
│   │   │   ├── page.tsx         # Chat inbox page
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx     # Chat detail page
│   │   │   │   └── info/
│   │   │   │       └── page.tsx # Group info page
│   │   │   ├── create-group/
│   │   │   │   └── page.tsx     # Create group modal
│   │   │   ├── archived/
│   │   │   │   └── page.tsx     # Archived chats
│   │   │   └── search-friends/
│   │   │       └── page.tsx     # Search friends to chat
│   │   │
│   │   ├── profile/
│   │   │   ├── page.tsx         # My profile page
│   │   │   ├── edit/
│   │   │   │   └── page.tsx     # Edit profile page
│   │   │   ├── verify/
│   │   │   │   └── page.tsx     # Verification page
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Other user profile
│   │   │       ├── followers/
│   │   │       │   └── page.tsx # Followers list
│   │   │       └── following/
│   │   │           └── page.tsx # Following list
│   │   │
│   │   ├── radar/
│   │   │   ├── page.tsx         # Radar hub page
│   │   │   ├── checkin/
│   │   │   │   └── page.tsx     # Check-in modal
│   │   │   ├── create/
│   │   │   │   └── page.tsx     # Create radar page
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx     # Radar detail page
│   │   │   │   └── invite/
│   │   │   │       └── page.tsx # Invite users modal
│   │   │   ├── invites/
│   │   │   │   └── page.tsx     # Invites inbox
│   │   │   └── history/
│   │   │       └── page.tsx     # Radar history
│   │   │
│   │   ├── bible/
│   │   │   ├── page.tsx         # Bible library page
│   │   │   ├── [book]/
│   │   │   │   ├── [chapter]/
│   │   │   │   │   └── page.tsx # Bible reader page
│   │   │   │   └── page.tsx     # Book detail/chapters
│   │   │   └── search/
│   │   │       └── page.tsx     # Bible search
│   │   │
│   │   ├── schedule/
│   │   │   ├── page.tsx         # Schedule page
│   │   │   ├── churches/
│   │   │   │   ├── page.tsx     # Church list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Church detail
│   │   │   ├── select-church/
│   │   │   │   └── page.tsx     # Church selector modal
│   │   │   └── calendar/
│   │   │       └── page.tsx     # Full calendar page
│   │   │
│   │   ├── notifications/
│   │   │   └── page.tsx         # Notifications page
│   │   │
│   │   ├── saved/
│   │   │   └── page.tsx         # Saved posts page
│   │   │
│   │   ├── search/
│   │   │   ├── page.tsx         # Global search page
│   │   │   └── friends/
│   │   │       └── page.tsx     # Friend search
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx         # Settings hub
│   │   │   ├── change-password/
│   │   │   │   └── page.tsx     # Change password
│   │   │   ├── change-email/
│   │   │   │   └── page.tsx     # Change email
│   │   │   ├── change-phone/
│   │   │   │   └── page.tsx     # Change phone
│   │   │   ├── security/
│   │   │   │   └── page.tsx     # Account security
│   │   │   └── account/
│   │   │       └── page.tsx     # Account settings
│   │   │
│   │   └── churches/
│   │       ├── page.tsx         # Church directory
│   │       └── [id]/
│   │           └── page.tsx     # Church detail
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing/onboarding page
│   ├── globals.css               # Global styles
│   └── loading.tsx               # Global loading
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── drawer.tsx
│   │   ├── tabs.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── toast.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── scroll-area.tsx
│   │   ├── command.tsx
│   │   ├── popover.tsx
│   │   ├── tooltip.tsx
│   │   ├── checkbox.tsx
│   │   ├── switch.tsx
│   │   ├── slider.tsx
│   │   ├── label.tsx
│   │   ├── progress.tsx
│   │   └── ...
│   │
│   ├── auth/                     # Auth components
│   │   ├── auth-provider.tsx
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   ├── forgot-password-form.tsx
│   │   ├── reset-password-form.tsx
│   │   └── email-verification.tsx
│   │
│   ├── feed/                     # Feed components
│   │   ├── post-card.tsx
│   │   ├── post-composer.tsx
│   │   ├── post-actions.tsx
│   │   ├── comment-form.tsx
│   │   ├── comment-list.tsx
│   │   ├── feed-filters.tsx
│   │   └── infinite-feed.tsx
│   │
│   ├── stories/                  # Story components
│   │   ├── story-rail.tsx
│   │   ├── story-ring.tsx
│   │   ├── story-viewer.tsx
│   │   ├── story-progress-bar.tsx
│   │   ├── story-composer.tsx
│   │   └── story-overlay.tsx
│   │
│   ├── chat/                     # Chat components
│   │   ├── chat-inbox.tsx
│   │   ├── chat-tile.tsx
│   │   ├── chat-room.tsx
│   │   ├── chat-message.tsx
│   │   ├── chat-bubble.tsx
│   │   ├── chat-input.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── message-reactions.tsx
│   │   ├── create-group-form.tsx
│   │   └── group-info-panel.tsx
│   │
│   ├── profile/                  # Profile components
│   │   ├── profile-header.tsx
│   │   ├── profile-stats.tsx
│   │   ├── profile-actions.tsx
│   │   ├── profile-tabs.tsx
│   │   ├── edit-profile-form.tsx
│   │   ├── follow-list.tsx
│   │   └── verification-form.tsx
│   │
│   ├── radar/                    # Radar components
│   │   ├── radar-header.tsx
│   │   ├── radar-card.tsx
│   │   ├── radar-detail.tsx
│   │   ├── checkin-panel.tsx
│   │   ├── checkin-wizard.tsx
│   │   ├── create-radar-form.tsx
│   │   ├── community-presence.tsx
│   │   ├── radar-invites.tsx
│   │   └── invite-users-form.tsx
│   │
│   ├── bible/                    # Bible components
│   │   ├── bible-library.tsx
│   │   ├── book-grid.tsx
│   │   ├── chapter-selector.tsx
│   │   ├── bible-reader.tsx
│   │   ├── verse-text.tsx
│   │   ├── font-size-control.tsx
│   │   └── bookmark-button.tsx
│   │
│   ├── schedule/                 # Schedule components
│   │   ├── schedule-list.tsx
│   │   ├── mass-card.tsx
│   │   ├── church-card.tsx
│   │   ├── church-selector.tsx
│   │   ├── calendar-grid.tsx
│   │   └── mass-timeline.tsx
│   │
│   ├── layout/                   # Layout components
│   │   ├── app-header.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── bottom-nav.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── desktop-nav.tsx
│   │   └── container.tsx
│   │
│   ├── shared/                   # Shared components
│   │   ├── loading-skeleton.tsx
│   │   ├── empty-state.tsx
│   │   ├── error-state.tsx
│   │   ├── image-with-placeholder.tsx
│   │   ├── user-avatar.tsx
│   │   ├── user-badge.tsx
│   │   ├── verification-badge.tsx
│   │   ├── relative-time.tsx
│   │   ├── pull-to-refresh.tsx
│   │   └── infinite-scroll.tsx
│   │
│   └── forms/                    # Form components
│       ├── form-field.tsx
│       ├── search-input.tsx
│       └── file-upload.tsx
│
├── lib/                          # Utilities & core
│   ├── supabase/                 # Supabase configuration
│   │   ├── client.ts             # Client Supabase instance
│   │   ├── server.ts             # Server Supabase instance
│   │   ├── types.ts              # Supabase generated types
│   │   └── auth.ts               # Auth utilities
│   │
│   ├── db/                       # Database helpers
│   │   └── queries.ts            # Reusable queries
│   │
│   ├── features/                 # Feature hooks & services
│   │   ├── auth/
│   │   │   ├── use-auth.ts       # Auth hook
│   │   │   ├── use-user.ts       # User data hook
│   │   │   └── auth-service.ts  # Auth service
│   │   │
│   │   ├── feed/
│   │   │   ├── use-posts.ts      # Posts hook
│   │   │   ├── use-comments.ts   # Comments hook
│   │   │   └── feed-service.ts   # Feed service
│   │   │
│   │   ├── stories/
│   │   │   ├── use-stories.ts   # Stories hook
│   │   │   └── stories-service.ts
│   │   │
│   │   ├── chat/
│   │   │   ├── use-chat.ts       # Chat hook
│   │   │   ├── use-messages.ts   # Messages hook
│   │   │   └── chat-service.ts   # Chat service
│   │   │
│   │   ├── profile/
│   │   │   ├── use-profile.ts    # Profile hook
│   │   │   ├── use-follows.ts    # Follows hook
│   │   │   └── profile-service.ts
│   │   │
│   │   ├── radar/
│   │   │   ├── use-radar.ts      # Radar hook
│   │   │   ├── use-checkin.ts    # Check-in hook
│   │   │   └── radar-service.ts  # Radar service
│   │   │
│   │   ├── bible/
│   │   │   ├── use-bible.ts      # Bible hook
│   │   │   └── bible-service.ts
│   │   │
│   │   ├── schedule/
│   │   │   ├── use-schedule.ts   # Schedule hook
│   │   │   └── schedule-service.ts
│   │   │
│   │   └── notifications/
│   │       ├── use-notifications.ts
│   │       └── notifications-service.ts
│   │
│   ├── store/                    # Zustand stores
│   │   ├── auth-store.ts        # Auth state
│   │   ├── theme-store.ts       # Theme state
│   │   ├── locale-store.ts      # Locale state
│   │   ├── ui-store.ts          # UI state (modal, drawer, etc.)
│   │   └── chat-store.ts        # Chat state (typing, online status)
│   │
│   ├── types/                    # TypeScript types
│   │   ├── index.ts              # Export all types
│   │   ├── auth.ts
│   │   ├── feed.ts
│   │   ├── chat.ts
│   │   ├── profile.ts
│   │   ├── radar.ts
│   │   ├── bible.ts
│   │   ├── schedule.ts
│   │   └── notifications.ts
│   │
│   ├── utils/                    # Utility functions
│   │   ├── cn.ts                # Classnames utility
│   │   ├── date.ts              # Date formatting
│   │   ├── validation.ts        # Zod schemas
│   │   ├── format.ts            # Number/text formatting
│   │   └── constants.ts         # App constants
│   │
│   └── hooks/                    # Custom hooks
│       ├── use-media-query.ts   # Breakpoint hook
│       ├── use-debounce.ts      # Debounce hook
│       ├── use-throttle.ts      # Throttle hook
│       └── use-infinite-scroll.ts # Infinite scroll hook
│
├── styles/                       # Additional styles
│   └── animations.css            # Custom animations
│
├── config/                       # Configuration files
│   ├── supabase.ts              # Supabase config
│   └── features.ts              # Feature flags
│
└── middleware.ts                 # Next.js middleware (route protection)

---

# (DOCUMENT CONTINUED IN NEXT PART DUE TO LENGTH)
