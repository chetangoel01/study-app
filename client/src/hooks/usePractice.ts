import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function useDailyChallenge() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get<any>('/api/practice/daily-challenge')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markComplete = async () => {
    if (!data?.id) return;
    await api.post('/api/practice/daily-challenge/complete', { challengeId: data.id });
    setData({ ...data, completed: true, completedAt: new Date().toISOString() });
  };

  return { data, loading, markComplete };
}

export function usePracticeStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>('/api/practice/stats')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function useMockPeers() {
  const [peers, setPeers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any[]>('/api/practice/peers')
      .then(setPeers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scheduleMock = async (peerId: string, topic: string) => {
    await api.post('/api/practice/mock-interviews/schedule', {
      peerId,
      topic,
      scheduledFor: new Date(Date.now() + 86400000).toISOString() // Tomorrow
    });
  };

  return { peers, loading, scheduleMock };
}
