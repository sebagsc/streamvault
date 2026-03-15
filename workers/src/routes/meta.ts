import { Hono } from 'hono';
import { optionalAuth } from '../lib/middleware';
import type { Env } from '../types';

// Error handling wrapper
function handleErrors(fn: Function) {
  return async (c: any, ...args: any[]) => {
    try {
      return await fn(c, ...args);
    } catch (e: any) {
      console.error('Route error:', e.message, e.stack);
      return c.json({ error: 'Internal Server Error', details: e.message }, 500);
    }
  };
}

const app = new Hono<{ Bindings: Env }>();

// GET /api/meta/categories
app.get('/categories', optionalAuth(), handleErrors(async (c: any) => {
  try {
    const data = await c.env.KV.get('categories', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching categories:', e);
    return c.json([]);
  }
}));

// GET /api/meta/countries
app.get('/countries', optionalAuth(), handleErrors(async (c: any) => {
  try {
    const data = await c.env.KV.get('countries', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching countries:', e);
    return c.json([]);
  }
}));

// GET /api/meta/languages
app.get('/languages', optionalAuth(), handleErrors(async (c: any) => {
  try {
    const data = await c.env.KV.get('languages', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching languages:', e);
    return c.json([]);
  }
}));

export default app;
