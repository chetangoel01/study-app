import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type {
  CommunityFilter,
  CommunityReply,
  CommunityTag,
  CommunityThread,
  CommunityThreadFull,
} from '../types.js';

interface ListResponse {
  threads: CommunityThread[];
  nextCursor: string | null;
}

interface DetailResponse {
  thread: CommunityThreadFull;
  replies: CommunityReply[];
  canEdit: boolean;
}

export function useCommunityThreads(params: {
  filter: CommunityFilter;
  tag: CommunityTag | null;
}) {
  const { filter, tag } = params;
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ filter });
      if (tag) qs.set('tag', tag);
      const res = await api.get<ListResponse>(`/api/community/threads?${qs.toString()}`);
      setThreads(res.threads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setLoading(false);
    }
  }, [filter, tag]);

  useEffect(() => { refresh(); }, [refresh]);

  return { threads, loading, error, refresh };
}

export function useCommunityThread(id: string | undefined) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DetailResponse>(`/api/community/threads/${id}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export async function createThread(input: {
  title: string;
  body_md: string;
  tag: CommunityTag;
}): Promise<{ thread: CommunityThreadFull }> {
  return api.post('/api/community/threads', input);
}

export async function updateThread(
  id: string,
  patch: Partial<{ title: string; body_md: string; tag: CommunityTag }>,
): Promise<{ thread: CommunityThreadFull }> {
  return api.put(`/api/community/threads/${id}`, patch);
}

export async function deleteThread(id: string): Promise<{ deleted: 'hard' | 'soft' }> {
  return api.delete(`/api/community/threads/${id}`);
}

export async function createReply(
  threadId: string,
  body_md: string,
): Promise<{ reply: CommunityReply }> {
  return api.post(`/api/community/threads/${threadId}/replies`, { body_md });
}

export async function updateReply(
  id: string,
  body_md: string,
): Promise<{ reply: CommunityReply }> {
  return api.put(`/api/community/replies/${id}`, { body_md });
}

export async function deleteReply(id: string): Promise<{ deleted: 'soft' }> {
  return api.delete(`/api/community/replies/${id}`);
}

export async function subscribe(threadId: string): Promise<void> {
  await api.post(`/api/community/threads/${threadId}/subscribe`);
}

export async function unsubscribe(threadId: string): Promise<void> {
  await api.delete(`/api/community/threads/${threadId}/subscribe`);
}
