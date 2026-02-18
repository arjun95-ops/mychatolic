import { MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { ChatInboxPanel } from '@/components/chat/chat-inbox-panel';
import { Card } from '@/components/ui/card';

export default function ChatPage() {
  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-[1280px] gap-3 overflow-hidden md:grid-cols-[360px_minmax(0,1fr)]">
      <ChatInboxPanel className="h-full min-h-0" />

      <Card className="hidden h-full flex-col items-center justify-center gap-4 overflow-hidden border border-border bg-card p-10 text-center text-foreground shadow-sm md:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-foreground">
          <MessageCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold">Pesan Anda</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Pilih percakapan dari panel kiri untuk mulai berkirim pesan. Layout web ini sekarang
          mengikuti pola Instagram DM: inbox di kiri, thread aktif di kanan.
        </p>
        <div className="mt-2 grid w-full max-w-xl grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Sinkron Realtime</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Chat web, mobile, admin, dan database membaca kontrak data yang sama.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Aman</p>
            <p className="mt-1 text-xs text-muted-foreground">
              RLS Supabase tetap aktif, akses data mengikuti autentikasi pengguna.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Desain Desktop</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Navigasi chat fokus dan rapih seperti DM web modern.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Parity Aplikasi</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fitur chat inti mengikuti alur aplikasi native: inbox, thread, media, grup.
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" /> RLS aktif
          </span>
          <span className="inline-flex items-center gap-1">
            <Smartphone className="h-4 w-4" /> Web/Mobile parity
          </span>
        </div>
      </Card>
    </div>
  );
}
