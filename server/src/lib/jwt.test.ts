import { decodeJwt } from 'jose';
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

  it('issues tokens that expire 48 hours after issuance', async () => {
    const token = await signAccessToken(42, 'user@example.com');
    const payload = decodeJwt(token);

    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');
    expect(payload.exp! - payload.iat!).toBe(48 * 60 * 60);
  });

  it('accepts tokens just before expiry and rejects them after 48 hours', async () => {
    const token = await signAccessToken(42, 'user@example.com');
    const { iat, exp } = decodeJwt(token);

    expect(iat).toBeTypeOf('number');
    expect(exp).toBeTypeOf('number');

    const oneSecondBeforeExpiry = new Date((exp! - 1) * 1000);
    await expect(verifyAccessToken(token, { currentDate: oneSecondBeforeExpiry })).resolves.toEqual({
      sub: '42',
      email: 'user@example.com',
    });

    const oneSecondAfterExpiry = new Date((exp! + 1) * 1000);
    await expect(verifyAccessToken(token, { currentDate: oneSecondAfterExpiry })).rejects.toThrow();
  });
});
