// Edit Profile Page

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cropper, { type Area } from 'react-easy-crop';
import {
  ArrowLeft,
  Camera,
  Check,
  Church,
  ChevronsUpDown,
  ImagePlus,
  Loader2,
  Save,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  AuthService,
  type AuthLocationOption,
  type RegisterGender,
  type RegisterMaritalStatus,
} from '@/lib/features/auth/auth-service';
import { ProfileService } from '@/lib/features/profile/profile-service';
import { getProfileLocation } from '@/lib/features/profile/profile-status';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const FIELD_CLASS_NAME =
  'h-11 rounded-xl border-border/70 bg-background/70 text-foreground shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';

const SELECT_TRIGGER_CLASS_NAME =
  'h-11 w-full rounded-xl border-border/70 bg-background/70 shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';
const TEXTAREA_CLASS_NAME =
  'min-h-24 rounded-xl border-border/70 bg-background/70 shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';

const GENDER_OPTIONS: { value: RegisterGender; label: string }[] = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
];

const MARITAL_OPTIONS: { value: RegisterMaritalStatus; label: string }[] = [
  { value: 'single', label: 'Belum Pernah Menikah' },
  { value: 'widowed', label: 'Cerai Mati' },
];

type CropTarget = 'avatar' | 'banner';

const CROP_ASPECT: Record<CropTarget, number> = {
  avatar: 1,
  banner: 5 / 1,
};

const CROP_TITLE: Record<CropTarget, string> = {
  avatar: 'Atur Foto Profil',
  banner: 'Atur Banner',
};

const CROP_DESCRIPTION: Record<CropTarget, string> = {
  avatar: 'Geser area foto dan atur zoom.',
  banner: 'Geser area banner dan atur zoom.',
};

async function loadImageForCrop(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.setAttribute('crossOrigin', 'anonymous');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal membaca gambar.'));
    image.src = src;
  });
}

async function createCroppedImageFile(
  source: string,
  cropPixels: Area,
  baseName: string
): Promise<File> {
  const image = await loadImageForCrop(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Browser tidak mendukung proses crop.');
  }

  const width = Math.max(1, Math.round(cropPixels.width));
  const height = Math.max(1, Math.round(cropPixels.height));
  const x = Math.round(cropPixels.x);
  const y = Math.round(cropPixels.y);

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, x, y, width, height, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (!value) {
        reject(new Error('Gagal memproses hasil crop.'));
        return;
      }

      resolve(value);
    }, 'image/jpeg', 0.92);
  });

  return new File([blob], `${baseName}_${Date.now()}.jpg`, { type: 'image/jpeg' });
}

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

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

export default function EditProfilePage() {
  const router = useRouter();
  const { profile, user, updateProfile } = useAuth();

  const [isSaving, setIsSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [baptismName, setBaptismName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<RegisterGender | ''>('');
  const [maritalStatus, setMaritalStatus] = useState<RegisterMaritalStatus | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [ethnicity, setEthnicity] = useState('');

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

  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [bannerObjectUrl, setBannerObjectUrl] = useState<string | null>(null);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar');
  const [cropSourceUrl, setCropSourceUrl] = useState('');
  const [cropSourceObjectUrl, setCropSourceObjectUrl] = useState<string | null>(null);
  const [cropSourceFileName, setCropSourceFileName] = useState('');
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const debouncedCountrySearch = useDebouncedValue(countrySearch);
  const debouncedDioceseSearch = useDebouncedValue(dioceseSearch);
  const debouncedParishSearch = useDebouncedValue(parishSearch);

  const resetCropState = useCallback(() => {
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
    setCropSourceFileName('');
    setCropSourceUrl('');
    setCropSourceObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);

  const openCropDialog = useCallback((file: File, target: CropTarget) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar.');
      return;
    }

    const sourceUrl = URL.createObjectURL(file);
    setCropTarget(target);
    setCropSourceFileName(file.name);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
    setCropSourceUrl(sourceUrl);
    setCropSourceObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return sourceUrl;
    });
    setIsCropOpen(true);
  }, []);

  useEffect(() => {
    if (!profile) return;

    const location = getProfileLocation(profile);

    setFullName(profile.full_name || '');
    setBaptismName(profile.baptism_name || '');
    setBio(profile.bio || '');
    setGender(profile.gender === 'female' ? 'female' : 'male');
    setMaritalStatus(profile.marital_status === 'widowed' ? 'widowed' : 'single');
    setBirthDate(profile.birth_date?.toString().split('T')[0] ?? '');
    setEthnicity(profile.ethnicity || '');

    setCountryId(profile.country_id || '');
    setDioceseId(profile.diocese_id || '');
    setParishId(profile.church_id || '');
    setCountryName(location.country || '');
    setDioceseName(location.diocese || '');
    setParishName(location.parish || '');

    setAvatarFile(null);
    setBannerFile(null);
    setAvatarObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
    setBannerObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });

    setAvatarPreview(profile.avatar_url || '');
    setBannerPreview(profile.banner_url || '');
  }, [profile]);

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) {
        URL.revokeObjectURL(avatarObjectUrl);
      }
      if (bannerObjectUrl) {
        URL.revokeObjectURL(bannerObjectUrl);
      }
      if (cropSourceObjectUrl) {
        URL.revokeObjectURL(cropSourceObjectUrl);
      }
    };
  }, [avatarObjectUrl, bannerObjectUrl, cropSourceObjectUrl]);

  useEffect(() => {
    let active = true;

    async function loadCountries() {
      setIsLoadingCountries(true);
      const result = await AuthService.getCountries(debouncedCountrySearch);
      if (active) setCountries(result);
      if (active) setIsLoadingCountries(false);
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
      if (active) setDioceses(result);
      if (active) setIsLoadingDioceses(false);
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
      if (active) setParishes(result);
      if (active) setIsLoadingParishes(false);
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

  const initials =
    fullName
      .split(' ')
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    openCropDialog(file, 'avatar');
  };

  const handleBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    openCropDialog(file, 'banner');
  };

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleCropCancel = () => {
    if (isApplyingCrop) return;

    setIsCropOpen(false);
    resetCropState();
  };

  const handleApplyCrop = async () => {
    if (!cropSourceUrl || !croppedAreaPixels) {
      toast.error('Area crop belum siap.');
      return;
    }

    try {
      setIsApplyingCrop(true);
      const nextFile = await createCroppedImageFile(
        cropSourceUrl,
        croppedAreaPixels,
        cropTarget === 'avatar' ? 'avatar' : 'banner'
      );
      const previewUrl = URL.createObjectURL(nextFile);

      if (cropTarget === 'avatar') {
        setAvatarObjectUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return previewUrl;
        });
        setAvatarFile(nextFile);
        setAvatarPreview(previewUrl);
      } else {
        setBannerObjectUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return previewUrl;
        });
        setBannerFile(nextFile);
        setBannerPreview(previewUrl);
      }

      setIsCropOpen(false);
      resetCropState();
      toast.success(
        cropTarget === 'avatar'
          ? 'Foto profil siap disimpan.'
          : 'Banner siap disimpan.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal melakukan crop.');
    } finally {
      setIsApplyingCrop(false);
    }
  };

  const handleSave = async (event?: React.FormEvent | React.MouseEvent) => {
    event?.preventDefault();

    if (!user || !profile) {
      toast.error('User tidak ditemukan. Silakan login ulang.');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Nama lengkap wajib diisi.');
      return;
    }

    if (!birthDate) {
      toast.error('Tanggal lahir wajib diisi.');
      return;
    }

    const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate > today) {
      toast.error('Tanggal lahir tidak valid.');
      return;
    }

    if (!countryId || !dioceseId || !parishId) {
      toast.error('Negara, keuskupan, dan paroki wajib dipilih.');
      return;
    }

    try {
      setIsSaving(true);

      let nextAvatarUrl = profile.avatar_url;
      let nextBannerUrl = profile.banner_url;

      if (avatarFile) {
        nextAvatarUrl = await ProfileService.uploadAvatar(user.id, avatarFile);
      }

      if (bannerFile) {
        nextBannerUrl = await ProfileService.uploadBanner(user.id, bannerFile);
      }

      await updateProfile({
        full_name: fullName.trim(),
        baptism_name: baptismName.trim() || undefined,
        bio: bio.trim() || undefined,
        gender: gender || 'male',
        marital_status: maritalStatus || 'single',
        birth_date: birthDate,
        ethnicity: ethnicity.trim() || undefined,
        country_id: countryId,
        diocese_id: dioceseId,
        church_id: parishId,
        country: resolvedCountryName,
        diocese: resolvedDioceseName,
        parish: resolvedParishName,
        country_text: resolvedCountryName,
        diocese_text: resolvedDioceseName,
        parish_text: resolvedParishName,
        avatar_url: nextAvatarUrl,
        banner_url: nextBannerUrl,
        profile_filled: true,
      });

      toast.success('Profil berhasil diperbarui');
      router.push('/profile');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Profil tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-5">
      <Dialog
        open={isCropOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCropCancel();
          }
        }}
      >
        <DialogContent
          className="max-w-2xl gap-4 p-0 sm:max-w-2xl"
          showCloseButton={!isApplyingCrop}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{CROP_TITLE[cropTarget]}</DialogTitle>
            <DialogDescription>
              {CROP_DESCRIPTION[cropTarget]}
            </DialogDescription>
            {cropSourceFileName ? (
              <p className="truncate text-xs text-muted-foreground">{cropSourceFileName}</p>
            ) : null}
          </DialogHeader>

          <div className="px-6">
            <div className="relative h-80 overflow-hidden rounded-xl bg-black">
              {cropSourceUrl ? (
                <Cropper
                  image={cropSourceUrl}
                  crop={cropPosition}
                  zoom={cropZoom}
                  aspect={CROP_ASPECT[cropTarget]}
                  cropShape={cropTarget === 'avatar' ? 'round' : 'rect'}
                  showGrid={cropTarget === 'banner'}
                  onCropChange={setCropPosition}
                  onCropComplete={handleCropComplete}
                  onZoomChange={setCropZoom}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-2 px-6">
            <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Zoom
            </Label>
            <Slider
              value={[cropZoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(value) => setCropZoom(value[0] ?? 1)}
              disabled={isApplyingCrop}
            />
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border/70"
              onClick={handleCropCancel}
              disabled={isApplyingCrop}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-primary hover:bg-primary-hover"
              onClick={handleApplyCrop}
              disabled={isApplyingCrop || !croppedAreaPixels}
            >
              {isApplyingCrop ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Gunakan Gambar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">Profil</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Edit Profil</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ubah foto, data pribadi, dan domisili gerejawi agar profil tetap akurat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border/70"
              onClick={() => router.back()}
              disabled={isSaving || isCropOpen}
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isCropOpen}
              className="rounded-xl bg-primary hover:bg-primary-hover"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 pb-2 sm:space-y-5">
        <Card className="overflow-hidden rounded-2xl border-primary/20 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 to-primary/0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImagePlus className="h-5 w-5 text-primary" />
              Foto Profil
            </CardTitle>
            <CardDescription>
              Foto profil menggunakan crop 1:1, banner menggunakan crop 5:1 agar pas di halaman profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-[5/1] overflow-hidden rounded-2xl border border-border/70 bg-muted">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Belum ada banner
                </div>
              )}
              <label className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border/70 bg-card/90 px-2 py-1 text-xs font-medium transition-transform hover:-translate-y-0.5">
                <Camera className="h-3.5 w-3.5" />
                Ganti Banner
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerChange}
                  disabled={isSaving || isCropOpen || isApplyingCrop}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                <AvatarImage src={avatarPreview} alt={fullName} />
                <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
              </Avatar>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5 hover:bg-muted/40">
                <UserRound className="h-4 w-4" />
                Ganti Foto Profil
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isSaving || isCropOpen || isApplyingCrop}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/35 to-muted/5 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-primary" />
              Data Pribadi
            </CardTitle>
            <CardDescription>
              Pastikan nama lengkap, tanggal lahir, dan status pernikahan sesuai data yang benar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={FIELD_CLASS_NAME}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baptismName">Nama Baptis (Opsional)</Label>
              <Input
                id="baptismName"
                value={baptismName}
                onChange={(event) => setBaptismName(event.target.value)}
                className={FIELD_CLASS_NAME}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Deskripsi</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className={TEXTAREA_CLASS_NAME}
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select value={gender} onValueChange={(value) => setGender(value as RegisterGender)} disabled={isSaving}>
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
                <Label>Status Pernikahan</Label>
                <Select
                  value={maritalStatus}
                  onValueChange={(value) => setMaritalStatus(value as RegisterMaritalStatus)}
                  disabled={isSaving}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Tanggal Lahir</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className={FIELD_CLASS_NAME}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ethnicity">Suku / Asal</Label>
                <Input
                  id="ethnicity"
                  value={ethnicity}
                  onChange={(event) => setEthnicity(event.target.value)}
                  className={FIELD_CLASS_NAME}
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-emerald-500/25 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-emerald-500/12 to-emerald-500/0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Church className="h-5 w-5 text-emerald-700" />
              Domisili Gerejawi
            </CardTitle>
            <CardDescription className="text-emerald-700/90">
              Pilih negara, keuskupan, dan paroki sesuai identitas gerejawi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              disabled={isSaving}
              isLoading={isLoadingCountries}
            />

            <SearchableLocationSelect
              label="Keuskupan"
              value={dioceseId}
              selectedLabel={resolvedDioceseName}
              options={dioceses}
              placeholder={!countryId ? 'Pilih negara dulu' : isLoadingDioceses ? 'Memuat keuskupan...' : 'Pilih keuskupan'}
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
              disabled={isSaving || !countryId}
              isLoading={isLoadingDioceses}
            />

            <SearchableLocationSelect
              label="Paroki"
              value={parishId}
              selectedLabel={resolvedParishName}
              options={parishes}
              placeholder={!dioceseId ? 'Pilih keuskupan dulu' : isLoadingParishes ? 'Memuat paroki...' : 'Pilih paroki'}
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
              disabled={isSaving || !dioceseId}
              isLoading={isLoadingParishes}
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-10 flex flex-wrap justify-end gap-2 rounded-2xl border border-border/70 bg-background/90 p-3 shadow-sm backdrop-blur">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border/70"
            onClick={() => router.back()}
            disabled={isSaving || isCropOpen}
          >
            Batal
          </Button>
          <Button type="submit" className="rounded-xl bg-primary hover:bg-primary-hover" disabled={isSaving || isCropOpen}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
