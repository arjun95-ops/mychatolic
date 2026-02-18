import { ROLE_LABELS } from '@/lib/constants';
import type { Profile } from '@/lib/types';

type TrustTone = 'success' | 'primary' | 'warning' | 'danger' | 'muted';

const CLERGY_ROLES = new Set(['pastor', 'suster', 'bruder', 'frater', 'katekis']);

function normalizeText(value: unknown): string {
  if (value == null) return '';
  return value.toString().trim().toLowerCase();
}

function sanitizeName(value: unknown): string {
  const text = value?.toString().trim() ?? '';
  if (!text) return '';
  const normalized = text.toLowerCase();
  if (normalized === 'null' || normalized === 'undefined') return '';
  return text;
}

function readName(value: unknown): string {
  if (typeof value === 'string') {
    return sanitizeName(value);
  }

  if (value && typeof value === 'object' && 'name' in value) {
    return sanitizeName((value as { name?: unknown }).name);
  }

  return '';
}

export type ProfileVerificationState =
  | 'unverified'
  | 'pending'
  | 'verified_catholic'
  | 'verified_pastoral'
  | 'rejected'
  | 'banned';

export function getProfileVerificationState(profile?: Profile | null): ProfileVerificationState {
  const rawStatus = normalizeText(profile?.account_status ?? profile?.verification_status ?? 'unverified');

  if (rawStatus === 'pending') return 'pending';
  if (rawStatus === 'verified_pastoral') return 'verified_pastoral';
  if (rawStatus === 'verified_catholic' || rawStatus === 'verified' || rawStatus === 'approved') {
    return 'verified_catholic';
  }
  if (rawStatus === 'rejected') return 'rejected';
  if (rawStatus === 'banned') return 'banned';
  return 'unverified';
}

export function getProfileRoleKey(profile?: Profile | null): string {
  return normalizeText(profile?.role) || 'umat';
}

export function getProfileRoleLabel(profile?: Profile | null): string {
  const roleKey = getProfileRoleKey(profile);
  return ROLE_LABELS[roleKey] || roleKey.slice(0, 1).toUpperCase() + roleKey.slice(1);
}

export function isProfileClergy(profile?: Profile | null): boolean {
  return CLERGY_ROLES.has(getProfileRoleKey(profile));
}

export function isProfileCatechumen(profile?: Profile | null): boolean {
  if (!profile) return false;
  const faith = normalizeText(profile.faith_status);
  const role = getProfileRoleKey(profile);
  return Boolean(profile.is_catechumen) || faith === 'catechumen' || role === 'katekumen';
}

export function isProfileVerified(profile?: Profile | null): boolean {
  const status = getProfileVerificationState(profile);
  return status === 'verified_catholic' || status === 'verified_pastoral';
}

export function getTrustBadge(profile?: Profile | null): { label: string; tone: TrustTone } {
  if (!profile) return { label: 'Belum Verifikasi', tone: 'danger' };

  const status = getProfileVerificationState(profile);
  if (status === 'verified_catholic' || status === 'verified_pastoral') {
    if (isProfileClergy(profile)) {
      return { label: `${getProfileRoleLabel(profile)} Terverifikasi`, tone: 'primary' };
    }
    return { label: '100% Katolik', tone: 'success' };
  }

  if (status === 'pending') return { label: 'Menunggu Verifikasi', tone: 'warning' };
  if (isProfileCatechumen(profile)) return { label: 'Katekumen', tone: 'muted' };
  if (status === 'rejected') return { label: 'Verifikasi Ditolak', tone: 'danger' };
  if (status === 'banned') return { label: 'Akun Dibatasi', tone: 'danger' };
  return { label: 'Belum Verifikasi', tone: 'danger' };
}

export function getProfileAge(profile?: Profile | null): number | null {
  const birthDate = profile?.birth_date?.toString().trim();
  if (!birthDate) return null;

  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const hasNotHadBirthday =
    today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate());

  if (hasNotHadBirthday) age -= 1;
  if (age < 0) return null;
  return age;
}

export function shouldShowProfileAge(profile?: Profile | null): boolean {
  const age = getProfileAge(profile);
  return age != null && age < 18;
}

export function getProfileLocation(profile?: Profile | null): {
  country: string;
  diocese: string;
  parish: string;
  line1: string;
  line2: string;
} {
  if (!profile) {
    return { country: '', diocese: '', parish: '', line1: '-', line2: 'Paroki -' };
  }

  const raw = profile as unknown as Record<string, unknown>;
  const country =
    readName(raw.country) ||
    sanitizeName(raw.country_text) ||
    readName(raw.countries);
  const diocese =
    readName(raw.diocese) ||
    sanitizeName(raw.diocese_text) ||
    readName(raw.dioceses);
  const parish =
    readName(raw.church) ||
    sanitizeName(raw.parish) ||
    sanitizeName(raw.parish_text) ||
    readName(raw.churches);

  const firstParts = [country, diocese].filter((part) => part.length > 0);
  return {
    country,
    diocese,
    parish,
    line1: firstParts.length > 0 ? firstParts.join(', ') : '-',
    line2: parish || 'Paroki -',
  };
}

export function canReceiveMassInvite(profile?: Profile | null): boolean {
  if (!profile) return false;
  const allowMassInvite = Boolean(profile.allow_mass_invite ?? true);
  const role = getProfileRoleKey(profile);
  const roleAllowed = role === 'umat' || role === 'katekumen';
  return allowMassInvite && (roleAllowed || isProfileCatechumen(profile));
}

export function canReceiveProfileChat(profile?: Profile | null): boolean {
  return Boolean(profile?.allow_profile_chat ?? true);
}
