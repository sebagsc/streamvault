import { Hono } from 'hono';
import type { Env } from '../types';

const IPTV_ORG_API = 'https://iptv-org.github.io/api';

const app = new Hono<{ Bindings: Env }>();

// Helper: read from KV, fallback to live fetch if cache is empty
async function getFromKvOrFetch(kv: KVNamespace, key: string, fallbackUrl: string): Promise<unknown[]> {
  const cached = await kv.get(key);
  if (cached) return JSON.parse(cached);

  // KV empty (first deploy before cron runs) — fetch live as fallback
  try {
    const res = await fetch(fallbackUrl, { headers: { 'User-Agent': 'StreamVault/1.0' } });
    if (res.ok) return (await res.json()) as unknown[];
  } catch {}

  return [];
}

// GET /api/meta/categories
app.get('/categories', async (c) => {
  const data = await getFromKvOrFetch(c.env.KV, 'categories', `${IPTV_ORG_API}/categories.json`);
  return c.json(data);
});

// GET /api/meta/countries
app.get('/countries', async (c) => {
  const data = await getFromKvOrFetch(c.env.KV, 'countries', `${IPTV_ORG_API}/countries.json`);
  return c.json(data);
});

// GET /api/meta/languages
app.get('/languages', async (c) => {
  const data = await getFromKvOrFetch(c.env.KV, 'languages', `${IPTV_ORG_API}/languages.json`);
  return c.json(data);
});

export default app;
