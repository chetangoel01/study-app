import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { ModuleContent } from '../types.js';

export { CurriculumProvider, useCurriculum } from '../context/CurriculumContext.js';

export function useModuleContent(moduleId: string) {
  const [data, setData] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!moduleId) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Clear previous module payload immediately to avoid stale-content flashes
    // when routing between modules.
    setData(null);
    setLoading(true);
    setError('');
    api
      .get<ModuleContent>(`/api/module/${moduleId}/content`)
      .then((nextData) => {
        if (cancelled) return;
        setData(nextData);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);
  return { data, loading, error };
}
