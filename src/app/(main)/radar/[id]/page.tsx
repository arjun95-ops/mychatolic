import { redirect } from 'next/navigation';

export default async function RadarDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/radar?tab=cari&radarId=${encodeURIComponent(id)}`);
}
