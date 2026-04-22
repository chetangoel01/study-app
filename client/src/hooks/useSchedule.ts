import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { InviteSummary, ScheduleResponse } from '../types.js';

export function useSchedule(options: { showPast: boolean }) {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = options.showPast ? '?includePast=true' : '';
      const res = await api.get<ScheduleResponse>(`/api/schedule${qs}`);
      setInvites(res.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [options.showPast]);

  useEffect(() => { refresh(); }, [refresh]);

  const accept = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/accept`, {});
    await refresh();
  }, [refresh]);

  const decline = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/decline`, {});
    await refresh();
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/cancel`, {});
    await refresh();
  }, [refresh]);

  const reschedule = useCallback(async (id: string, scheduledFor: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/reschedule`, { scheduledFor });
    await refresh();
  }, [refresh]);

  return { invites, loading, error, refresh, accept, decline, cancel, reschedule };
}
