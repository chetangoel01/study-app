import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModuleContent } from '../types.js';
import { api } from '../api/client.js';
import { useModuleContent } from './useCurriculum.js';

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useModuleContent', () => {
  const getMock = vi.mocked(api.get);

  beforeEach(() => {
    getMock.mockReset();
  });

  test('clears prior module payload immediately when moduleId changes', async () => {
    const first = deferred<ModuleContent>();
    const second = deferred<ModuleContent>();

    getMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ moduleId }) => useModuleContent(moduleId),
      { initialProps: { moduleId: 'module-a' } },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => {
      first.resolve({ moduleId: 'module-a', items: [], topics: [] });
      await first.promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data?.moduleId).toBe('module-a');
    });

    rerender({ moduleId: 'module-b' });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => {
      second.resolve({ moduleId: 'module-b', items: [], topics: [] });
      await second.promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data?.moduleId).toBe('module-b');
    });
  });

  test('ignores stale responses from an old module request', async () => {
    const first = deferred<ModuleContent>();
    const second = deferred<ModuleContent>();

    getMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ moduleId }) => useModuleContent(moduleId),
      { initialProps: { moduleId: 'module-a' } },
    );

    rerender({ moduleId: 'module-b' });

    await act(async () => {
      second.resolve({ moduleId: 'module-b', items: [], topics: [] });
      await second.promise;
    });

    await waitFor(() => {
      expect(result.current.data?.moduleId).toBe('module-b');
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      first.resolve({ moduleId: 'module-a', items: [], topics: [] });
      await first.promise;
    });

    await waitFor(() => {
      expect(result.current.data?.moduleId).toBe('module-b');
    });
  });
});
