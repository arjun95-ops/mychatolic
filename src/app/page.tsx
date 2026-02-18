// Landing Page

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/features/auth/use-auth';

export default function LandingPage() {
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) return;
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, isInitialized, router]);

  if (isInitialized && isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="font-bold text-xl">MyCatholic</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Masuk</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-primary hover:bg-primary-hover">
              Daftar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              Terhubung dengan{' '}
              <span className="text-primary">Komunitas Katolik</span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground sm:text-2xl">
              Platform sosial networking untuk umat Katolik Indonesia.
              Ikut jadwal misa, baca Alkitab, dan berinteraksi dengan sesama umat.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="bg-primary hover:bg-primary-hover text-lg px-8">
                  Mulai Sekarang
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Sudah punya akun?
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mt-20 grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon="🙏"
              title="Radar Misa"
              description="Cek-in ke misa, lihat jadwal, dan undang teman untuk ikut misa bersama."
            />
            <FeatureCard
              icon="📖"
              title="Alkitab & Liturgi"
              description="Baca Alkitab kapan saja, lihat jadwal liturgi, dan refleksi harian."
            />
            <FeatureCard
              icon="💬"
              title="Komunitas"
              description="Terhubung dengan sesama umat, berbagi postingan, dan obrolan real-time."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-muted-foreground">
        <p>&copy; {currentYear} MyCatholic. Semua hak dilindungi.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
      <div className="mb-4 text-5xl">{icon}</div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
