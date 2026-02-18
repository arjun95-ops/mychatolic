// Login Page

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/features/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Church, Loader2, ShieldCheck } from 'lucide-react';

const LOGIN_HIGHLIGHTS = [
  'Satu akun untuk web dan aplikasi mobile.',
  'Session aman dengan Supabase Auth.',
  'Profil langsung sinkron setelah login.',
] as const;

const FIELD_CLASS_NAME =
  'h-11 rounded-xl border-border/70 bg-background/70 text-foreground shadow-none transition-all duration-200 focus-visible:border-primary/80 focus-visible:ring-primary/30';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isInitialized } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized) return;
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, isInitialized, router]);

  if (isInitialized && isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-2xl border border-border/70 bg-card/80 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mengarahkan ke beranda...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      toast.error('Email dan password harus diisi');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      toast.error('Format email tidak valid');
      return;
    }

    try {
      setIsLoading(true);
      const result = await signIn(normalizedEmail, password);
      if (result.requiresProfileCompletion) {
        toast.success('Login berhasil. Lengkapi profil Anda terlebih dahulu.');
        router.push('/profile/edit');
        return;
      }
      toast.success('Berhasil masuk!');
      router.push('/home');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal masuk');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-orb-float absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="auth-orb-float auth-orb-float-delay absolute right-[-120px] top-[26%] h-80 w-80 rounded-full bg-brand-deep/22 blur-3xl" />
        <div className="auth-orb-float auth-orb-float-slow absolute bottom-[-130px] left-[28%] h-72 w-72 rounded-full bg-user-chat/18 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)]">
          <section className="auth-fade-up hidden rounded-3xl border border-border/70 bg-card/70 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl signature-gradient shadow-[0_10px_32px_rgba(31,93,140,0.4)]">
                <Church className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Welcome Back
                </p>
                <h1 className="text-3xl font-bold leading-tight text-foreground">
                  Masuk ke Ruang Komunitas MyCatholic
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Lanjutkan percakapan, cek notifikasi, dan akses semua fitur komunitas dari satu akun yang sama.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {LOGIN_HIGHLIGHTS.map((item) => (
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

            <CardHeader className="space-y-4 border-b border-border/70 pb-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl signature-gradient shadow-[0_10px_28px_rgba(31,93,140,0.4)]">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">Masuk</CardTitle>
                <CardDescription>Masuk ke akun MyCatholic Anda</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Password
                    </Label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                      Lupa password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`${FIELD_CLASS_NAME} pr-24`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                      disabled={isLoading}
                    >
                      {showPassword ? 'Sembunyi' : 'Tampilkan'}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-primary font-semibold shadow-[0_10px_28px_rgba(31,93,140,0.34)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_14px_32px_rgba(31,93,140,0.45)]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sedang masuk...
                    </>
                  ) : (
                    <>
                      Masuk
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex justify-center border-t border-border/70 pt-5">
              <p className="text-sm text-muted-foreground">
                Belum punya akun?{' '}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Daftar sekarang
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
