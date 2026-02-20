// Home / Feed Page

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Church,
  Flame,
  Globe,
  Landmark,
  MapPin,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { PostCard } from '@/components/feed/post-card';
import { StoryRail } from '@/components/stories/story-rail';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { usePosts } from '@/lib/features/feed/use-posts';
import { FeedService } from '@/lib/features/feed/feed-service';
import { InfiniteScroll } from '@/components/shared/infinite-scroll';
import { getProfileLocation } from '@/lib/features/profile/profile-status';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase/client';
import { AuthService, type AuthLocationOption } from '@/lib/features/auth/auth-service';
import {
  PRIORITY_ALGORITHM_VERSION,
  rankPriorityFeed,
  type PriorityMode,
} from '@/lib/features/feed/priority-ranking';

type ScopeKey = 'all' | 'country' | 'diocese' | 'parish';

type ScopeOption = {
  key: ScopeKey;
  label: string;
  description: string;
  icon: LucideIcon;
  scopeId?: string;
};

type RadarSource = 'legacy' | 'v2';

type HomeRadarItem = {
  id: string;
  source: RadarSource;
  title: string;
  description?: string;
  startsAt?: string;
  maxParticipants?: number;
  participantCount: number;
  churchName?: string;
  creatorId?: string;
  creatorName?: string;
  creatorAvatarUrl?: string;
};

type RadarParticipantCountRow = {
  radar_id?: unknown;
  user_id?: unknown;
  status?: unknown;
};

const PRIORITY_MODE_STORAGE_KEY = 'feed:priority-mode:v1';
const FEED_SCOPE_STORAGE_KEY = 'feed:scope:v1';
const SCOPE_MODE_META: Array<{ key: ScopeKey; label: string; icon: LucideIcon }> = [
  { key: 'all', label: 'All Feed', icon: Globe },
  { key: 'country', label: 'Negara', icon: Landmark },
  { key: 'diocese', label: 'Keuskupan', icon: Church },
  { key: 'parish', label: 'Paroki', icon: Sparkles },
];

function isPriorityMode(value: string): value is PriorityMode {
  return value === 'hot' || value === 'latest' || value === 'discussed';
}

type PersistedFeedScope = {
  scopeKey: ScopeKey;
  countryId: string;
  countryName: string;
  dioceseId: string;
  dioceseName: string;
  parishId: string;
  parishName: string;
};

function isScopeKey(value: string): value is ScopeKey {
  return value === 'all' || value === 'country' || value === 'diocese' || value === 'parish';
}

function normalizePersistedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePersistedFeedScope(raw: string): PersistedFeedScope | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rawScopeKey = normalizePersistedText(parsed.scopeKey);
    if (!isScopeKey(rawScopeKey)) return null;

    return {
      scopeKey: rawScopeKey,
      countryId: normalizePersistedText(parsed.countryId),
      countryName: normalizePersistedText(parsed.countryName),
      dioceseId: normalizePersistedText(parsed.dioceseId),
      dioceseName: normalizePersistedText(parsed.dioceseName),
      parishId: normalizePersistedText(parsed.parishId),
      parishName: normalizePersistedText(parsed.parishName),
    };
  } catch {
    return null;
  }
}

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function readErrorMessage(error: unknown) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    const raw = JSON.stringify(error);
    return raw === '{}' ? '' : raw;
  } catch {
    return '';
  }
}

function isSchemaCompatibilityError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('42703') ||
    normalized.includes('42p01')
  );
}

function normalizeMembershipStatus(value: unknown) {
  return value?.toString().trim().toUpperCase() || '';
}

function isJoinedMembershipStatus(status: string) {
  if (!status) return true;
  return ['JOINED', 'HOST', 'MEMBER', 'APPROVED', 'ACCEPTED'].includes(status);
}

function formatRadarDateLabel(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'EEE, d MMM HH:mm', { locale: localeId });
}

type SearchableScopeSelectProps = {
  label: string;
  value: string;
  selectedLabel: string;
  options: AuthLocationOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
  clearMessage?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

function SearchableScopeSelect({
  label,
  value,
  selectedLabel,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  clearMessage = 'Tidak dipilih',
  searchValue,
  onSearchChange,
  onValueChange,
  onClear,
  disabled = false,
  isLoading = false,
}: SearchableScopeSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerLabel = selectedLabel || (isLoading ? loadingMessage : placeholder);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen && searchValue) {
            onSearchChange('');
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-10 w-full justify-between rounded-xl border-border bg-background/80 px-3 font-normal',
              !selectedLabel && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] rounded-xl border-border bg-card p-0">
          <Command shouldFilter={false} className="rounded-xl bg-transparent">
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={onSearchChange}
            />
            <CommandList className="max-h-64">
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                  }}
                >
                  <Check className={cn('h-4 w-4', !value ? 'text-primary opacity-100' : 'opacity-0')} />
                  <span className="truncate">{clearMessage}</span>
                </CommandItem>
              </CommandGroup>
              {isLoading ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">{loadingMessage}</p>
              ) : options.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                <CommandGroup>
                  {options.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.name}-${item.id}`}
                      onSelect={() => {
                        onValueChange(item.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('h-4 w-4', value === item.id ? 'text-primary opacity-100' : 'opacity-0')} />
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

async function fetchRadarParticipantCountRows(
  table: 'radar_participants' | 'radar_participants_v2',
  ids: string[]
): Promise<RadarParticipantCountRow[]> {
  if (ids.length === 0) return [];

  const selectAttempts = [
    'radar_id, user_id, status',
    'radar_id, user_id',
    'radar_id, status',
    'radar_id',
  ];

  for (const selectColumns of selectAttempts) {
    const result = await supabase.from(table).select(selectColumns).in('radar_id', ids);
    if (!result.error) {
      return (result.data ?? []) as RadarParticipantCountRow[];
    }
    if (!isSchemaCompatibilityError(result.error.message)) {
      console.error(`Error fetching radar participants from ${table}:`, readErrorMessage(result.error));
      return [];
    }
  }

  return [];
}

async function fetchHomeRadarEvents(limit = 2): Promise<HomeRadarItem[]> {
  const legacyWithVisibility = await supabase
    .from('radar_events')
    .select('id, title, description, event_time, max_participants, church_id, creator_id, status, visibility')
    .order('event_time', { ascending: false })
    .limit(40);
  const legacy =
    legacyWithVisibility.error && isSchemaCompatibilityError(legacyWithVisibility.error.message)
      ? await supabase
        .from('radar_events')
        .select('id, title, description, event_time, max_participants, church_id, creator_id, status')
        .order('event_time', { ascending: false })
        .limit(40)
      : legacyWithVisibility;

  const v2WithVisibility = await supabase
    .from('radar_events_v2')
    .select('id, title, description, event_starts_at_utc, max_participants, church_id, creator_id, status, visibility')
    .order('event_starts_at_utc', { ascending: false })
    .limit(40);
  const v2 =
    v2WithVisibility.error && isSchemaCompatibilityError(v2WithVisibility.error.message)
      ? await supabase
        .from('radar_events_v2')
        .select('id, title, description, event_starts_at_utc, max_participants, church_id, creator_id, status')
        .order('event_starts_at_utc', { ascending: false })
        .limit(40)
      : v2WithVisibility;

  if (legacy.error && v2.error) {
    const legacyMessage = readErrorMessage(legacy.error);
    const v2Message = readErrorMessage(v2.error);
    throw new Error(legacyMessage || v2Message || 'Gagal memuat radar');
  }

  const combinedRows: Array<Record<string, unknown> & { __source: RadarSource }> = [
    ...((legacy.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...row,
      __source: 'legacy' as const,
    })),
    ...((v2.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...row,
      __source: 'v2' as const,
    })),
  ];

  const uniqueById = new Map<string, Record<string, unknown> & { __source: RadarSource }>();
  for (const row of combinedRows) {
    const id = row.id?.toString();
    if (!id) continue;
    if (!uniqueById.has(id) || row.__source === 'v2') {
      uniqueById.set(id, row);
    }
  }

  const rows = Array.from(uniqueById.values()).filter((row) => {
    const visibility = row.visibility?.toString().trim().toUpperCase();
    const status = row.status?.toString().trim().toUpperCase();
    const isPublic = !visibility || visibility === 'PUBLIC';
    const isVisibleStatus =
      !status || ['PUBLISHED', 'UPDATED', 'ACTIVE', 'SCHEDULED'].includes(status);
    return isPublic && isVisibleStatus;
  });

  if (rows.length === 0) {
    return [];
  }

  const ids = rows
    .map((row) => row.id?.toString())
    .filter((value): value is string => Boolean(value));
  const churchIds = rows
    .map((row) => row.church_id?.toString())
    .filter((value): value is string => Boolean(value));
  const creatorIds = rows
    .map((row) => row.creator_id?.toString())
    .filter((value): value is string => Boolean(value));

  const [churchResult, legacyParticipants, v2Participants, profileResult] = await Promise.all([
    churchIds.length > 0
      ? supabase.from('churches').select('id, name').in('id', churchIds)
      : Promise.resolve({ data: [], error: null }),
    fetchRadarParticipantCountRows('radar_participants', ids),
    fetchRadarParticipantCountRows('radar_participants_v2', ids),
    creatorIds.length > 0
      ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const churchMap = new Map<string, string>();
  if (!churchResult.error) {
    for (const row of (churchResult.data ?? []) as Record<string, unknown>[]) {
      const id = row.id?.toString();
      if (!id) continue;
      churchMap.set(id, row.name?.toString() || 'Gereja');
    }
  }

  const participantMap = new Map<string, number>();
  const participantKeysByRadar = new Map<string, Set<string>>();
  const allParticipants = [
    ...legacyParticipants.map((row, index) => ({ ...row, __source: 'legacy' as const, __idx: index })),
    ...v2Participants.map((row, index) => ({ ...row, __source: 'v2' as const, __idx: index })),
  ];
  for (const row of allParticipants) {
    const radarId = row.radar_id?.toString();
    if (!radarId) continue;

    const status = normalizeMembershipStatus(row.status);
    if (!isJoinedMembershipStatus(status)) continue;

    const userId = row.user_id?.toString().trim();
    const participantKey = userId || `__anon__${row.__source}_${row.__idx}`;
    if (!participantKeysByRadar.has(radarId)) {
      participantKeysByRadar.set(radarId, new Set());
    }
    participantKeysByRadar.get(radarId)?.add(participantKey);
  }
  for (const [radarId, participants] of participantKeysByRadar.entries()) {
    participantMap.set(radarId, participants.size);
  }

  const profileMap = new Map<string, { fullName?: string; avatarUrl?: string }>();
  if (!profileResult.error) {
    for (const row of (profileResult.data ?? []) as Record<string, unknown>[]) {
      const id = row.id?.toString();
      if (!id) continue;
      profileMap.set(id, {
        fullName: row.full_name?.toString(),
        avatarUrl: row.avatar_url?.toString(),
      });
    }
  }

  return rows
    .map((row) => {
      const id = row.id?.toString() || '';
      const startsAt = row.event_starts_at_utc?.toString() || row.event_time?.toString();
      const creatorId = row.creator_id?.toString();
      const creator = creatorId ? profileMap.get(creatorId) : undefined;
      const churchId = row.church_id?.toString();

      return {
        id,
        source: row.__source,
        title: row.title?.toString() || 'Radar Misa',
        description: row.description?.toString(),
        startsAt,
        maxParticipants: Number(row.max_participants ?? 0) || undefined,
        participantCount: participantMap.get(id) ?? 0,
        churchName: churchMap.get(churchId || ''),
        creatorId,
        creatorName: creator?.fullName || 'Umat',
        creatorAvatarUrl: creator?.avatarUrl,
      } satisfies HomeRadarItem;
    })
    .filter((item) => item.id.trim().length > 0)
    .sort((a, b) => {
      const aTime = new Date(a.startsAt || '').getTime();
      const bTime = new Date(b.startsAt || '').getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    })
    .slice(0, limit);
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openCreatePost } = useUIStore();
  const location = getProfileLocation(profile);
  const initialCountryName = location.country || profile?.country_text?.trim() || '';
  const initialDioceseName = location.diocese || profile?.diocese_text?.trim() || '';
  const initialParishName = location.parish || profile?.parish_text?.trim() || '';

  const [countryId, setCountryId] = useState(profile?.country_id || '');
  const [dioceseId, setDioceseId] = useState(profile?.diocese_id || '');
  const [parishId, setParishId] = useState(profile?.church_id || '');
  const [countryName, setCountryName] = useState(initialCountryName);
  const [dioceseName, setDioceseName] = useState(initialDioceseName);
  const [parishName, setParishName] = useState(initialParishName);
  const [countries, setCountries] = useState<AuthLocationOption[]>([]);
  const [dioceses, setDioceses] = useState<AuthLocationOption[]>([]);
  const [parishes, setParishes] = useState<AuthLocationOption[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingDioceses, setIsLoadingDioceses] = useState(false);
  const [isLoadingParishes, setIsLoadingParishes] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [dioceseSearch, setDioceseSearch] = useState('');
  const [parishSearch, setParishSearch] = useState('');
  const [scopeKey, setScopeKey] = useState<ScopeKey>('all');
  const [didLoadPersistedScope, setDidLoadPersistedScope] = useState(false);
  const [isScopeDialogOpen, setIsScopeDialogOpen] = useState(false);
  const [isPriorityDialogOpen, setIsPriorityDialogOpen] = useState(false);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>(() => {
    if (typeof window === 'undefined') return 'hot';
    try {
      const stored = window.localStorage.getItem(PRIORITY_MODE_STORAGE_KEY);
      if (stored && isPriorityMode(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage read errors.
    }
    return 'hot';
  });
  const debouncedCountrySearch = useDebouncedValue(countrySearch);
  const debouncedDioceseSearch = useDebouncedValue(dioceseSearch);
  const debouncedParishSearch = useDebouncedValue(parishSearch);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FEED_SCOPE_STORAGE_KEY);
      if (raw) {
        const persisted = parsePersistedFeedScope(raw);
        if (persisted) {
          setScopeKey(persisted.scopeKey);
          setCountryId(persisted.countryId);
          setCountryName(persisted.countryName);
          setDioceseId(persisted.dioceseId);
          setDioceseName(persisted.dioceseName);
          setParishId(persisted.parishId);
          setParishName(persisted.parishName);
        }
      }
    } catch {
      // Ignore storage read errors.
    } finally {
      setDidLoadPersistedScope(true);
    }
  }, []);

  useEffect(() => {
    if (!isScopeDialogOpen) return;
    let active = true;
    void (async () => {
      if (active) setIsLoadingCountries(true);
      try {
        const result = await AuthService.getCountries(debouncedCountrySearch);
        if (!active) return;
        setCountries(result);
      } catch (error) {
        console.error('Gagal memuat negara:', readErrorMessage(error));
      } finally {
        if (active) setIsLoadingCountries(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isScopeDialogOpen, debouncedCountrySearch]);

  useEffect(() => {
    if (!isScopeDialogOpen) return;
    let active = true;
    void (async () => {
      if (active) setIsLoadingDioceses(true);
      try {
        const result = await AuthService.getDioceses(countryId, debouncedDioceseSearch);
        if (!active) return;
        setDioceses(result);
      } catch (error) {
        console.error('Gagal memuat keuskupan:', readErrorMessage(error));
      } finally {
        if (active) setIsLoadingDioceses(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isScopeDialogOpen, countryId, debouncedDioceseSearch]);

  useEffect(() => {
    if (!isScopeDialogOpen) return;
    let active = true;
    void (async () => {
      if (active) setIsLoadingParishes(true);
      try {
        const result = await AuthService.getParishes(dioceseId, debouncedParishSearch);
        if (!active) return;
        setParishes(result);
      } catch (error) {
        console.error('Gagal memuat paroki:', readErrorMessage(error));
      } finally {
        if (active) setIsLoadingParishes(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isScopeDialogOpen, dioceseId, debouncedParishSearch]);

  const selectedCountry = useMemo(
    () => countries.find((item) => item.id === countryId) ?? null,
    [countries, countryId]
  );
  const selectedDiocese = useMemo(
    () => dioceses.find((item) => item.id === dioceseId) ?? null,
    [dioceses, dioceseId]
  );
  const selectedParish = useMemo(
    () => parishes.find((item) => item.id === parishId) ?? null,
    [parishes, parishId]
  );

  const effectiveCountryId = countryId;
  const effectiveDioceseId = dioceseId;
  const effectiveParishId = parishId;

  const resolvedCountryName = (
    selectedCountry?.name?.trim() ||
    countryName ||
    location.country ||
    profile?.country_text?.trim() ||
    ''
  ).trim();
  const resolvedDioceseName = (
    selectedDiocese?.name?.trim() ||
    dioceseName ||
    location.diocese ||
    profile?.diocese_text?.trim() ||
    ''
  ).trim();
  const resolvedParishName = (
    selectedParish?.name?.trim() ||
    parishName ||
    location.parish ||
    profile?.parish_text?.trim() ||
    ''
  ).trim();

  const scopeOptions: ScopeOption[] = [
    {
      key: 'all',
      label: 'All Feed',
      description: 'Semua postingan komunitas',
      icon: Globe,
    },
    {
      key: 'country',
      label: resolvedCountryName || 'Negara',
      description: 'Postingan satu negara',
      icon: Landmark,
      scopeId: effectiveCountryId || undefined,
    },
    {
      key: 'diocese',
      label: resolvedDioceseName || 'Keuskupan',
      description: 'Postingan satu keuskupan',
      icon: Church,
      scopeId: effectiveDioceseId || undefined,
    },
    {
      key: 'parish',
      label: resolvedParishName || 'Paroki',
      description: 'Postingan satu paroki',
      icon: Sparkles,
      scopeId: effectiveParishId || undefined,
    },
  ];

  const resolvedScopeKey = scopeOptions.some((option) => option.key === scopeKey) ? scopeKey : 'all';
  const activeScope = scopeOptions.find((option) => option.key === resolvedScopeKey) ?? scopeOptions[0];
  const isScopeSelectionReady = activeScope.key === 'all' || Boolean(activeScope.scopeId);
  const activeScopeDescription = isScopeSelectionReady
    ? activeScope.description
    : activeScope.key === 'country'
      ? 'Pilih negara terlebih dahulu untuk memfilter feed.'
      : activeScope.key === 'diocese'
        ? 'Pilih keuskupan terlebih dahulu untuk memfilter feed.'
        : 'Pilih paroki terlebih dahulu untuk memfilter feed.';
  const activeScopeModeLabel = SCOPE_MODE_META.find((item) => item.key === resolvedScopeKey)?.label ?? 'All Feed';
  const ActiveScopeIcon = activeScope.icon;
  const feedScopeLabel = isScopeSelectionReady ? activeScope.label : 'All Feed';
  const postQueryParams =
    activeScope.key === 'all' || !isScopeSelectionReady
      ? undefined
      : {
          scope: activeScope.key,
          scopeId: activeScope.scopeId,
        };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError: isPostsError,
    error: postsError,
    refetch: refetchPosts,
  } = usePosts(postQueryParams);
  const {
    data: homeRadars = [],
    isLoading: isHomeRadarsLoading,
    isError: isHomeRadarsError,
    error: homeRadarsError,
    refetch: refetchHomeRadars,
  } = useQuery({
    queryKey: ['home-radar-events'],
    queryFn: () => fetchHomeRadarEvents(2),
    staleTime: 1000 * 45,
    enabled: Boolean(user?.id),
  });
  const {
    data: priorityFeedSnapshot = [],
    isLoading: isPrioritySnapshotLoading,
    isError: isPrioritySnapshotError,
    error: prioritySnapshotError,
    refetch: refetchPrioritySnapshot,
  } = useQuery({
    queryKey: ['priority-feed-snapshot', postQueryParams, user?.id],
    queryFn: async () => {
      const result = await FeedService.getPosts({
        page: 1,
        limit: 60,
        currentUserId: user?.id,
        ...(postQueryParams ?? {}),
      });
      return result.posts;
    },
    enabled: Boolean(user?.id && isPriorityDialogOpen),
    staleTime: 1000 * 45,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const prioritySourcePosts = priorityFeedSnapshot.length > 0 ? priorityFeedSnapshot : posts;
  const priorityPosts = useMemo(
    () => rankPriorityFeed(prioritySourcePosts, priorityMode, 5),
    [prioritySourcePosts, priorityMode]
  );
  const initials =
    profile?.full_name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';
  const scopeChipLabel =
    activeScope.key === 'all'
      ? 'ALL'
      : activeScope.scopeId
        ? activeScope.label
        : activeScope.key === 'country'
          ? 'Pilih negara'
          : activeScope.key === 'diocese'
            ? 'Pilih keuskupan'
            : 'Pilih paroki';
  const scopeOriginText =
    !isScopeSelectionReady || resolvedScopeKey === 'all'
      ? '📍 dari berbagai paroki'
      : resolvedScopeKey === 'parish'
      ? null
      : `📍 dari ${activeScope.label}`;
  const hasPriority = priorityPosts.length > 0;

  useEffect(() => {
    if (!didLoadPersistedScope) return;
    try {
      const payload: PersistedFeedScope = {
        scopeKey,
        countryId: countryId.trim(),
        countryName: countryName.trim(),
        dioceseId: dioceseId.trim(),
        dioceseName: dioceseName.trim(),
        parishId: parishId.trim(),
        parishName: parishName.trim(),
      };
      window.localStorage.setItem(FEED_SCOPE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors.
    }
  }, [didLoadPersistedScope, scopeKey, countryId, countryName, dioceseId, dioceseName, parishId, parishName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRIORITY_MODE_STORAGE_KEY, priorityMode);
    } catch {
      // Ignore storage write errors.
    }
  }, [priorityMode]);

  return (
    <section className="mx-auto w-full max-w-[860px] space-y-3 sm:space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
        <div className="signature-gradient px-5 pb-5 pt-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Menu Beranda</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">MyCatholic</h1>
          <p className="mt-1 text-sm text-white/85">
            Ruang berbagi kabar umat, doa, dan aktivitas komunitas.
          </p>
        </div>
        <div className="border-t border-border/50 bg-card px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScopeDialogOpen(true)}
              className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted/35 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/55"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{scopeChipLabel}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-10 w-10 rounded-full border-border bg-card"
              onClick={() => setIsPriorityDialogOpen(true)}
            >
              <Flame className={cn('h-5 w-5', hasPriority ? 'animate-pulse text-[#ef4444]' : 'text-muted-foreground')} />
              {hasPriority && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ef4444]" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{activeScopeDescription}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <CardContent className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Stories</h2>
            <span className="text-xs text-muted-foreground">24 jam terakhir</span>
          </div>
          <StoryRail />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0 border border-border">
                <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={openCreatePost}
                className="h-14 w-full rounded-2xl border border-border bg-muted/25 px-4 text-left transition-colors hover:bg-muted/45"
              >
                <span className="block truncate text-sm font-semibold text-foreground">
                  {profile?.full_name?.trim() || 'Pengguna'}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  Bagikan kabar sukacita, warta, atau intensi doa kepada umat...
                </span>
              </button>
            </div>
            <Button onClick={openCreatePost} className="h-11 w-full shrink-0 rounded-full px-6 sm:w-auto">
              Buat postingan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Ajakan Radar Misa</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => router.push('/radar')}
            >
              Lihat semua
            </Button>
          </div>

          {isHomeRadarsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : isHomeRadarsError ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-5 text-center">
              <p className="text-sm font-medium">Gagal memuat radar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {readErrorMessage(homeRadarsError) || 'Terjadi kendala saat mengambil data radar.'}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 rounded-full px-3 text-xs"
                onClick={() => void refetchHomeRadars()}
              >
                Coba lagi
              </Button>
            </div>
          ) : homeRadars.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
              <p className="text-sm font-medium">Belum ada radar publik</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Buka menu Radar untuk membuat atau mencari ajakan misa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {homeRadars.map((radar) => {
                const isHost = Boolean(user?.id && radar.creatorId === user.id);
                const dateLabel = formatRadarDateLabel(radar.startsAt);

                return (
                  <div
                    key={radar.id}
                    className="rounded-xl border border-border bg-background/55 px-3 py-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarImage src={radar.creatorAvatarUrl} alt={radar.creatorName || 'Umat'} />
                          <AvatarFallback className="text-[10px]">
                            {(radar.creatorName || 'U')
                              .split(' ')
                              .map((item) => item[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{radar.creatorName || 'Umat'}</p>
                          <p className="text-[11px] text-muted-foreground">Membuat ajakan baru</p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => router.push(`/radar/${encodeURIComponent(radar.id)}`)}
                      >
                        {isHost ? 'Detail' : 'Gabung'}
                      </Button>
                    </div>

                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{radar.title}</p>
                    {radar.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{radar.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {dateLabel && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {dateLabel}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {radar.participantCount}
                        {radar.maxParticipants ? `/${radar.maxParticipants}` : ''} peserta
                      </span>
                      {radar.churchName && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {radar.churchName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => <PostCardSkeleton key={index} />)
        ) : isPostsError && posts.length === 0 ? (
          <Card className="border-border bg-card p-8 text-center sm:p-12">
            <h3 className="text-lg font-semibold">Feed gagal dimuat</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {readErrorMessage(postsError) || 'Terjadi kendala saat memuat postingan.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchPosts()}
              className="mt-4 w-full rounded-full px-6 sm:w-auto"
            >
              Coba lagi
            </Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="border-border bg-card p-8 text-center sm:p-12">
            <div className="mb-3 text-4xl">🕊️</div>
            <h3 className="text-lg font-semibold">Feed masih kosong</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Belum ada posting untuk scope <span className="font-semibold">{feedScopeLabel}</span>.
            </p>
            <Button onClick={openCreatePost} className="mt-4 w-full rounded-full px-6 sm:w-auto">
              Buat Postingan
            </Button>
          </Card>
        ) : (
          <>
            <InfiniteScroll
              hasMore={hasNextPage || false}
              loadMore={async () => {
                await fetchNextPage();
              }}
              isLoading={isFetchingNextPage}
            >
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  originText={scopeOriginText}
                  onClick={() => router.push(`/post/${post.id}`)}
                />
              ))}
            </InfiniteScroll>

            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isPriorityDialogOpen} onOpenChange={setIsPriorityDialogOpen}>
        <DialogContent className="max-w-[560px] border-border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle>Priority Hub</DialogTitle>
            <DialogDescription>
              Ringkasan postingan prioritas untuk lingkup feed aktif.
              {priorityFeedSnapshot.length > 0
                ? ' Disusun dari snapshot feed terbaru.'
                : ' Menampilkan data sementara dari postingan yang sudah dimuat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-2 py-2">
            <Button
              type="button"
              size="sm"
              variant={priorityMode === 'hot' ? 'default' : 'ghost'}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setPriorityMode('hot')}
            >
              Hot
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorityMode === 'latest' ? 'default' : 'ghost'}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setPriorityMode('latest')}
            >
              Terbaru
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorityMode === 'discussed' ? 'default' : 'ghost'}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setPriorityMode('discussed')}
            >
              Diskusi
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-8 rounded-full px-3 text-xs"
              onClick={() => void refetchPrioritySnapshot()}
            >
              Refresh
            </Button>
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Score {PRIORITY_ALGORITHM_VERSION}
            </span>
          </div>

          {isPrioritySnapshotLoading && prioritySourcePosts.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : isPrioritySnapshotError && prioritySourcePosts.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-5 text-center">
              <p className="text-sm font-medium">Priority Hub gagal dimuat</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {readErrorMessage(prioritySnapshotError) || 'Terjadi kendala saat memuat data prioritas.'}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 rounded-full px-3 text-xs"
                onClick={() => void refetchPrioritySnapshot()}
              >
                Coba lagi
              </Button>
            </div>
          ) : priorityPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
              <p className="text-sm font-medium">Belum ada prioritas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Prioritas akan muncul otomatis setelah ada interaksi di feed ini.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {priorityPosts.map((item, index) => {
                const authorName = item.post.profile?.full_name?.trim() || 'Umat';
                const authorInitials =
                  authorName
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'UM';

                return (
                  <button
                    key={item.post.id}
                    type="button"
                    onClick={() => {
                      setIsPriorityDialogOpen(false);
                      router.push(`/post/${item.post.id}`);
                    }}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 text-left transition-colors hover:bg-muted/45"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={item.post.profile?.avatar_url} alt={authorName} />
                        <AvatarFallback className="text-[10px]">{authorInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{authorName}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.post.caption?.trim() || 'Postingan media tanpa caption'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#ff5a1f]">
                            <Flame className="h-3.5 w-3.5" />
                            {item.score.toFixed(1)}
                          </span>
                          <span>{item.engagement} interaksi</span>
                          <span>{Math.max(0, Math.round(item.ageHours))}j lalu</span>
                          <span>#{index + 1}</span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-foreground/90">{item.reason}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isScopeDialogOpen} onOpenChange={setIsScopeDialogOpen}>
        <DialogContent className="max-w-[520px] border-border bg-card">
          <DialogHeader>
            <DialogTitle>Pilih Lingkup Feed</DialogTitle>
            <DialogDescription>
              Atur feed sesuai kebutuhan. Anda bisa pilih All, Negara, Keuskupan, atau Paroki.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-2.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mode</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {SCOPE_MODE_META.map((mode) => {
                  const ModeIcon = mode.icon;
                  const isActive = scopeKey === mode.key;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => {
                        setScopeKey(mode.key);
                        setCountrySearch('');
                        setDioceseSearch('');
                        setParishSearch('');
                      }}
                      className={cn(
                        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 ease-out will-change-transform',
                        isActive
                          ? 'scale-[1.02] border-primary/80 bg-primary/12 text-primary shadow-[0_8px_22px_rgba(37,99,235,0.22)]'
                          : 'border-border bg-background/80 text-muted-foreground hover:-translate-y-0.5 hover:bg-muted/45 hover:text-foreground hover:shadow-sm'
                      )}
                    >
                      <ModeIcon
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isActive ? 'scale-110' : 'scale-100'
                        )}
                      />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-3">
              <div key={scopeKey} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                {scopeKey === 'all' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-4 w-4 text-primary" />
                    <span>All Feed aktif. Menampilkan semua postingan komunitas.</span>
                  </div>
                ) : scopeKey === 'country' ? (
                  <SearchableScopeSelect
                    label="Negara"
                    value={countryId}
                    selectedLabel={resolvedCountryName}
                    options={countries}
                    placeholder={isLoadingCountries ? 'Memuat negara...' : 'Pilih negara'}
                    searchPlaceholder="Cari negara"
                    emptyMessage="Tidak ada data negara"
                    loadingMessage="Memuat negara..."
                    searchValue={countrySearch}
                    onSearchChange={setCountrySearch}
                    onValueChange={(value) => {
                      const selected = countries.find((item) => item.id === value);
                      setCountryId(value);
                      setCountryName(selected?.name || '');
                      setCountrySearch('');
                    }}
                    onClear={() => {
                      setCountryId('');
                      setCountryName('');
                      setCountrySearch('');
                    }}
                    isLoading={isLoadingCountries}
                  />
                ) : scopeKey === 'diocese' ? (
                  <SearchableScopeSelect
                    label="Keuskupan"
                    value={dioceseId}
                    selectedLabel={resolvedDioceseName}
                    options={dioceses}
                    placeholder={isLoadingDioceses ? 'Memuat keuskupan...' : 'Pilih keuskupan'}
                    searchPlaceholder="Cari keuskupan"
                    emptyMessage="Tidak ada data keuskupan"
                    loadingMessage="Memuat keuskupan..."
                    searchValue={dioceseSearch}
                    onSearchChange={setDioceseSearch}
                    onValueChange={(value) => {
                      const selected = dioceses.find((item) => item.id === value);
                      setDioceseId(value);
                      setDioceseName(selected?.name || '');
                      setDioceseSearch('');
                    }}
                    onClear={() => {
                      setDioceseId('');
                      setDioceseName('');
                      setDioceseSearch('');
                    }}
                    isLoading={isLoadingDioceses}
                  />
                ) : (
                  <SearchableScopeSelect
                    label="Paroki"
                    value={parishId}
                    selectedLabel={resolvedParishName}
                    options={parishes}
                    placeholder={isLoadingParishes ? 'Memuat paroki...' : 'Pilih paroki'}
                    searchPlaceholder="Cari paroki"
                    emptyMessage="Tidak ada data paroki"
                    loadingMessage="Memuat paroki..."
                    searchValue={parishSearch}
                    onSearchChange={setParishSearch}
                    onValueChange={(value) => {
                      const selected = parishes.find((item) => item.id === value);
                      setParishId(value);
                      setParishName(selected?.name || '');
                      setParishSearch('');
                    }}
                    onClear={() => {
                      setParishId('');
                      setParishName('');
                      setParishSearch('');
                    }}
                    isLoading={isLoadingParishes}
                  />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Lingkup Aktif</p>
              <div
                key={`${resolvedScopeKey}-${activeScope.scopeId ?? 'none'}`}
                className="mt-1 flex items-start gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ActiveScopeIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {isScopeSelectionReady ? activeScope.label : `${activeScopeModeLabel} (belum dipilih)`}
                  </p>
                  <p className="text-xs text-muted-foreground">{activeScopeDescription}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setCountryId('');
                  setCountryName('');
                  setDioceseId('');
                  setDioceseName('');
                  setParishId('');
                  setParishName('');
                  setCountrySearch('');
                  setDioceseSearch('');
                  setParishSearch('');
                  setDioceses([]);
                  setParishes([]);
                  setScopeKey('all');
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl"
                onClick={() => setIsScopeDialogOpen(false)}
              >
                Terapkan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="px-4 pb-3">
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-72 w-full" />
        <div className="p-4">
          <Skeleton className="h-4 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
