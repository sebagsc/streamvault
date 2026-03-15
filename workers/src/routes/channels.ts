import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../lib/middleware';
import type { Env, IptvChannel, IptvStream, CustomStream } from '../types';

const app = new Hono<{ Bindings: Env }>();

interface MergedChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  streams: MergedStream[];
  is_custom: boolean;
}

interface MergedStream {
  url: string;
  quality: string;
  http_referrer?: string;
  user_agent?: string;
  is_broken: boolean;
}

async function getBlocklist(kv: KVNamespace): Promise<Set<string>> {
  const raw = await kv.get('blocklist', 'json') as string[] | null;
  return new Set(raw ?? []);
}

// GET /api/channels (public)
app.get('/', optionalAuth(), async (c) => {
  const user = c.get('user');
  const q = c.req.query();

  const country = q.country;
  const language = q.language;
  const category = q.category;
  const nsfw = q.nsfw === 'true';
  const search = q.search?.toLowerCase();
  const showAll = q.show_all === 'true';

  // Fetch channel + stream data from KV
  const [channelsRaw, streamsRaw, blocklistSet] = await Promise.all([
    c.env.KV.get('channels', 'json') as Promise<IptvChannel[] | null>,
    c.env.KV.get('streams', 'json') as Promise<IptvStream[] | null>,
    getBlocklist(c.env.KV),
  ]);

  const channels = channelsRaw ?? [];
  const streams = streamsRaw ?? [];

  // Fetch user info for nsfw flag
  const userRow = await c.env.DB.prepare('SELECT nsfw_enabled FROM users WHERE id = ?')
    .bind(user.sub)
    .first<{ nsfw_enabled: number }>();
  const canViewNsfw = (userRow?.nsfw_enabled ?? 0) === 1 && nsfw;

  // Build stream map per channel
  const streamMap = new Map<string, IptvStream[]>();
  for (const s of streams) {
    if (!streamMap.has(s.channel)) streamMap.set(s.channel, []);
    streamMap.get(s.channel)!.push(s);
  }

  // Fetch health reports to mark broken streams
  const brokenReports = await c.env.DB.prepare(
    `SELECT stream_url, admin_override FROM stream_health_reports`
  ).all<{ stream_url: string; admin_override: string | null }>();

  const brokenUrls = new Set<string>();
  const hiddenUrls = new Set<string>();
  for (const r of brokenReports.results) {
    if (r.admin_override === 'hidden') hiddenUrls.add(r.stream_url);
    else if (r.admin_override === null) brokenUrls.add(r.stream_url);
  }

  // Fetch custom streams
  const customStreams = await c.env.DB.prepare(
    'SELECT * FROM custom_streams WHERE active = 1'
  ).all<CustomStream>();

  // Build custom stream map per channel
  const customStreamMap = new Map<string, CustomStream[]>();
  for (const cs of customStreams.results) {
    if (cs.channel_id) {
      if (!customStreamMap.has(cs.channel_id)) customStreamMap.set(cs.channel_id, []);
      customStreamMap.get(cs.channel_id)!.push(cs);
    }
  }

  // Build merged channel list
  let merged: MergedChannel[] = channels
    .filter((ch) => {
      if (blocklistSet.has(ch.id)) return false;
      if (ch.is_nsfw && !canViewNsfw) return false;
      return true;
    })
    .map((ch) => {
      const chStreams = [
        ...(streamMap.get(ch.id) ?? [])
          .filter((s) => !hiddenUrls.has(s.url))
          .map((s) => ({
            url: s.url,
            quality: s.quality || 'unknown',
            http_referrer: s.http_referrer || undefined,
            user_agent: s.user_agent || undefined,
            is_broken: brokenUrls.has(s.url),
          })),
        ...(customStreamMap.get(ch.id) ?? [])
          .filter((cs) => !hiddenUrls.has(cs.url))
          .map((cs) => ({
            url: cs.url,
            quality: cs.quality || 'unknown',
            is_broken: brokenUrls.has(cs.url),
          })),
      ];

      return {
        id: ch.id,
        name: ch.name,
        logo: ch.logo,
        country: ch.country,
        languages: ch.languages,
        categories: ch.categories,
        is_nsfw: ch.is_nsfw,
        streams: chStreams,
        is_custom: false,
      };
    });

  // Append fully custom channels (no channel_id)
  for (const cs of customStreams.results.filter((cs) => !cs.channel_id)) {
    if (cs.is_nsfw && !canViewNsfw) continue;
    merged.push({
      id: cs.id,
      name: cs.title,
      logo: '',
      country: cs.country ?? '',
      languages: cs.language ? [cs.language] : [],
      categories: cs.category ? [cs.category] : [],
      is_nsfw: cs.is_nsfw === 1,
      streams: [{ url: cs.url, quality: cs.quality ?? 'unknown', is_broken: false }],
      is_custom: true,
    });
  }

  // Filter
  if (country && !showAll) {
    merged = merged.filter((ch) => ch.country === country);
  }
  if (language && !showAll) {
    merged = merged.filter((ch) => ch.languages.includes(language));
  }
  if (category && !showAll) {
    merged = merged.filter((ch) => ch.categories.includes(category));
  }
  if (search) {
    merged = merged.filter((ch) => ch.name.toLowerCase().includes(search));
  }

  // Only return channels that have at least one non-hidden stream
  merged = merged.filter((ch) => ch.streams.length > 0);

  return c.json(merged);
});

// GET /api/channels/:id/streams (public)
app.get('/:id/streams', optionalAuth(), async (c) => {
  const { id } = c.req.param();

  const streamsRaw = await c.env.KV.get('streams', 'json') as IptvStream[] | null;
  const streams = (streamsRaw ?? []).filter((s) => s.channel === id);

  const customStreams = await c.env.DB.prepare(
    'SELECT * FROM custom_streams WHERE channel_id = ? AND active = 1'
  )
    .bind(id)
    .all<CustomStream>();

  const healthReports = await c.env.DB.prepare(
    'SELECT stream_url, admin_override FROM stream_health_reports WHERE channel_id = ?'
  )
    .bind(id)
    .all<{ stream_url: string; admin_override: string | null }>();

  const hiddenUrls = new Set(
    healthReports.results
      .filter((r) => r.admin_override === 'hidden')
      .map((r) => r.stream_url)
  );
  const brokenUrls = new Set(
    healthReports.results
      .filter((r) => r.admin_override === null)
      .map((r) => r.stream_url)
  );

  const result = [
    ...streams
      .filter((s) => !hiddenUrls.has(s.url))
      .map((s) => ({
        url: s.url,
        quality: s.quality,
        http_referrer: s.http_referrer,
        user_agent: s.user_agent,
        is_broken: brokenUrls.has(s.url),
      })),
    ...customStreams.results
      .filter((cs) => !hiddenUrls.has(cs.url))
      .map((cs) => ({
        url: cs.url,
        quality: cs.quality,
        is_broken: brokenUrls.has(cs.url),
      })),
  ];

  return c.json(result);
});

// GET /api/channels/:id/epg (public)
app.get('/:id/epg', optionalAuth(), async (c) => {
  const { id } = c.req.param();
  const epgData = await c.env.KV.get(`epg:${id}`, 'json');
  if (!epgData) return c.json({ programs: [] });
  return c.json({ programs: epgData });
});

// POST /api/channels/:id/recently-watched
app.post('/:id/recently-watched', requireAuth(), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  await c.env.DB.prepare(
    `INSERT INTO recently_watched (user_id, channel_id, watched_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, channel_id) DO UPDATE SET watched_at = datetime('now')`
  )
    .bind(user.sub, id)
    .run();

  return c.json({ ok: true });
});

// GET /api/channels/recently-watched
app.get('/recently-watched', requireAuth(), async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT channel_id, watched_at FROM recently_watched
     WHERE user_id = ? ORDER BY watched_at DESC LIMIT 20`
  )
    .bind(user.sub)
    .all<{ channel_id: string; watched_at: string }>();

  return c.json(rows.results);
});

export default app;
