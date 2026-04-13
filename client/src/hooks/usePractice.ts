import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type {
  ChallengeRunResponse,
  DailyChallenge,
  MockPeer,
  PracticeStats,
} from '../types.js';

export function useDailyChallenge() {
  const [data, setData] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DailyChallenge>('/api/practice/daily-challenge')
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

export function useChallenge(challengeId?: string) {
  const [data, setData] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.get<DailyChallenge>(`/api/practice/challenge/${challengeId}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [challengeId]);

  const runCode = async (code: string): Promise<ChallengeRunResponse> => {
    if (!challengeId) {
      return { results: [{ passed: false, output: 'No challenge loaded', expected: '' }], allPassed: false };
    }

    return api.post<ChallengeRunResponse>(`/api/practice/challenge/${challengeId}/submit`, { code });
  };

  const submitCode = async (code: string): Promise<ChallengeRunResponse> => {
    if (!challengeId) {
      return { results: [{ passed: false, output: 'No challenge loaded', expected: '' }], allPassed: false };
    }

    const result = await api.post<ChallengeRunResponse>(`/api/practice/challenge/${challengeId}/submit`, {
      code,
      submit: true,
    });

    if (result.allPassed && data) {
      setData({ ...data, completed: true, completedAt: new Date().toISOString() });
    }

    return result;
  };

  return { data, loading, runCode, submitCode };
}

export function usePracticeStats() {
  const [data, setData] = useState<PracticeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get<PracticeStats>('/api/practice/stats')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tick]);

  const refetch = () => setTick((t) => t + 1);

  return { data, loading, refetch };
}

export function useMockPeers() {
  const [peers, setPeers] = useState<MockPeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MockPeer[]>('/api/practice/peers')
      .then(setPeers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scheduleMock = async ({
    peerId,
    topic,
    scheduledFor,
  }: {
    peerId: string;
    topic: string;
    scheduledFor: string;
  }) => {
    await api.post('/api/practice/mock-interviews/schedule', {
      peerId,
      topic,
      scheduledFor,
    });
  };

  const proposeAvailability = async ({
    proposedFor,
    durationMinutes,
    topic,
    notes,
  }: {
    proposedFor: string;
    durationMinutes: number;
    topic: string;
    notes?: string;
  }) => {
    await api.post('/api/practice/mock-interviews/proposals', {
      proposedFor,
      durationMinutes,
      topic,
      notes: notes ?? '',
    });
  };

  return { peers, loading, scheduleMock, proposeAvailability };
}
