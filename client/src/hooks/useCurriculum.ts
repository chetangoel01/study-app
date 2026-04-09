import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { ModuleContent } from '../types.js';

export { CurriculumProvider, useCurriculum } from '../context/CurriculumContext.js';

export function useModuleContent(moduleId: string) {
  const [data, setData] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!moduleId) return;
    setLoading(true);
    setError('');
    api
      .get<ModuleContent>(`/api/module/${moduleId}/content`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [moduleId]);
  return { data, loading, error };
}
