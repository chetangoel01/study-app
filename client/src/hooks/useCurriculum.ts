import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { CurriculumResponse, ModuleContent } from '../types.js';

export function useCurriculum() {
  const [data, setData] = useState<CurriculumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<CurriculumResponse>('/api/curriculum')
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
}

export function useModuleContent(moduleId: string) {
  const [data, setData] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!moduleId) return;
    setLoading(true);
    setError('');
    api.get<ModuleContent>(`/api/module/${moduleId}/content`)
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [moduleId]);
  return { data, loading, error };
}
