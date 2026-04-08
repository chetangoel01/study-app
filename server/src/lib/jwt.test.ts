import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt.js';

describe('JWT', () => {
  it('round-trips a valid token', async () => {
    const token = await signAccessToken(42, 'user@example.com');
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('42');
    expect(payload.email).toBe('user@example.com');
  });

  it('rejects an invalid token', async () => {
    await expect(verifyAccessToken('not.a.token')).rejects.toThrow();
  });
});
