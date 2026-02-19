// Settings Detail Page

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  CheckCircle2,
  CircleCheckBig,
  FileCheck2,
  FileText,
  Globe,
  Hourglass,
  Loader2,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthService } from '@/lib/features/auth/auth-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useBlockedUsers, useSavedPosts, useUnblockUser } from '@/lib/features/feed/use-posts';
import { PostCard } from '@/components/feed/post-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/client';
import {
  getProfileRoleLabel,
  getProfileVerificationState,
  getTrustBadge,
  isProfileCatechumen,
  isProfileClergy,
  isProfileVerified,
} from '@/lib/features/profile/profile-status';
import type { Profile } from '@/lib/types';

type SettingsSlug =
  | 'security'
  | 'change-password'
  | 'notifications'
  | 'theme'
  | 'language'
  | 'verification'
  | 'blocked-users'
  | 'saved-posts';

const LANGUAGE_STORAGE_KEY = 'mychatolic-language';
const PUSH_NOTIFICATION_KEY = 'mychatolic-push-notification';
const EMAIL_NOTIFICATION_KEY = 'mychatolic-email-notification';
const VERIFICATION_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const VERIFICATION_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
type DetailTone = 'primary' | 'emerald' | 'amber' | 'slate';

const SETTINGS_DETAIL_META: Record<
  SettingsSlug,
  { title: string; description: string; tone: DetailTone; icon: LucideIcon }
> = {
  security: {
    title: 'Keamanan Akun',
    description: 'Kelola email, status keamanan, dan aktivitas login Anda.',
    tone: 'amber',
    icon: ShieldCheck,
  },
  'change-password': {
    title: 'Ubah Password',
    description: 'Perbarui password akun agar akun tetap aman.',
    tone: 'amber',
    icon: Lock,
  },
  notifications: {
    title: 'Notifikasi',
    description: 'Atur notifikasi aplikasi, email, dan preferensi interaksi profil.',
    tone: 'emerald',
    icon: Bell,
  },
  theme: {
    title: 'Tema',
    description: 'Pilih tampilan antarmuka yang paling nyaman untuk Anda.',
    tone: 'primary',
    icon: Moon,
  },
  language: {
    title: 'Bahasa',
    description: 'Pilih bahasa utama untuk pengalaman penggunaan aplikasi.',
    tone: 'primary',
    icon: Globe,
  },
  verification: {
    title: 'Verifikasi Akun',
    description: 'Unggah dokumen sesuai role untuk meningkatkan trust profil.',
    tone: 'primary',
    icon: FileCheck2,
  },
  'saved-posts': {
    title: 'Postingan Tersimpan',
    description: 'Akses ulang semua postingan yang sudah Anda simpan.',
    tone: 'slate',
    icon: Bookmark,
  },
  'blocked-users': {
    title: 'Pengguna Diblokir',
    description: 'Kelola daftar akun yang Anda blokir.',
    tone: 'slate',
    icon: ShieldCheck,
  },
};

function getDetailToneClasses(tone: DetailTone) {
  if (tone === 'emerald') {
    return {
      container: 'border-emerald-500/25',
      header: 'from-emerald-500/12 to-emerald-500/0',
      badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700',
      title: 'text-emerald-700',
    };
  }
  if (tone === 'amber') {
    return {
      container: 'border-amber-500/25',
      header: 'from-amber-500/12 to-amber-500/0',
      badge: 'border-amber-500/30 bg-amber-500/15 text-amber-700',
      title: 'text-amber-700',
    };
  }
  if (tone === 'primary') {
    return {
      container: 'border-primary/25',
      header: 'from-primary/12 to-primary/0',
      badge: 'border-primary/30 bg-primary/15 text-primary',
      title: 'text-primary',
    };
  }
  return {
    container: 'border-border/70',
    header: 'from-muted/35 to-muted/5',
    badge: 'border-border/70 bg-muted/30 text-muted-foreground',
    title: 'text-muted-foreground',
  };
}

function createRandomSuffix(length = 8): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '').slice(0, length);
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(Math.max(4, Math.ceil(length / 2)));
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, length);
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('42703') ||
    lower.includes('schema cache') ||
    lower.includes('pgrst204')
  );
}

function extractMissingColumnName(message: string): string | null {
  const withDoubleQuote = message.match(/column\s+"([^"]+)"/i);
  if (withDoubleQuote?.[1]) return withDoubleQuote[1];

  const withSingleQuote = message.match(/column\s+'([^']+)'/i);
  if (withSingleQuote?.[1]) return withSingleQuote[1];

  return null;
}

function isBucketMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'));
}

async function uploadVerificationFile(userId: string, file: File, prefix: string): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${prefix}_${Date.now()}_${createRandomSuffix(8)}.${extension}`;
  const buckets = ['verification_docs', 'verification-docs', 'avatars'];

  let lastError: string | null = null;
  for (const bucket of buckets) {
    const upload = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (!upload.error) {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }

    lastError = upload.error.message;
    if (!isBucketMissingError(upload.error.message)) {
      throw new Error(upload.error.message);
    }
  }

  throw new Error(lastError || 'Bucket upload tidak tersedia untuk dokumen verifikasi.');
}

async function updateProfileVerificationData(
  userId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const workingPayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabase
      .from('profiles')
      .update(workingPayload)
      .eq('id', userId)
      .select('*')
      .maybeSingle();

    if (!result.error) {
      return (result.data as Record<string, unknown> | null) ?? null;
    }

    const errorText = `${result.error.message} ${result.error.details ?? ''}`;
    const missingColumn = extractMissingColumnName(errorText);

    if (
      missingColumn &&
      missingColumn in workingPayload &&
      isMissingColumnError(errorText)
    ) {
      delete workingPayload[missingColumn];
      continue;
    }

    throw new Error(result.error.message);
  }

  throw new Error('Gagal menyimpan data verifikasi karena schema tidak kompatibel.');
}

export default function SettingsDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = (decodeURIComponent(params.slug) || '') as SettingsSlug;
  const meta = SETTINGS_DETAIL_META[slug];
  const toneClass = meta ? getDetailToneClasses(meta.tone) : null;
  const HeroIcon = meta?.icon;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
      <Link href="/settings">
        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/70 bg-background/80">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </Link>

      {meta && toneClass && HeroIcon && (
        <div className={`rounded-2xl border bg-card shadow-sm ${toneClass.container}`}>
          <div className={`flex items-start gap-3 rounded-2xl bg-gradient-to-r p-4 sm:items-center sm:p-5 ${toneClass.header}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass.badge}`}>
              <HeroIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{meta.title}</h1>
              <p className={`mt-1 text-sm ${toneClass.title}`}>{meta.description}</p>
            </div>
          </div>
        </div>
      )}

      {slug === 'security' && <SecuritySettings />}
      {slug === 'change-password' && <ChangePasswordSettings />}
      {slug === 'notifications' && <NotificationSettings />}
      {slug === 'theme' && <ThemeSettings />}
      {slug === 'language' && <LanguageSettings />}
      {slug === 'verification' && <VerificationSettings />}
      {slug === 'saved-posts' && <SavedPostsSettings />}
      {slug === 'blocked-users' && <BlockedUsersSettings />}

      {!meta && (
        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Pengaturan tidak ditemukan.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SecuritySettings() {
  const { user } = useAuth();

  return (
    <SettingsDetailCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Keamanan Akun"
      description="Informasi keamanan dasar akun Anda."
      tone="amber"
      contentClassName="space-y-4"
    >
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-semibold">{user?.email || '-'}</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">Status verifikasi email</p>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className={`h-4 w-4 ${user?.email_confirmed_at ? 'text-success' : 'text-ring'}`} />
            {user?.email_confirmed_at ? 'Terverifikasi' : 'Belum terverifikasi'}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">Terakhir login</p>
          <p className="text-sm font-semibold">
            {user?.last_sign_in_at
              ? new Date(user.last_sign_in_at).toLocaleString('id-ID')
              : '-'}
          </p>
        </div>

        <Link href="/settings/change-password">
          <Button className="h-11 w-full rounded-xl">Ubah Password</Button>
        </Link>
    </SettingsDetailCard>
  );
}

function ChangePasswordSettings() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }

    try {
      setIsSaving(true);
      await AuthService.updatePassword(newPassword);
      toast.success('Password berhasil diperbarui.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsDetailCard
      icon={<Lock className="h-5 w-5" />}
      title="Ubah Password"
      description="Gunakan kombinasi password yang kuat dan unik."
      tone="amber"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Password baru</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ulangi password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Password Baru'
            )}
          </Button>
        </form>
    </SettingsDetailCard>
  );
}

function NotificationSettings() {
  const { profile, updateProfile } = useAuth();
  const [pushNotification, setPushNotification] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(PUSH_NOTIFICATION_KEY) !== 'false';
  });
  const [emailNotification, setEmailNotification] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(EMAIL_NOTIFICATION_KEY) !== 'false';
  });
  const [allowMassInviteOverride, setAllowMassInviteOverride] = useState<boolean | null>(null);
  const [allowProfileChatOverride, setAllowProfileChatOverride] = useState<boolean | null>(null);
  const [isSavingMassInvite, setIsSavingMassInvite] = useState(false);
  const [isSavingProfileChat, setIsSavingProfileChat] = useState(false);

  const allowMassInvite = allowMassInviteOverride ?? Boolean(profile?.allow_mass_invite ?? true);
  const allowProfileChat = allowProfileChatOverride ?? Boolean(profile?.allow_profile_chat ?? true);

  const persistLocalSetting = (key: string, value: boolean) => {
    localStorage.setItem(key, value ? 'true' : 'false');
  };

  return (
    <SettingsDetailCard
      icon={<Bell className="h-5 w-5" />}
      title="Notifikasi"
      description="Kontrol notifikasi dan siapa yang bisa berinteraksi dari profil Anda."
      tone="emerald"
      contentClassName="space-y-4"
    >
        <SettingToggle
          title="Push notification"
          description="Notifikasi langsung di browser/perangkat."
          checked={pushNotification}
          onCheckedChange={(checked) => {
            setPushNotification(checked);
            persistLocalSetting(PUSH_NOTIFICATION_KEY, checked);
          }}
        />

        <SettingToggle
          title="Email notification"
          description="Ringkasan aktivitas via email."
          checked={emailNotification}
          onCheckedChange={(checked) => {
            setEmailNotification(checked);
            persistLocalSetting(EMAIL_NOTIFICATION_KEY, checked);
          }}
        />

        <SettingToggle
          title="Izinkan undangan misa"
          description="Orang lain dapat mengundang Anda ke radar misa."
          checked={allowMassInvite}
          isSaving={isSavingMassInvite}
          onCheckedChange={async (checked) => {
            const previous = allowMassInvite;
            setAllowMassInviteOverride(checked);
            setIsSavingMassInvite(true);
            try {
              await updateProfile({ allow_mass_invite: checked });
            } catch (error) {
              setAllowMassInviteOverride(previous);
              toast.error(error instanceof Error ? error.message : 'Gagal memperbarui preferensi.');
            } finally {
              setIsSavingMassInvite(false);
            }
          }}
        />

        <SettingToggle
          title="Izinkan chat dari profil"
          description="Tombol chat pada profil Anda bisa dipakai pengguna lain."
          checked={allowProfileChat}
          isSaving={isSavingProfileChat}
          onCheckedChange={async (checked) => {
            const previous = allowProfileChat;
            setAllowProfileChatOverride(checked);
            setIsSavingProfileChat(true);
            try {
              await updateProfile({ allow_profile_chat: checked });
            } catch (error) {
              setAllowProfileChatOverride(previous);
              toast.error(error instanceof Error ? error.message : 'Gagal memperbarui preferensi.');
            } finally {
              setIsSavingProfileChat(false);
            }
          }}
        />
    </SettingsDetailCard>
  );
}

function VerificationSettings() {
  const router = useRouter();
  const { profile, user, updateProfile } = useAuth();
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [baptismFile, setBaptismFile] = useState<File | null>(null);
  const [chrismFile, setChrismFile] = useState<File | null>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!profile || !user) {
    return (
      <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Data profil tidak ditemukan. Silakan login ulang.
        </CardContent>
      </Card>
    );
  }

  const status = getProfileVerificationState(profile);
  const trustBadge = getTrustBadge(profile);
  const isVerified = isProfileVerified(profile);
  const roleLabel = getProfileRoleLabel(profile);
  const clergyRole = isProfileClergy(profile);
  const catechumen = isProfileCatechumen(profile);
  const isUmatFlow = !clergyRole && !catechumen;
  const requiredChecklist = isUmatFlow
    ? [
        { label: 'Identitas Pribadi', ready: Boolean(identityFile) },
        { label: 'Surat Baptis', ready: Boolean(baptismFile) },
        { label: 'Persetujuan Verifikasi', ready: consentChecked },
      ]
    : clergyRole
      ? [
          { label: 'Surat Tugas Resmi', ready: Boolean(assignmentFile) },
        ]
      : [];
  const completedRequired = requiredChecklist.filter((item) => item.ready).length;
  const allRequiredCompleted =
    requiredChecklist.length === 0 || completedRequired === requiredChecklist.length;
  const uploadProgress = requiredChecklist.length === 0
    ? 100
    : Math.round((completedRequired / requiredChecklist.length) * 100);
  const missingRequired = requiredChecklist
    .filter((item) => !item.ready)
    .map((item) => item.label)
    .join(', ');

  const pickFile = (setter: (file: File | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setter(null);
      event.currentTarget.value = '';
      return;
    }

    if (file.size > VERIFICATION_FILE_MAX_SIZE) {
      toast.error('Ukuran file maksimal 10MB.');
      event.target.value = '';
      return;
    }

    setter(file);
    event.currentTarget.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id) {
      toast.error('User tidak terautentikasi.');
      return;
    }

    if (catechumen) {
      toast.info('Katekumen tidak wajib upload dokumen verifikasi.');
      return;
    }

    if (isUmatFlow) {
      if (!identityFile || !baptismFile) {
        toast.error('Dokumen identitas dan surat baptis wajib diupload.');
        return;
      }
      if (!consentChecked) {
        toast.error('Persetujuan verifikasi wajib dicentang.');
        return;
      }
    }

    if (clergyRole && !assignmentFile) {
      toast.error('Surat tugas wajib diupload untuk role rohaniwan.');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        verification_status: 'pending',
        account_status: 'pending',
        verification_submitted_at: now,
      };

      if (isUmatFlow) {
        const [identityUrl, baptismUrl, chrismUrl] = await Promise.all([
          uploadVerificationFile(user.id, identityFile as File, 'identity'),
          uploadVerificationFile(user.id, baptismFile as File, 'baptism'),
          chrismFile ? uploadVerificationFile(user.id, chrismFile, 'chrism') : Promise.resolve(null),
        ]);

        updates.ktp_url = identityUrl;
        updates.verification_document_url = identityUrl;
        updates.baptism_cert_url = baptismUrl;
        updates.baptism_document_url = baptismUrl;
        if (chrismUrl) {
          updates.chrism_cert_url = chrismUrl;
          updates.chrism_document_url = chrismUrl;
        }
        updates.faith_verification_consent_at = now;
      } else if (clergyRole && assignmentFile) {
        const assignmentUrl = await uploadVerificationFile(user.id, assignmentFile, 'assignment');
        updates.assignment_letter_url = assignmentUrl;
        updates.task_letter_url = assignmentUrl;
      }

      await updateProfileVerificationData(user.id, updates);

      // Refresh local auth store with core status fields.
      await updateProfile({
        verification_status: 'pending',
        account_status: 'pending',
      } as Partial<Profile>);

      setIdentityFile(null);
      setBaptismFile(null);
      setChrismFile(null);
      setAssignmentFile(null);
      setConsentChecked(false);
      toast.success('Dokumen verifikasi berhasil dikirim. Status Anda sekarang Menunggu Verifikasi.');
      router.push('/profile');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengirim dokumen verifikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsDetailCard
      icon={<FileCheck2 className="h-5 w-5" />}
      title="Verifikasi Akun"
      description="Unggah dokumen sesuai role untuk meningkatkan trust profil."
      tone="primary"
      contentClassName="space-y-4"
    >
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{roleLabel}</Badge>
            <Badge variant={isVerified ? 'default' : 'outline'}>
              {trustBadge.label}
            </Badge>
            {status === 'pending' && (
              <Badge variant="outline" className="gap-1">
                <Hourglass className="h-3.5 w-3.5" />
                Menunggu Review Admin
              </Badge>
            )}
          </div>
          <p className="mt-3 text-muted-foreground">
            {catechumen
              ? 'Sebagai Katekumen Anda tidak wajib mengunggah dokumen verifikasi dan tetap bisa menggunakan semua fitur.'
              : clergyRole
                ? 'Role rohaniwan wajib unggah Surat Tugas/Penugasan Resmi. KTP/Baptis/Krisma tidak diwajibkan.'
                : 'Role Umat wajib unggah dokumen identitas + surat baptis. Surat krisma bersifat opsional.'}
          </p>
        </div>

        {!catechumen && (
          <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Progress Kelengkapan Verifikasi</p>
              <Badge variant={allRequiredCompleted ? 'default' : 'outline'}>
                {completedRequired}/{requiredChecklist.length} lengkap
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            {allRequiredCompleted ? (
              <p className="text-xs text-emerald-700">Semua syarat wajib sudah lengkap. Anda bisa kirim verifikasi.</p>
            ) : (
              <p className="text-xs text-amber-700">Lengkapi dulu: {missingRequired}.</p>
            )}
          </div>
        )}

        {catechumen ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
            Katekumen tidak perlu upload dokumen pada tahap ini.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isUmatFlow && (
              <>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 sm:text-sm">
                  Wajib diisi: Identitas Pribadi + Surat Baptis + centang persetujuan.
                </div>
                <DocumentUploadField
                  id="identity-file"
                  label="Identitas Pribadi (KTP/SIM/Kartu Pelajar/Kartu Mahasiswa)"
                  required
                  file={identityFile}
                  disabled={isSubmitting}
                  onChange={pickFile(setIdentityFile)}
                  onClear={() => setIdentityFile(null)}
                />

                <DocumentUploadField
                  id="baptism-file"
                  label="Surat Baptis"
                  required
                  file={baptismFile}
                  disabled={isSubmitting}
                  onChange={pickFile(setBaptismFile)}
                  onClear={() => setBaptismFile(null)}
                />

                <DocumentUploadField
                  id="chrism-file"
                  label="Surat Krisma (Opsional)"
                  file={chrismFile}
                  disabled={isSubmitting}
                  onChange={pickFile(setChrismFile)}
                  onClear={() => setChrismFile(null)}
                />

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Persetujuan Verifikasi Data Iman</h3>
                  <p className="text-xs text-muted-foreground">
                    Saya bersedia dokumen sakramen diperiksa admin, disimpan secara aman, dapat diminta upload
                    ulang, dan memahami bahwa data palsu dapat menyebabkan penolakan atau pencabutan verifikasi.
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="verification-consent"
                      checked={consentChecked}
                      onCheckedChange={(checked) => setConsentChecked(Boolean(checked))}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="verification-consent" className="text-sm font-normal leading-5">
                      Saya setuju data iman diverifikasi sesuai ketentuan MyCatholic.
                    </Label>
                  </div>
                </div>
              </>
            )}

            {clergyRole && (
              <>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 sm:text-sm">
                  Wajib diisi: Surat Tugas / Surat Penugasan Resmi.
                </div>
                <DocumentUploadField
                  id="assignment-file"
                  label="Surat Tugas / Surat Penugasan Resmi"
                  required
                  file={assignmentFile}
                  disabled={isSubmitting}
                  onChange={pickFile(setAssignmentFile)}
                  onClear={() => setAssignmentFile(null)}
                />
              </>
            )}

            <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
              {!allRequiredCompleted && (
                <p className="text-xs text-amber-700">
                  Tombol aktif setelah semua syarat wajib lengkap.
                </p>
              )}
              <Button
                type="submit"
                className="h-11 w-full text-base font-semibold"
                disabled={isSubmitting || !allRequiredCompleted}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : allRequiredCompleted ? (
                  'Ajukan Verifikasi Sekarang'
                ) : (
                  'Lengkapi Dokumen Wajib'
                )}
              </Button>
            </div>
          </form>
        )}
    </SettingsDetailCard>
  );
}

function DocumentUploadField({
  id,
  label,
  required = false,
  file,
  disabled = false,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  required?: boolean;
  file: File | null;
  disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>

        {file ? (
          <Badge className="border border-emerald-500/35 bg-emerald-500/15 text-emerald-700">
            <CircleCheckBig className="mr-1 h-3.5 w-3.5" />
            Siap
          </Badge>
        ) : required ? (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Wajib
          </Badge>
        ) : (
          <Badge variant="secondary">Opsional</Badge>
        )}
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            htmlFor={id}
            className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors ${
              disabled
                ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-60'
                : file
                  ? 'cursor-pointer border border-border bg-background hover:bg-accent'
                  : 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {file ? 'Ganti Dokumen' : 'Pilih Dokumen'}
          </label>

          <input
            id={id}
            type="file"
            accept={VERIFICATION_ACCEPT}
            onChange={onChange}
            disabled={disabled}
            className="sr-only"
          />

          <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <p className="truncate text-muted-foreground">
              {file ? file.name : 'Belum ada file dipilih'}
            </p>
          </div>

          {file && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-muted-foreground"
              onClick={onClear}
              disabled={disabled}
            >
              <X className="mr-1 h-4 w-4" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Format: JPG/PNG/WEBP/PDF, max 10MB.</p>
    </div>
  );
}

function SavedPostsSettings() {
  const router = useRouter();
  const savedQuery = useSavedPosts();
  const posts = useMemo(
    () => savedQuery.data?.pages.flatMap((page) => page) ?? [],
    [savedQuery.data]
  );

  return (
    <SettingsDetailCard
      icon={<Bookmark className="h-5 w-5" />}
      title="Postingan Tersimpan"
      description="Semua postingan yang Anda simpan tampil di sini."
      tone="slate"
      contentClassName="space-y-4"
    >
        {savedQuery.isLoading ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
            Memuat postingan tersimpan...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
            Belum ada postingan tersimpan.
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => router.push(`/post/${post.id}`)} />
            ))}
            {savedQuery.hasNextPage && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => savedQuery.fetchNextPage()}
                disabled={savedQuery.isFetchingNextPage}
              >
                {savedQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  'Muat lebih banyak'
                )}
              </Button>
            )}
          </>
        )}
    </SettingsDetailCard>
  );
}

function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsDetailCard
      icon={<Moon className="h-5 w-5" />}
      title="Tema"
      description="Pilih mode tampilan sesuai kenyamanan Anda."
      tone="primary"
      contentClassName="grid gap-3 sm:grid-cols-2"
    >
        <ThemeButton
          active={theme === 'light'}
          icon={<Sun className="h-4 w-4" />}
          label="White Mode"
          onClick={() => setTheme('light')}
        />
        <ThemeButton
          active={theme === 'dark'}
          icon={<Moon className="h-4 w-4" />}
          label="Dark Mode"
          onClick={() => setTheme('dark')}
        />
    </SettingsDetailCard>
  );
}

function LanguageSettings() {
  const [language, setLanguage] = useState<'id' | 'en'>(() => {
    if (typeof window === 'undefined') return 'id';
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'id' || saved === 'en' ? saved : 'id';
  });

  const setLanguageValue = (value: 'id' | 'en') => {
    setLanguage(value);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    toast.success(`Bahasa diatur ke ${value === 'id' ? 'Indonesia' : 'English'}.`);
  };

  return (
    <SettingsDetailCard
      icon={<Globe className="h-5 w-5" />}
      title="Bahasa"
      description="Atur bahasa utama yang digunakan aplikasi."
      tone="primary"
      contentClassName="grid gap-3 sm:grid-cols-2"
    >
        <ThemeButton
          active={language === 'id'}
          icon={<Globe className="h-4 w-4" />}
          label="Indonesia"
          onClick={() => setLanguageValue('id')}
        />
        <ThemeButton
          active={language === 'en'}
          icon={<Globe className="h-4 w-4" />}
          label="English"
          onClick={() => setLanguageValue('en')}
        />
    </SettingsDetailCard>
  );
}

function BlockedUsersSettings() {
  const { data: blockedUsers = [], isLoading } = useBlockedUsers();
  const { mutateAsync: unblockUser, isPending: isUnblocking } = useUnblockUser();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const handleUnblock = async (userId: string) => {
    setActiveUserId(userId);
    try {
      await unblockUser(userId);
    } finally {
      setActiveUserId(null);
    }
  };

  return (
    <SettingsDetailCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Pengguna Diblokir"
      description="Kelola daftar akun yang tidak bisa berinteraksi dengan Anda."
      tone="slate"
      contentClassName="space-y-2 text-sm text-muted-foreground"
    >
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Memuat daftar blokir...</p>
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-center">
            <p className="text-sm font-medium text-foreground">Belum ada pengguna diblokir</p>
            <p className="mt-1 text-xs text-muted-foreground">
              User yang Anda blokir akan muncul di sini dan bisa dibuka blokirnya kapan saja.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((blockedUser) => {
              const fullName = blockedUser.full_name?.trim() || 'Umat';
              const initials = fullName
                .split(' ')
                .map((part) => part[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const isActive = activeUserId === blockedUser.id;

              return (
                <div
                  key={blockedUser.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/70">
                      <AvatarImage src={blockedUser.avatar_url} alt={fullName} />
                      <AvatarFallback>{initials || 'US'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Diblokir pada {new Date(blockedUser.blocked_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUnblocking}
                    onClick={() => void handleUnblock(blockedUser.id)}
                    className="w-full rounded-lg sm:w-auto"
                  >
                    {isActive && isUnblocking ? 'Membuka blokir...' : 'Buka blokir'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
    </SettingsDetailCard>
  );
}

function SettingsDetailCard({
  icon,
  title,
  description,
  tone = 'slate',
  contentClassName,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: DetailTone;
  contentClassName?: string;
  children: ReactNode;
}) {
  const toneClass = getDetailToneClasses(tone);

  return (
    <Card className={`overflow-hidden rounded-2xl bg-card/95 shadow-sm ${toneClass.container}`}>
      <CardHeader className={`border-b border-border/60 bg-gradient-to-r px-4 py-3 sm:px-5 ${toneClass.header}`}>
        <CardTitle className="flex items-start gap-3 text-base sm:items-center sm:text-lg">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:mt-0 ${toneClass.badge}`}>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{title}</span>
            <span className={`mt-1 block text-xs font-normal leading-relaxed ${toneClass.title}`}>{description}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={`p-4 sm:p-5 ${contentClassName ?? ''}`}>
        {children}
      </CardContent>
    </Card>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  isSaving = false,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  isSaving?: boolean;
  onCheckedChange: (checked: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
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

function ThemeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className={`h-11 justify-start rounded-xl border transition-all ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-border/70 bg-background hover:border-primary/30 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
      {active && <CheckCircle2 className="ml-auto h-4 w-4" />}
    </Button>
  );
}
