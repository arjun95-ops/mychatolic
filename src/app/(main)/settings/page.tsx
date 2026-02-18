// Settings Page

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Bell,
  BookOpenCheck,
  ChevronRight,
  CircleUserRound,
  Globe,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  ShieldX,
  SquareUser,
  UserRoundCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  getProfileRoleLabel,
  getProfileVerificationState,
  getTrustBadge,
  isProfileVerified,
} from '@/lib/features/profile/profile-status';

const ANALYTICS_KEY = 'analytics_enabled';
type SectionTone = 'primary' | 'emerald' | 'amber' | 'slate';

function getSectionToneClasses(tone: SectionTone) {
  if (tone === 'emerald') {
    return {
      container: 'border-emerald-500/25',
      header: 'from-emerald-500/12 to-emerald-500/0',
      title: 'text-emerald-700',
    };
  }
  if (tone === 'amber') {
    return {
      container: 'border-amber-500/25',
      header: 'from-amber-500/12 to-amber-500/0',
      title: 'text-amber-700',
    };
  }
  if (tone === 'slate') {
    return {
      container: 'border-border/70',
      header: 'from-muted/35 to-muted/5',
      title: 'text-muted-foreground',
    };
  }
  return {
    container: 'border-primary/25',
    header: 'from-primary/12 to-primary/0',
    title: 'text-primary',
  };
}

function getTrustToneClasses(tone: ReturnType<typeof getTrustBadge>['tone']) {
  if (tone === 'success') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700';
  }
  if (tone === 'primary') {
    return 'border-primary/35 bg-primary/10 text-primary';
  }
  if (tone === 'warning') {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-700';
  }
  if (tone === 'danger') {
    return 'border-destructive/35 bg-destructive/10 text-destructive';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
}

export default function SettingsPage() {
  const router = useRouter();
  const { profile, user, signOut, updateProfile } = useAuth();

  const [allowMassInviteOverride, setAllowMassInviteOverride] = useState<boolean | null>(null);
  const [allowProfileChatOverride, setAllowProfileChatOverride] = useState<boolean | null>(null);
  const [isSavingMassInvite, setIsSavingMassInvite] = useState(false);
  const [isSavingProfileChat, setIsSavingProfileChat] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(ANALYTICS_KEY) !== 'false';
  });

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';

  const verificationStatus = getProfileVerificationState(profile);
  const trustBadge = getTrustBadge(profile);
  const trustLabel = trustBadge.label;
  const roleLabel = getProfileRoleLabel(profile);
  const verificationSubtitle = isProfileVerified(profile)
    ? `Status: ${trustLabel}`
    : verificationStatus === 'pending'
      ? 'Status: Menunggu Verifikasi'
      : verificationStatus === 'rejected'
        ? 'Status: Ditolak'
        : 'Status: Belum Verifikasi';

  const emailStatus = user?.email_confirmed_at ? 'Terverifikasi' : 'Belum terverifikasi';

  const allowMassInvite = allowMassInviteOverride ?? Boolean(profile?.allow_mass_invite ?? true);
  const allowProfileChat = allowProfileChatOverride ?? Boolean(profile?.allow_profile_chat ?? true);

  const languageText = useMemo(() => {
    if (typeof window === 'undefined') return 'Indonesia';
    const saved = localStorage.getItem('mychatolic-language');
    if (saved === 'en') return 'English';
    return 'Indonesia';
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Berhasil keluar');
      router.push('/login');
    } catch {
      toast.error('Gagal keluar');
    }
  };

  const toggleAnalytics = (value: boolean) => {
    setAnalyticsEnabled(value);
    localStorage.setItem(ANALYTICS_KEY, value ? 'true' : 'false');
    toast.success(value ? 'Analytics diaktifkan' : 'Analytics dinonaktifkan');
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">Pengaturan Akun</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola profil, keamanan, preferensi, dan kontrol privasi akun Anda.
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 bg-gradient-to-r from-background to-muted/30 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <Avatar className="h-16 w-16 border border-border/70 shadow-sm">
            <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold sm:text-2xl">{profile?.full_name || 'User'}</h2>
            <p className="truncate text-sm text-muted-foreground">{profile?.email || user?.email || '-'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                {roleLabel}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getTrustToneClasses(trustBadge.tone)}`}
              >
                {trustLabel}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                  user?.email_confirmed_at
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                }`}
              >
                {user?.email_confirmed_at ? 'Email terverifikasi' : 'Email belum verifikasi'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{verificationSubtitle}</p>
          </div>
          <Link href="/profile/edit">
            <Button className="w-full rounded-xl bg-primary hover:bg-primary-hover sm:w-auto">
              Edit Profil
            </Button>
          </Link>
        </CardContent>
      </Card>

      <SettingsGroup
        title="Akun"
        tone="primary"
        items={[
          { icon: <SquareUser className="h-5 w-5" />, label: 'Edit Profil', href: '/profile/edit' },
          { icon: <BookOpenCheck className="h-5 w-5" />, label: 'Postingan Tersimpan', href: '/settings/saved-posts' },
          {
            icon: <BadgeCheck className="h-5 w-5" />,
            label: 'Verifikasi Akun',
            description: verificationSubtitle,
            href: '/settings/verification',
          },
          {
            icon: <Mail className="h-5 w-5" />,
            label: 'Email',
            description: `${user?.email || '-'} • ${emailStatus}`,
            href: '/settings/security',
          },
          {
            icon: <ShieldCheck className="h-5 w-5" />,
            label: 'Keamanan Akun',
            description: 'Atur password, sesi login, dan keamanan akun',
            href: '/settings/security',
          },
        ]}
      />

      <SettingsGroup
        title="Keamanan"
        tone="amber"
        items={[
          { icon: <Lock className="h-5 w-5" />, label: 'Ubah Password', href: '/settings/change-password' },
          { icon: <ShieldX className="h-5 w-5" />, label: 'Pengguna Diblokir', href: '/settings/blocked-users' },
          { icon: <Bell className="h-5 w-5" />, label: 'Notifikasi', href: '/settings/notifications' },
        ]}
      />

      <SwitchGroup
        title="Radar"
        tone="emerald"
        items={[
          {
            icon: <CircleUserRound className="h-5 w-5" />,
            label: 'Tampilkan tombol Ajak Misa',
            description: 'Jika dimatikan, user lain tidak bisa mengajak Anda dari profil.',
            checked: allowMassInvite,
            isSaving: isSavingMassInvite,
            onCheckedChange: async (checked) => {
              const previous = allowMassInvite;
              setAllowMassInviteOverride(checked);
              setIsSavingMassInvite(true);
              try {
                await updateProfile({ allow_mass_invite: checked });
              } catch (error) {
                setAllowMassInviteOverride(previous);
                toast.error(error instanceof Error ? error.message : 'Gagal mengubah pengaturan Ajak Misa.');
              } finally {
                setIsSavingMassInvite(false);
              }
            },
          },
          {
            icon: <UserRoundCog className="h-5 w-5" />,
            label: 'Tampilkan tombol Chat di Profil',
            description: 'Jika dimatikan, user lain tidak bisa memulai chat dari profil Anda.',
            checked: allowProfileChat,
            isSaving: isSavingProfileChat,
            onCheckedChange: async (checked) => {
              const previous = allowProfileChat;
              setAllowProfileChatOverride(checked);
              setIsSavingProfileChat(true);
              try {
                await updateProfile({ allow_profile_chat: checked });
              } catch (error) {
                setAllowProfileChatOverride(previous);
                toast.error(error instanceof Error ? error.message : 'Gagal mengubah pengaturan Chat Profil.');
              } finally {
                setIsSavingProfileChat(false);
              }
            },
          },
        ]}
      />

      <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border/60 bg-gradient-to-r from-muted/35 to-muted/5 px-5 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Umum</h3>
          </div>
          <SettingsRow
            icon={<Globe className="h-5 w-5" />}
            label="Bahasa"
            description={languageText}
            href="/settings/language"
          />
          <Separator />
          <SwitchRow
            icon={<Info className="h-5 w-5" />}
            label="Analytics"
            description="Bantu kami meningkatkan aplikasi dengan data penggunaan anonim."
            checked={analyticsEnabled}
            onCheckedChange={toggleAnalytics}
          />
          <Separator />
          <SettingsRow
            icon={<BadgeCheck className="h-5 w-5" />}
            label="Tentang"
            onClick={() => toast.info('Halaman Tentang segera tersedia.')}
          />
          <Separator />
          <SettingsRow
            icon={<HelpCircle className="h-5 w-5" />}
            label="Bantuan"
            onClick={() => toast.info('Halaman Bantuan segera tersedia.')}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
        <CardContent className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-xl text-destructive hover:bg-destructive/15 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Keluar
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">MyCatholic v1.0.0</p>
    </div>
  );
}

function SettingsGroup({
  title,
  tone = 'slate',
  items,
}: {
  title: string;
  tone?: SectionTone;
  items: Array<{ icon: React.ReactNode; label: string; description?: string; href: string }>;
}) {
  const toneClass = getSectionToneClasses(tone);
  return (
    <Card className={`overflow-hidden rounded-2xl bg-card/95 shadow-sm ${toneClass.container}`}>
      <CardContent className="p-0">
        <div className={`border-b border-border/60 bg-gradient-to-r px-5 py-3 ${toneClass.header}`}>
          <h3 className={`text-xs font-bold uppercase tracking-[0.16em] ${toneClass.title}`}>{title}</h3>
        </div>
        {items.map((item, index) => (
          <div key={`${item.href}-${item.label}`}>
            <SettingsRow {...item} />
            {index < items.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SwitchGroup({
  title,
  tone = 'slate',
  items,
}: {
  title: string;
  tone?: SectionTone;
  items: Array<{
    icon: React.ReactNode;
    label: string;
    description?: string;
    checked: boolean;
    isSaving?: boolean;
    onCheckedChange: (checked: boolean) => void | Promise<void>;
  }>;
}) {
  const toneClass = getSectionToneClasses(tone);
  return (
    <Card className={`overflow-hidden rounded-2xl bg-card/95 shadow-sm ${toneClass.container}`}>
      <CardContent className="p-0">
        <div className={`border-b border-border/60 bg-gradient-to-r px-5 py-3 ${toneClass.header}`}>
          <h3 className={`text-xs font-bold uppercase tracking-[0.16em] ${toneClass.title}`}>{title}</h3>
        </div>
        {items.map((item, index) => (
          <div key={item.label}>
            <SwitchRow {...item} />
            {index < items.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsRow({
  icon,
  label,
  description,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/35 group-hover:text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-medium leading-snug">{label}</p>
        {description && <p className="truncate text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-all group-hover:border-primary/35 group-hover:text-primary">
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {content}
    </button>
  );
}

function SwitchRow({
  icon,
  label,
  description,
  checked,
  isSaving = false,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  isSaving?: boolean;
  onCheckedChange: (checked: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:px-5">
      <div className="flex items-start gap-3 sm:flex-1">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium leading-snug">{label}</p>
          {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="ml-12 flex items-center justify-between gap-2 sm:ml-0 sm:justify-end">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            isSaving
              ? 'border-primary/35 bg-primary/10 text-primary'
              : checked
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700'
                : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          {isSaving ? 'Menyimpan...' : checked ? 'Aktif' : 'Nonaktif'}
        </span>
        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <Switch checked={checked} disabled={isSaving} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
