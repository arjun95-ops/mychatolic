// Register Page

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  type AuthLocationOption,
  AuthService,
  type RegisterFaithStatus,
  type RegisterGender,
  type RegisterMaritalStatus,
  type RegisterRole,
} from '@/lib/features/auth/auth-service';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Church,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function getLocalISODate(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STEP_META = [
  { title: 'Akun', subtitle: 'Email dan password', icon: Mail },
  { title: 'Data Diri', subtitle: 'Informasi personal dasar', icon: UserRound },
  { title: 'Lokasi', subtitle: 'Negara, keuskupan, paroki', icon: MapPin },
  { title: 'Peran', subtitle: 'Role, status iman, persetujuan', icon: ShieldCheck },
] as const;

const REGISTER_HIGHLIGHTS = [
  'Alur register sinkron dengan aplikasi mobile.',
  'Data gereja diambil dari master Supabase secara real-time.',
  'Validasi ketat supaya profil siap diverifikasi admin.',
] as const;

const FIELD_CLASS_NAME =
  'h-11 rounded-xl border-border/70 bg-background/70 text-foreground shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';

const SELECT_TRIGGER_CLASS_NAME =
  'h-11 w-full rounded-xl border-border/70 bg-background/70 shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';

const ROLE_OPTIONS: { value: RegisterRole; label: string }[] = [
  { value: 'umat', label: 'Umat' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'suster', label: 'Suster' },
  { value: 'bruder', label: 'Bruder' },
  { value: 'frater', label: 'Frater' },
];

const GENDER_OPTIONS: { value: RegisterGender; label: string }[] = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
];

const MARITAL_OPTIONS: { value: RegisterMaritalStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'widowed', label: 'Janda/Duda' },
];

const FAITH_OPTIONS: { value: RegisterFaithStatus; label: string }[] = [
  { value: 'baptized', label: 'Sudah baptis' },
  { value: 'catechumen', label: 'Sedang katekumen' },
];

const REGISTER_DRAFT_STORAGE_KEY = 'register-form-draft-v1';

type RegisterDraft = {
  step: number;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  baptismName: string;
  birthDate: string;
  gender: RegisterGender | '';
  maritalStatus: RegisterMaritalStatus | '';
  ethnicity: string;
  countrySearch: string;
  dioceseSearch: string;
  parishSearch: string;
  countryId: string;
  dioceseId: string;
  parishId: string;
  countryName: string;
  dioceseName: string;
  parishName: string;
  role: RegisterRole | '';
  faithStatus: RegisterFaithStatus | '';
  agreeTerms: boolean;
  agreeFaithVerification: boolean;
};

type SearchableLocationSelectProps = {
  label: string;
  value: string;
  selectedLabel: string;
  options: AuthLocationOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
};

function isRegisterGender(value: unknown): value is RegisterGender {
  return value === 'male' || value === 'female';
}

function isRegisterMaritalStatus(value: unknown): value is RegisterMaritalStatus {
  return value === 'single' || value === 'widowed';
}

function isRegisterRole(value: unknown): value is RegisterRole {
  return value === 'umat' || value === 'pastor' || value === 'suster' || value === 'bruder' || value === 'frater';
}

function isRegisterFaithStatus(value: unknown): value is RegisterFaithStatus {
  return value === 'baptized' || value === 'catechumen';
}

function SearchableLocationSelect({
  label,
  value,
  selectedLabel,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  searchValue,
  onSearchChange,
  onValueChange,
  disabled = false,
  isLoading = false,
}: SearchableLocationSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerLabel = selectedLabel || (isLoading ? loadingMessage : placeholder);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
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
            className={cn(SELECT_TRIGGER_CLASS_NAME, 'justify-between px-3 font-normal')}
            disabled={disabled}
          >
            <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] rounded-xl border-border/70 bg-card/95 p-0">
          <Command shouldFilter={false} className="rounded-xl bg-transparent">
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={onSearchChange}
            />
            <CommandList className="max-h-64">
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

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isInitialized } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [fullName, setFullName] = useState('');
  const [baptismName, setBaptismName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<RegisterGender | ''>('');
  const [maritalStatus, setMaritalStatus] = useState<RegisterMaritalStatus | ''>('');
  const [ethnicity, setEthnicity] = useState('');

  // Step 3
  const [countrySearch, setCountrySearch] = useState('');
  const [dioceseSearch, setDioceseSearch] = useState('');
  const [parishSearch, setParishSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [dioceseId, setDioceseId] = useState('');
  const [parishId, setParishId] = useState('');
  const [countryName, setCountryName] = useState('');
  const [dioceseName, setDioceseName] = useState('');
  const [parishName, setParishName] = useState('');
  const [countries, setCountries] = useState<AuthLocationOption[]>([]);
  const [dioceses, setDioceses] = useState<AuthLocationOption[]>([]);
  const [parishes, setParishes] = useState<AuthLocationOption[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingDioceses, setIsLoadingDioceses] = useState(false);
  const [isLoadingParishes, setIsLoadingParishes] = useState(false);

  // Step 4
  const [role, setRole] = useState<RegisterRole | ''>('');
  const [faithStatus, setFaithStatus] = useState<RegisterFaithStatus | ''>('baptized');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeFaithVerification, setAgreeFaithVerification] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const debouncedCountrySearch = useDebouncedValue(countrySearch);
  const debouncedDioceseSearch = useDebouncedValue(dioceseSearch);
  const debouncedParishSearch = useDebouncedValue(parishSearch);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        return;
      }

      const draft = JSON.parse(rawDraft) as Partial<RegisterDraft>;
      if (typeof draft.step === 'number') {
        const clampedStep = Math.max(1, Math.min(STEP_META.length, Math.trunc(draft.step)));
        setStep(clampedStep);
      }
      if (typeof draft.email === 'string') setEmail(draft.email);
      if (typeof draft.password === 'string') setPassword(draft.password);
      if (typeof draft.confirmPassword === 'string') setConfirmPassword(draft.confirmPassword);
      if (typeof draft.fullName === 'string') setFullName(draft.fullName);
      if (typeof draft.baptismName === 'string') setBaptismName(draft.baptismName);
      if (typeof draft.birthDate === 'string') setBirthDate(draft.birthDate);
      if (typeof draft.gender === 'string' && (draft.gender === '' || isRegisterGender(draft.gender))) {
        setGender(draft.gender);
      }
      if (typeof draft.maritalStatus === 'string' && (draft.maritalStatus === '' || isRegisterMaritalStatus(draft.maritalStatus))) {
        setMaritalStatus(draft.maritalStatus);
      }
      if (typeof draft.ethnicity === 'string') setEthnicity(draft.ethnicity);
      if (typeof draft.countrySearch === 'string') setCountrySearch(draft.countrySearch);
      if (typeof draft.dioceseSearch === 'string') setDioceseSearch(draft.dioceseSearch);
      if (typeof draft.parishSearch === 'string') setParishSearch(draft.parishSearch);
      if (typeof draft.countryId === 'string') setCountryId(draft.countryId);
      if (typeof draft.dioceseId === 'string') setDioceseId(draft.dioceseId);
      if (typeof draft.parishId === 'string') setParishId(draft.parishId);
      if (typeof draft.countryName === 'string') setCountryName(draft.countryName);
      if (typeof draft.dioceseName === 'string') setDioceseName(draft.dioceseName);
      if (typeof draft.parishName === 'string') setParishName(draft.parishName);
      if (typeof draft.role === 'string' && (draft.role === '' || isRegisterRole(draft.role))) {
        setRole(draft.role);
      }
      if (typeof draft.faithStatus === 'string' && (draft.faithStatus === '' || isRegisterFaithStatus(draft.faithStatus))) {
        setFaithStatus(draft.faithStatus);
      }
      if (typeof draft.agreeTerms === 'boolean') setAgreeTerms(draft.agreeTerms);
      if (typeof draft.agreeFaithVerification === 'boolean') setAgreeFaithVerification(draft.agreeFaithVerification);
    } catch {
      // Ignore invalid draft payload
    } finally {
      setIsDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isDraftHydrated) return;

    const draft: RegisterDraft = {
      step,
      email,
      password,
      confirmPassword,
      fullName,
      baptismName,
      birthDate,
      gender,
      maritalStatus,
      ethnicity,
      countrySearch,
      dioceseSearch,
      parishSearch,
      countryId,
      dioceseId,
      parishId,
      countryName,
      dioceseName,
      parishName,
      role,
      faithStatus,
      agreeTerms,
      agreeFaithVerification,
    };

    window.sessionStorage.setItem(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    isDraftHydrated,
    step,
    email,
    password,
    confirmPassword,
    fullName,
    baptismName,
    birthDate,
    gender,
    maritalStatus,
    ethnicity,
    countrySearch,
    dioceseSearch,
    parishSearch,
    countryId,
    dioceseId,
    parishId,
    countryName,
    dioceseName,
    parishName,
    role,
    faithStatus,
    agreeTerms,
    agreeFaithVerification,
  ]);

  useEffect(() => {
    if (!isInitialized) return;
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, isInitialized, router]);

  useEffect(() => {
    let active = true;

    async function loadCountries() {
      setIsLoadingCountries(true);
      const result = await AuthService.getCountries(debouncedCountrySearch);
      if (active) {
        setCountries(result);
      }
      if (active) {
        setIsLoadingCountries(false);
      }
    }

    void loadCountries();
    return () => {
      active = false;
    };
  }, [debouncedCountrySearch]);

  useEffect(() => {
    let active = true;

    if (!countryId) {
      setDioceses([]);
      setDioceseId('');
      setDioceseName('');
      setParishes([]);
      setParishId('');
      setParishName('');
      return () => {
        active = false;
      };
    }

    async function loadDioceses() {
      setIsLoadingDioceses(true);
      const result = await AuthService.getDioceses(countryId, debouncedDioceseSearch);
      if (active) {
        setDioceses(result);
      }
      if (active) {
        setIsLoadingDioceses(false);
      }
    }

    void loadDioceses();
    return () => {
      active = false;
    };
  }, [countryId, debouncedDioceseSearch]);

  useEffect(() => {
    let active = true;

    if (!dioceseId) {
      setParishes([]);
      setParishId('');
      setParishName('');
      return () => {
        active = false;
      };
    }

    async function loadParishes() {
      setIsLoadingParishes(true);
      const result = await AuthService.getParishes(dioceseId, debouncedParishSearch);
      if (active) {
        setParishes(result);
      }
      if (active) {
        setIsLoadingParishes(false);
      }
    }

    void loadParishes();
    return () => {
      active = false;
    };
  }, [dioceseId, debouncedParishSearch]);

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
  const resolvedCountryName = (selectedCountry?.name ?? countryName).trim();
  const resolvedDioceseName = (selectedDiocese?.name ?? dioceseName).trim();
  const resolvedParishName = (selectedParish?.name ?? parishName).trim();
  const todayDate = useMemo(() => getLocalISODate(), []);

  const validateStep = (targetStep: number) => {
    if (targetStep === 1) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password || !confirmPassword) {
        toast.error('Email, password, dan konfirmasi password wajib diisi');
        return false;
      }
      if (!normalizedEmail.includes('@')) {
        toast.error('Format email tidak valid');
        return false;
      }
      if (password.length < 6) {
        toast.error('Password minimal 6 karakter');
        return false;
      }
      if (password !== confirmPassword) {
        toast.error('Password tidak cocok');
        return false;
      }
      return true;
    }

    if (targetStep === 2) {
      if (!fullName.trim()) {
        toast.error('Nama lengkap wajib diisi');
        return false;
      }
      if (!birthDate) {
        toast.error('Tanggal lahir wajib diisi');
        return false;
      }
      const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(parsedBirthDate.getTime())) {
        toast.error('Format tanggal lahir tidak valid');
        return false;
      }
      if (parsedBirthDate > today) {
        toast.error('Tanggal lahir tidak boleh lebih dari hari ini');
        return false;
      }
      if (!gender) {
        toast.error('Jenis kelamin wajib dipilih');
        return false;
      }
      if (!maritalStatus) {
        toast.error('Status pernikahan wajib dipilih');
        return false;
      }
      return true;
    }

    if (targetStep === 3) {
      if (!countryId) {
        toast.error('Negara wajib dipilih');
        return false;
      }
      if (!dioceseId) {
        toast.error('Keuskupan wajib dipilih');
        return false;
      }
      if (!parishId) {
        toast.error('Paroki wajib dipilih');
        return false;
      }
      return true;
    }

    if (targetStep === 4) {
      if (!role) {
        toast.error('Role wajib dipilih');
        return false;
      }
      if (!faithStatus) {
        toast.error('Status iman wajib dipilih');
        return false;
      }
      if (!agreeTerms) {
        toast.error('Anda harus menyetujui syarat & ketentuan');
        return false;
      }
      if (!agreeFaithVerification) {
        toast.error('Anda harus menyetujui persetujuan verifikasi data iman');
        return false;
      }
      return true;
    }

    return false;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, STEP_META.length));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (step < STEP_META.length) {
      handleNext();
      return;
    }

    if (!validateStep(4)) return;

    try {
      setIsLoading(true);
      await signUp({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        baptismName: baptismName.trim() || undefined,
        birthDate,
        gender: gender as RegisterGender,
        maritalStatus: maritalStatus as RegisterMaritalStatus,
        ethnicity: ethnicity.trim() || undefined,
        countryId: countryId || undefined,
        dioceseId: dioceseId || undefined,
        parishId: parishId || undefined,
        countryName: resolvedCountryName || undefined,
        dioceseName: resolvedDioceseName || undefined,
        parishName: resolvedParishName || undefined,
        role: role as RegisterRole,
        faithStatus: faithStatus as RegisterFaithStatus,
        agreeTerms,
        agreeFaithVerification,
      });

      window.sessionStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
      toast.success('Registrasi berhasil. Silakan cek email Anda untuk verifikasi.');
      router.push('/verify-email');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mendaftar');
    } finally {
      setIsLoading(false);
    }
  };

  const currentMeta = STEP_META[step - 1];
  const CurrentStepIcon = currentMeta.icon;
  const progressPercent = Math.round((step / STEP_META.length) * 100);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-orb-float absolute -left-28 -top-28 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="auth-orb-float auth-orb-float-delay absolute right-[-140px] top-[24%] h-80 w-80 rounded-full bg-brand-deep/22 blur-3xl" />
        <div className="auth-orb-float auth-orb-float-slow absolute bottom-[-130px] left-[24%] h-72 w-72 rounded-full bg-user-chat/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.3fr)]">
          <section className="auth-fade-up hidden rounded-3xl border border-border/70 bg-card/70 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl signature-gradient shadow-[0_10px_32px_rgba(31,93,140,0.4)]">
                <Church className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Register Experience
                </p>
                <h1 className="text-3xl font-bold leading-tight text-foreground">
                  Buat Akun MyCatholic Lebih Cepat dan Terstruktur
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Satu kali isi, langsung siap dipakai di web dan aplikasi mobile dengan struktur data yang sama.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {REGISTER_HIGHLIGHTS.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/35 px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="auth-fade-up auth-fade-up-delay relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <div className="signature-gradient absolute inset-x-0 top-0 h-px opacity-90" />

            <CardHeader className="space-y-5 border-b border-border/70 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl signature-gradient shadow-[0_10px_28px_rgba(31,93,140,0.4)]">
                    <CurrentStepIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">Daftar</CardTitle>
                    <CardDescription>Ikuti tahapan pendaftaran seperti versi aplikasi mobile.</CardDescription>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  Langkah {step} / {STEP_META.length}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progres pendaftaran</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/70">
                  <div
                    className="signature-gradient h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STEP_META.map((meta, index) => {
                  const itemStep = index + 1;
                  const active = itemStep === step;
                  const done = itemStep < step;
                  const StepIcon = meta.icon;
                  return (
                    <div
                      key={meta.title}
                      className={`rounded-xl border px-2 py-2 text-xs transition-all ${
                        active
                          ? 'border-primary/70 bg-primary/10 text-primary'
                          : done
                            ? 'border-success/40 bg-success/10 text-success'
                            : 'border-border/80 bg-background/35 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                        <span className="truncate font-semibold">{meta.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <h2 className="text-base font-semibold">{currentMeta.title}</h2>
                <p className="text-sm text-muted-foreground">{currentMeta.subtitle}</p>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {step === 1 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        className={FIELD_CLASS_NAME}
                        placeholder="nama@email.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          className={`${FIELD_CLASS_NAME} pr-24`}
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={isLoading}
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                          disabled={isLoading}
                        >
                          {showPassword ? 'Sembunyi' : 'Tampilkan'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Konfirmasi Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        className={FIELD_CLASS_NAME}
                        placeholder="Ulangi password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Nama Lengkap
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        className={FIELD_CLASS_NAME}
                        placeholder="Nama lengkap"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="baptismName" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Nama Baptis (Opsional)
                      </Label>
                      <Input
                        id="baptismName"
                        type="text"
                        className={FIELD_CLASS_NAME}
                        placeholder="Nama baptis"
                        value={baptismName}
                        onChange={(event) => setBaptismName(event.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="birthDate" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Tanggal Lahir
                      </Label>
                      <Input
                        id="birthDate"
                        type="date"
                        className={FIELD_CLASS_NAME}
                        value={birthDate}
                        onChange={(event) => setBirthDate(event.target.value)}
                        max={todayDate}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Jenis Kelamin
                        </Label>
                        <Select
                          value={gender}
                          onValueChange={(value) => setGender(value as RegisterGender)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className={SELECT_TRIGGER_CLASS_NAME}>
                            <SelectValue placeholder="Pilih jenis kelamin" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDER_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Status Pernikahan
                        </Label>
                        <Select
                          value={maritalStatus}
                          onValueChange={(value) => setMaritalStatus(value as RegisterMaritalStatus)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className={SELECT_TRIGGER_CLASS_NAME}>
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            {MARITAL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ethnicity" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Suku (Opsional)
                      </Label>
                      <Input
                        id="ethnicity"
                        type="text"
                        className={FIELD_CLASS_NAME}
                        placeholder="Contoh: Batak"
                        value={ethnicity}
                        onChange={(event) => setEthnicity(event.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <SearchableLocationSelect
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
                        setCountryName(selected?.name ?? '');
                        setCountrySearch('');
                        setDioceseSearch('');
                        setParishSearch('');
                        setDioceseId('');
                        setParishId('');
                        setDioceseName('');
                        setParishName('');
                      }}
                      disabled={isLoading}
                      isLoading={isLoadingCountries}
                    />

                    <SearchableLocationSelect
                      label="Keuskupan"
                      value={dioceseId}
                      selectedLabel={resolvedDioceseName}
                      options={dioceses}
                      placeholder={
                        !countryId
                          ? 'Pilih negara dulu'
                          : isLoadingDioceses
                            ? 'Memuat keuskupan...'
                            : 'Pilih keuskupan'
                      }
                      searchPlaceholder="Cari keuskupan"
                      emptyMessage={!countryId ? 'Pilih negara dulu' : 'Tidak ada data keuskupan'}
                      loadingMessage="Memuat keuskupan..."
                      searchValue={dioceseSearch}
                      onSearchChange={setDioceseSearch}
                      onValueChange={(value) => {
                        const selected = dioceses.find((item) => item.id === value);
                        setDioceseId(value);
                        setDioceseName(selected?.name ?? '');
                        setDioceseSearch('');
                        setParishSearch('');
                        setParishId('');
                        setParishName('');
                      }}
                      disabled={isLoading || !countryId}
                      isLoading={isLoadingDioceses}
                    />

                    <SearchableLocationSelect
                      label="Paroki"
                      value={parishId}
                      selectedLabel={resolvedParishName}
                      options={parishes}
                      placeholder={
                        !dioceseId
                          ? 'Pilih keuskupan dulu'
                          : isLoadingParishes
                            ? 'Memuat paroki...'
                            : 'Pilih paroki'
                      }
                      searchPlaceholder="Cari paroki"
                      emptyMessage={!dioceseId ? 'Pilih keuskupan dulu' : 'Tidak ada data paroki'}
                      loadingMessage="Memuat paroki..."
                      searchValue={parishSearch}
                      onSearchChange={setParishSearch}
                      onValueChange={(value) => {
                        const selected = parishes.find((item) => item.id === value);
                        setParishId(value);
                        setParishName(selected?.name ?? '');
                        setParishSearch('');
                      }}
                      disabled={isLoading || !dioceseId}
                      isLoading={isLoadingParishes}
                    />

                    <p className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                      Lokasi wajib dipilih dari daftar master data agar konsisten dengan aplikasi mobile.
                    </p>
                  </>
                )}

                {step === 4 && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Role
                        </Label>
                        <Select
                          value={role}
                          onValueChange={(value) => setRole(value as RegisterRole)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className={SELECT_TRIGGER_CLASS_NAME}>
                            <SelectValue placeholder="Pilih role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Status Iman
                        </Label>
                        <Select
                          value={faithStatus}
                          onValueChange={(value) => setFaithStatus(value as RegisterFaithStatus)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className={SELECT_TRIGGER_CLASS_NAME}>
                            <SelectValue placeholder="Pilih status iman" />
                          </SelectTrigger>
                          <SelectContent>
                            {FAITH_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/35 p-4">
                      <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Ringkasan Syarat & Ketentuan</p>
                        <p className="mt-1">
                          Aplikasi dipakai untuk relasi serius. Dilarang konten seksual eksplisit, pelecehan, penipuan,
                          dan penyalahgunaan identitas iman. Admin berhak membatasi fitur, menolak verifikasi, atau
                          suspend akun bila ada pelanggaran.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Persetujuan Verifikasi Data Iman</p>
                        <p className="mt-1">
                          Dokumen sakramen akan ditinjau admin secara aman. Status bisa pending/ditolak dan dapat
                          diminta upload ulang. Dokumen palsu dianggap pelanggaran serius.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <input
                          id="terms"
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(event) => setAgreeTerms(event.target.checked)}
                          disabled={isLoading}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <label htmlFor="terms" className="text-sm font-normal leading-relaxed text-foreground">
                          Saya menyetujui{' '}
                          <Link href="/terms" className="font-semibold text-primary hover:underline">
                            Syarat & Ketentuan
                          </Link>{' '}
                          dan{' '}
                          <Link href="/privacy" className="font-semibold text-primary hover:underline">
                            Kebijakan Privasi
                          </Link>
                          .
                        </label>
                      </div>

                      <div className="flex items-start gap-2">
                        <input
                          id="faithVerification"
                          type="checkbox"
                          checked={agreeFaithVerification}
                          onChange={(event) => setAgreeFaithVerification(event.target.checked)}
                          disabled={isLoading}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <label htmlFor="faithVerification" className="text-sm font-normal leading-relaxed text-foreground">
                          Saya setuju data iman dan data gerejawi saya diproses untuk verifikasi akun.
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/45 px-5"
                    onClick={handleBack}
                    disabled={isLoading || step === 1}
                  >
                    Kembali
                  </Button>

                  <Button
                    type="submit"
                    className="h-11 rounded-xl bg-primary px-5 font-semibold shadow-[0_10px_28px_rgba(31,93,140,0.34)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_14px_32px_rgba(31,93,140,0.45)]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : step < STEP_META.length ? (
                      <>
                        Lanjut
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      'Daftar'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>

            <CardFooter className="flex justify-center border-t border-border/70 pt-5">
              <p className="text-sm text-muted-foreground">
                Sudah punya akun?{' '}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Masuk
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
