// Verify Email Info Page

import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-7 w-7" />
          </div>
          <CardTitle>Cek Email Anda</CardTitle>
          <CardDescription>
            Kami sudah mengirim link verifikasi. Klik link tersebut sebelum login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/login">
            <Button className="w-full">Ke Halaman Login</Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Jika email belum masuk, cek folder spam/junk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
