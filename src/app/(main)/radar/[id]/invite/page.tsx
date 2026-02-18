import { redirect } from 'next/navigation';

export default async function RadarInviteRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/radar?tab=ajak&radarId=${encodeURIComponent(id)}`);
}
