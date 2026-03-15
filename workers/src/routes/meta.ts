import { Hono } from 'hono';
import { optionalAuth } from '../lib/middleware';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/meta/categories
app.get('/categories', optionalAuth(), async (c) => {
  const data = await c.env.KV.get('categories', 'json');
  return c.json(data ?? []);
});

// GET /api/meta/countries
app.get('/countries', optionalAuth(), async (c) => {
  const data = await c.env.KV.get('countries', 'json');
  return c.json(data ?? []);
});

// GET /api/meta/languages
app.get('/languages', optionalAuth(), async (c) => {
  const data = await c.env.KV.get('languages', 'json');
  return c.json(data ?? []);
});

export default app;
