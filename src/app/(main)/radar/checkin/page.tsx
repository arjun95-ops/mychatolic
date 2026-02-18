import { redirect } from 'next/navigation';

export default function RadarCheckInRoute() {
  redirect('/radar?tab=cari&openCheckin=1');
}
