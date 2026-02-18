// Privacy Page

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Kebijakan Privasi</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Data profil, aktivitas sosial, dan preferensi Anda disimpan di Supabase untuk mendukung fitur aplikasi
        mobile, web, dan dashboard admin.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Kami tidak menjual data pribadi. Akses data dibatasi oleh kebijakan autentikasi dan role-based moderation.
      </p>
    </main>
  );
}
