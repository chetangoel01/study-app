import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const getSecret = () => new TextEncoder().encode(config.jwtSecret);

export interface AccessTokenPayload { sub: string; email: string; }

export async function signAccessToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ sub: String(userId), email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return { sub: payload.sub as string, email: payload.email as string };
}
