import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type {
  InviteDetail,
  InviteStatus,
  InviteSummary,
  MockPeer,
  RolePreference,
} from '../types.js';

export function useMockInterviewPeers() {
  const [peers, setPeers] = useState<MockPeer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get<MockPeer[]>('/api/practice/mock-interviews/peers')
      .then((data) => { if (active) setPeers(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { peers, loading };
}

type Direction = 'sent' | 'received' | 'all';

export function useInvites(options: { direction?: Direction; statuses?: InviteStatus[] } = {}) {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (options.direction) params.set('direction', options.direction);
    if (options.statuses && options.statuses.length > 0) params.set('status', options.statuses.join(','));
    const qs = params.toString();
    const data = await api.get<InviteSummary[]>(`/api/practice/mock-interviews${qs ? `?${qs}` : ''}`);
    setInvites(data);
    setLoading(false);
  }, [options.direction, (options.statuses || []).join(',')]);

  useEffect(() => { refresh(); }, [refresh]);

  const schedule = useCallback(async (payload: {
    peerId: string; scheduledFor: string; durationMinutes: number; topic: string; rolePreference: RolePreference;
  }): Promise<{ id: string }> => {
    const result = await api.post<{ id: string }>('/api/practice/mock-interviews/schedule', payload);
    await refresh();
    return result;
  }, [refresh]);

  const accept = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/accept`, {}); await refresh(); }, [refresh]);
  const decline = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/decline`, {}); await refresh(); }, [refresh]);
  const cancel = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/cancel`, {}); await refresh(); }, [refresh]);
  const reschedule = useCallback(async (id: string, scheduledFor: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/reschedule`, { scheduledFor });
    await refresh();
  }, [refresh]);

  return { invites, loading, refresh, schedule, accept, decline, cancel, reschedule };
}

export function useInviteDetail(id: string | null) {
  const [detail, setDetail] = useState<InviteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) { setDetail(null); return; }
    let active = true;
    setLoading(true);
    api.get<InviteDetail>(`/api/practice/mock-interviews/${id}`)
      .then((d) => { if (active) setDetail(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return { detail, loading };
}
