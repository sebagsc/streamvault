import { Hono } from 'hono';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

const IPTV_ORG_API = 'https://iptv-org.github.io/api';

// GET /api/meta/categories - From iptv-org
app.get('/categories', async (c) => {
  try {
    const res = await fetch(`${IPTV_ORG_API}/categories.json`);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    console.error('Error fetching categories:', e);
    return c.json([]);
  }
});

// GET /api/meta/countries - From iptv-org
app.get('/countries', async (c) => {
  try {
    const res = await fetch(`${IPTV_ORG_API}/countries.json`);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    console.error('Error fetching countries:', e);
    return c.json([]);
  }
});

// GET /api/meta/languages - From iptv-org
app.get('/languages', async (c) => {
  try {
    const res = await fetch(`${IPTV_ORG_API}/languages.json`);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    console.error('Error fetching languages:', e);
    return c.json([]);
  }
});

export default app;
