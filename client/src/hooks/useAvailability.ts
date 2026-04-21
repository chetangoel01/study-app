import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { FeedBlock, MyAvailability, RolePreference } from '../types.js';

export function useMyAvailability() {
  const [data, setData] = useState<MyAvailability>({ proposals: [] });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const fresh = await api.get<MyAvailability>('/api/practice/availability/mine');
    setData(fresh);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload: {
    durationMinutes: number; topic: string; notes: string; rolePreference: RolePreference;
    blocks: Array<{ startsAt: string }>;
  }): Promise<{ proposalId: string }> => {
    const result = await api.post<{ proposalId: string }>('/api/practice/availability', payload);
    await refresh();
    return result;
  }, [refresh]);

  const cancelBlock = useCallback(async (blockId: string) => {
    await api.delete(`/api/practice/availability/blocks/${blockId}`);
    await refresh();
  }, [refresh]);

  const cancelProposal = useCallback(async (proposalId: string) => {
    await api.delete(`/api/practice/availability/${proposalId}`);
    await refresh();
  }, [refresh]);

  return { data, loading, refresh, create, cancelBlock, cancelProposal };
}

export function useFeed(filters: { role?: 'interviewee' | 'interviewer' | 'any'; topic?: string; from?: string; to?: string } = {}) {
  const [blocks, setBlocks] = useState<FeedBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.role && filters.role !== 'any') p.set('role', filters.role);
    if (filters.topic) p.set('topic', filters.topic);
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    const qs = p.toString();
    const fresh = await api.get<FeedBlock[]>(`/api/practice/availability/feed${qs ? `?${qs}` : ''}`);
    setBlocks(fresh);
    setLoading(false);
  }, [filters.role, filters.topic, filters.from, filters.to]);

  useEffect(() => { refresh(); }, [refresh]);

  const claim = useCallback(async (blockId: string, rolePreference: RolePreference, notes?: string) => {
    await api.post(`/api/practice/availability/blocks/${blockId}/claim`, { rolePreference, notes });
    await refresh();
  }, [refresh]);

  return { blocks, loading, refresh, claim };
}
