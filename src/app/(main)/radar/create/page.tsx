import { redirect } from 'next/navigation';

export default function RadarCreateRoute() {
  redirect('/radar?tab=cari&openCreate=1');
}
