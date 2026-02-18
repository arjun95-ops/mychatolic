// Schedule Page

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useChurches, useMassSchedules } from '@/lib/features/schedule/use-schedule';
import type { MassSchedule } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function normalizeDay(value: number) {
  if (value === 7) return 0;
  if (value < 0 || value > 6) return 0;
  return value;
}

function getOrderedDays() {
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, offset) => (today + offset) % 7);
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const { data: churches = [], isLoading: isChurchesLoading } = useChurches();
  const [manualChurchId, setManualChurchId] = useState('');

  const selectedChurchId = useMemo(() => {
    if (manualChurchId && churches.some((church) => church.id === manualChurchId)) {
      return manualChurchId;
    }

    const profileChurch = profile?.church_id;
    if (profileChurch && churches.some((church) => church.id === profileChurch)) {
      return profileChurch;
    }

    return churches[0]?.id ?? '';
  }, [churches, manualChurchId, profile?.church_id]);

  const selectedChurch = useMemo(
    () => churches.find((church) => church.id === selectedChurchId),
    [churches, selectedChurchId]
  );

  const {
    data: schedules = [],
    isLoading: isSchedulesLoading,
  } = useMassSchedules({ churchId: selectedChurchId || undefined });

  const groupedSchedules = useMemo(() => {
    const order = getOrderedDays();
    const groupMap = new Map<number, MassSchedule[]>();

    for (const schedule of schedules) {
      const day = normalizeDay(schedule.day_of_week);
      if (!groupMap.has(day)) {
        groupMap.set(day, []);
      }
      groupMap.get(day)!.push(schedule);
    }

    return order.map((day) => ({
      day,
      label: DAY_LABELS[day],
      schedules: (groupMap.get(day) ?? []).sort((a, b) => a.mass_time.localeCompare(b.mass_time)),
    }));
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jadwal Misa</h1>
        <div className="flex min-w-[220px] items-center gap-2">
          <label htmlFor="churchSelect" className="text-sm font-medium text-muted-foreground">
            Gereja
          </label>
          <select
            id="churchSelect"
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            value={selectedChurchId}
            onChange={(event) => setManualChurchId(event.target.value)}
            disabled={isChurchesLoading || churches.length === 0}
          >
            {churches.length === 0 ? (
              <option value="">Belum ada data gereja</option>
            ) : (
              churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {selectedChurch?.name || 'Pilih gereja'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {selectedChurch?.address || 'Pilih gereja untuk melihat jadwal misa resmi yang tersinkron dari database.'}
          </p>
        </CardContent>
      </Card>

      {isSchedulesLoading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat jadwal misa...
        </Card>
      ) : groupedSchedules.every((group) => group.schedules.length === 0) ? (
        <Card className="p-10 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-base font-semibold">Belum ada jadwal tersedia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Data jadwal akan muncul saat `mass_schedules` untuk gereja ini sudah terisi.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedSchedules.map((group) =>
            group.schedules.length === 0 ? null : (
              <div key={group.day} className="space-y-3">
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <div className="space-y-3">
                  {group.schedules.map((schedule) => (
                    <MassScheduleCard key={schedule.id} schedule={schedule} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Lihat Semua Gereja</h3>
              <p className="text-sm text-muted-foreground">
                Total {churches.length} gereja tersedia untuk dipilih
              </p>
            </div>
          </div>
          <Link href="/radar">
            <Button variant="outline" size="sm">
              Buka Radar
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function MassScheduleCard({ schedule }: { schedule: MassSchedule }) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{schedule.mass_time}</h3>
          <p className="text-sm text-muted-foreground">
            {schedule.language}
            {schedule.notes ? ` • ${schedule.notes}` : ''}
          </p>
        </div>
      </div>
      <Link href="/radar">
        <Button variant="outline" size="sm">
          Check-in
        </Button>
      </Link>
    </Card>
  );
}
