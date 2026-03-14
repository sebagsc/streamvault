import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload } from '../types';

const ALG = 'HS256';
const EXPIRY = '7d';

function getKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getKey(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(secret));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
