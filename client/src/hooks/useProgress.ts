import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import type { ItemType } from '../types.js';

interface ProgressRow { module_id: string; item_id: string; completed: boolean; }

export function useProgress() {
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ProgressRow[]>('/api/progress')
      .then((rows) => {
        setProgress(new Map(rows.map((r) => [`${r.module_id}:${r.item_id}`, r.completed])));
      })
      .catch((e: unknown) => setError((e as Error).message));
  }, []);

  const toggle = useCallback(async (moduleId: string, itemId: string, itemType: ItemType) => {
    const key = `${moduleId}:${itemId}`;
    let current = false;
    setProgress((prev) => {
      current = prev.get(key) ?? false;
      return new Map(prev).set(key, !current);
    });
    try {
      await api.put(`/api/progress/${moduleId}/${itemId}?itemType=${itemType}`);
    } catch {
      setProgress((prev) => new Map(prev).set(key, current));
    }
  }, []);

  const isCompleted = useCallback(
    (moduleId: string, itemId: string) => progress.get(`${moduleId}:${itemId}`) ?? false,
    [progress]
  );

  return { toggle, isCompleted, error };
}
