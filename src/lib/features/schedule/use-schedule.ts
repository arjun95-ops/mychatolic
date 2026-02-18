// Schedule Hooks

'use client';

import { useQuery } from '@tanstack/react-query';
import { ScheduleService } from './schedule-service';

export function useChurches(limit = 200) {
  return useQuery({
    queryKey: ['churches', limit],
    queryFn: () => ScheduleService.getChurches(limit),
  });
}

export function useMassSchedules(params?: { churchId?: string; dayOfWeek?: number }) {
  return useQuery({
    queryKey: ['mass-schedules', params?.churchId, params?.dayOfWeek],
    queryFn: () => ScheduleService.getMassSchedules(params),
    enabled: Boolean(params?.churchId),
  });
}
