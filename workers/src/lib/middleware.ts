import type { Context, Next } from 'hono';
import { verifyJwt } from './jwt';
import type { Env, JwtPayload } from '../types';

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

function getCookieToken(c: Context): string | undefined {
  const cookie = c.req.header('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match?.[1];
}

function getBearerToken(c: Context): string | undefined {
  const auth = c.req.header('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function requireAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const token = getCookieToken(c) || getBearerToken(c);
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);

    c.set('user', payload);
    await next();
  };
}

export function requireAdmin() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const token = getCookieToken(c) || getBearerToken(c);
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);
    if (payload.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    c.set('user', payload);
    await next();
  };
}

export function corsHeaders(frontendUrl: string) {
  return {
    'Access-Control-Allow-Origin': frontendUrl,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Optional auth - sets user if token exists, but doesn't require it
export function optionalAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const token = getCookieToken(c) || getBearerToken(c);
    if (token) {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      if (payload) {
        c.set('user', payload);
      }
    }
    await next();
  };
}
