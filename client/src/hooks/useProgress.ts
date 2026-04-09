import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import type { ItemType } from '../types.js';
import { useCurriculum } from '../context/CurriculumContext.js';

interface ProgressRow { module_id: string; item_id: string; completed: boolean; }

export function useProgress() {
  const { refetch: refetchCurriculum } = useCurriculum();
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    api.get<ProgressRow[]>('/api/progress')
      .then((rows) => {
        setProgress(new Map(rows.map((r) => [`${r.module_id}:${r.item_id}`, r.completed])));
      })
      .catch((e: unknown) => setError((e as Error).message));
  }, []);

  const toggle = useCallback(async (
    moduleId: string,
    itemId: string,
    itemType: ItemType,
    label: string
  ) => {
    const key = `${moduleId}:${itemId}`;
    const current = progress.get(key) ?? false;
    const next = !current;
    setError('');
    setStatusMessage(`${next ? 'Marking complete' : 'Marking incomplete'}: ${label}.`);
    setProgress((prev) => new Map(prev).set(key, next));
    setPendingKeys((prev) => {
      const nextPending = new Set(prev);
      nextPending.add(key);
      return nextPending;
    });
    try {
      await api.put(`/api/progress/${moduleId}/${itemId}?itemType=${itemType}`);
      setStatusMessage(`${next ? 'Completed' : 'Reopened'}: ${label}.`);
      void refetchCurriculum();
    } catch {
      setProgress((prev) => new Map(prev).set(key, current));
      setError(`Unable to update "${label}" right now.`);
      setStatusMessage(`Unable to update "${label}" right now.`);
    } finally {
      setPendingKeys((prev) => {
        const nextPending = new Set(prev);
        nextPending.delete(key);
        return nextPending;
      });
    }
  }, [progress, refetchCurriculum]);

  const isCompleted = useCallback(
    (moduleId: string, itemId: string) => progress.get(`${moduleId}:${itemId}`) ?? false,
    [progress]
  );

  const isPending = useCallback(
    (moduleId: string, itemId: string) => pendingKeys.has(`${moduleId}:${itemId}`),
    [pendingKeys]
  );

  const clearError = useCallback(() => setError(''), []);

  return { toggle, isCompleted, isPending, error, statusMessage, clearError };
}
