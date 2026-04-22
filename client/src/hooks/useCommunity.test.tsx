import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCommunityThreads } from './useCommunity.js';

beforeEach(() => {
  (globalThis.fetch as unknown) = vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes('/api/community/threads')) {
      return new Response(
        JSON.stringify({
          threads: [
            {
              id: 't1', title: 'Hi', tag: 'dsa',
              author: { id: 1, name: 'A', avatarUrl: null },
              createdAt: '', lastActivityAt: '', editedAt: null, deletedAt: null,
              replyCount: 0, viewCount: 0, isSubscribed: false, excerpt: '',
            },
          ],
          nextCursor: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 404 });
  });
});

describe('useCommunityThreads', () => {
  it('fetches threads for the given filter + tag', async () => {
    const { result } = renderHook(() =>
      useCommunityThreads({ filter: 'all', tag: null }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0].id).toBe('t1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('filter=all'),
      expect.anything(),
    );
  });

  it('passes tag in the query string when provided', async () => {
    renderHook(() => useCommunityThreads({ filter: 'all', tag: 'dsa' }));
    await waitFor(() => {
      expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => String(call[0]).includes('tag=dsa'),
      )).toBe(true);
    });
  });
});
