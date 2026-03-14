import { Hono } from 'hono';
import { requireAuth } from '../lib/middleware';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/meta/categories
app.get('/categories', requireAuth(), async (c) => {
  const data = await c.env.KV.get('categories', 'json');
  return c.json(data ?? []);
});

// GET /api/meta/countries
app.get('/countries', requireAuth(), async (c) => {
  const data = await c.env.KV.get('countries', 'json');
  return c.json(data ?? []);
});

// GET /api/meta/languages
app.get('/languages', requireAuth(), async (c) => {
  const data = await c.env.KV.get('languages', 'json');
  return c.json(data ?? []);
});

export default app;
