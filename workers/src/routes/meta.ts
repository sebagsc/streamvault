import { Hono } from 'hono';
import { optionalAuth } from '../lib/middleware';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/meta/categories
app.get('/categories', optionalAuth(), async (c) => {
  try {
    const data = await c.env.KV.get('categories', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching categories:', e);
    return c.json([]);
  }
});

// GET /api/meta/countries
app.get('/countries', optionalAuth(), async (c) => {
  try {
    const data = await c.env.KV.get('countries', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching countries:', e);
    return c.json([]);
  }
});

// GET /api/meta/languages
app.get('/languages', optionalAuth(), async (c) => {
  try {
    const data = await c.env.KV.get('languages', 'json');
    return c.json(data ?? []);
  } catch (e) {
    console.error('Error fetching languages:', e);
    return c.json([]);
  }
});

export default app;
