import { Hono } from 'hono';
import type { Env } from '../types';
import type { ParsedChannel } from '../cron/kvRefresh';

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

// Helper: get channels filtered by source (if provided)
async function getFilteredChannels(kv: KVNamespace, source?: string): Promise<ParsedChannel[] | null> {
  if (!source) return null; // no source filter → use pre-computed KV data
  const raw = await kv.get('channels');
  if (!raw) return null;
  const channels: ParsedChannel[] = JSON.parse(raw);
  const sources = source.split(',').map((s) => s.trim().toLowerCase());
  return channels.filter((ch) => sources.includes(ch.source));
}

// GET /api/meta/categories?source=freetv
app.get('/categories', async (c) => {
  const source = c.req.query('source');
  const channels = await getFilteredChannels(c.env.KV, source);

  if (!channels) {
    // No source filter → return pre-computed data
    const data = await getFromKvOrFetch(c.env.KV, 'categories', `${IPTV_ORG_API}/categories.json`);
    return c.json(data);
  }

  // Compute categories dynamically from filtered channels
  const allCategories = await getFromKvOrFetch(c.env.KV, 'categories', `${IPTV_ORG_API}/categories.json`) as { id: string; name: string }[];
  const catNameMap = new Map(allCategories.map((c) => [c.id, c.name]));

  const catCount = new Map<string, number>();
  for (const ch of channels) {
    for (const cat of ch.categories) {
      catCount.set(cat, (catCount.get(cat) || 0) + 1);
    }
  }

  const result = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, name: catNameMap.get(id) || id, count }));

  return c.json(result);
});

// GET /api/meta/countries?source=xumo
app.get('/countries', async (c) => {
  const source = c.req.query('source');
  const channels = await getFilteredChannels(c.env.KV, source);

  if (!channels) {
    const data = await getFromKvOrFetch(c.env.KV, 'countries', `${IPTV_ORG_API}/countries.json`);
    return c.json(data);
  }

  const allCountries = await getFromKvOrFetch(c.env.KV, 'countries', `${IPTV_ORG_API}/countries.json`) as { code: string; name: string; flag: string }[];
  const countryMap = new Map(allCountries.map((c) => [c.code, c]));

  const countryCount = new Map<string, number>();
  for (const ch of channels) {
    if (ch.country) {
      countryCount.set(ch.country, (countryCount.get(ch.country) || 0) + 1);
    }
  }

  const result = [...countryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => {
      const info = countryMap.get(code);
      return { code, name: info?.name || code, flag: info?.flag || '', count };
    });

  return c.json(result);
});

// GET /api/meta/languages?source=lg
app.get('/languages', async (c) => {
  const source = c.req.query('source');
  const channels = await getFilteredChannels(c.env.KV, source);

  if (!channels) {
    const data = await getFromKvOrFetch(c.env.KV, 'languages', `${IPTV_ORG_API}/languages.json`);
    return c.json(data);
  }

  const allLanguages = await getFromKvOrFetch(c.env.KV, 'languages', `${IPTV_ORG_API}/languages.json`) as { code: string; name: string }[];
  const langMap = new Map(allLanguages.map((l) => [l.code, l.name]));

  const langCount = new Map<string, number>();
  for (const ch of channels) {
    for (const lang of ch.languages) {
      langCount.set(lang, (langCount.get(lang) || 0) + 1);
    }
  }

  const result = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, name: langMap.get(code) || code, count }));

  return c.json(result);
});

export default app;
