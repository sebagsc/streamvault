import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../lib/middleware';
import type { Env, CustomStream } from '../types';
import type { ParsedChannel } from '../cron/kvRefresh';

const app = new Hono<{ Bindings: Env }>();

// GET /api/channels — returns channels from KV cache + custom streams from D1
app.get('/', optionalAuth(), async (c) => {
  try {
    // Query params
    const country = c.req.query('country');
    const language = c.req.query('language');
    const category = c.req.query('category');
    const nsfw = c.req.query('nsfw');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

    // Load channels from KV
    const channelsRaw = await c.env.KV.get('channels');
    if (!channelsRaw) {
      return c.json({ channels: [], total: 0, page, message: 'Cache empty — try again after cron runs' });
    }

    let channels: ParsedChannel[] = JSON.parse(channelsRaw);

    // --- Filter: NSFW ---
    if (nsfw !== 'true') {
      channels = channels.filter((ch) => !ch.is_nsfw);
    }

    // --- Filter: Country ---
    if (country) {
      const countries = country.split(',').map((v) => v.trim().toUpperCase());
      channels = channels.filter((ch) => countries.includes(ch.country.toUpperCase()));
    }

    // --- Filter: Language ---
    if (language) {
      const langs = language.split(',').map((v) => v.trim().toLowerCase());
      channels = channels.filter((ch) =>
        ch.languages.some((l) => langs.includes(l.toLowerCase()))
      );
    }

    // --- Filter: Category ---
    if (category) {
      const cats = category.split(',').map((v) => v.trim().toLowerCase());
      channels = channels.filter((ch) =>
        ch.categories.some((ct) => cats.includes(ct.toLowerCase()))
      );
    }

    // --- Filter: Search ---
    if (search) {
      const q = search.toLowerCase();
      channels = channels.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          ch.id.toLowerCase().includes(q) ||
          ch.country.toLowerCase().includes(q) ||
          ch.categories.some((ct) => ct.toLowerCase().includes(q))
      );
    }

    // --- Merge custom streams from D1 ---
    try {
      const customStreams = await c.env.DB.prepare(
        'SELECT * FROM custom_streams WHERE active = 1'
      ).all<CustomStream>();

      if (customStreams.results.length > 0) {
        for (const cs of customStreams.results) {
          if (cs.channel_id) {
            // Append stream to existing channel
            const existing = channels.find((ch) => ch.id === cs.channel_id);
            if (existing) {
              existing.streams.push({
                url: cs.url,
                quality: cs.quality || 'custom',
                http_referrer: '',
                user_agent: '',
              });
            }
          } else {
            // Fully custom channel
            const shouldInclude =
              (!country || (cs.country && country.toUpperCase().split(',').includes(cs.country.toUpperCase()))) &&
              (!category || (cs.category && category.toLowerCase().split(',').includes(cs.category.toLowerCase()))) &&
              (!search || cs.title.toLowerCase().includes(search.toLowerCase()));

            if (shouldInclude && (nsfw === 'true' || !cs.is_nsfw)) {
              channels.push({
                id: `custom_${cs.id}`,
                name: cs.title,
                logo: '',
                country: cs.country || '',
                languages: cs.language ? [cs.language] : [],
                categories: cs.category ? [cs.category] : [],
                is_nsfw: !!cs.is_nsfw,
                streams: [{ url: cs.url, quality: cs.quality || 'custom', http_referrer: '', user_agent: '' }],
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching custom streams:', e);
    }

    // Pagination
    const total = channels.length;
    const offset = (page - 1) * limit;
    const paginated = channels.slice(offset, offset + limit);

    return c.json({
      channels: paginated.map((ch) => ({
        ...ch,
        is_custom: ch.id.startsWith('custom_'),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    console.error('Error in /api/channels:', e);
    return c.json({ error: 'Failed to fetch channels', details: e.message }, 500);
  }
});

// GET /api/channels/:id/streams — get streams for a specific channel
app.get('/:id/streams', optionalAuth(), async (c) => {
  const { id } = c.req.param();

  try {
    const channelsRaw = await c.env.KV.get('channels');
    if (!channelsRaw) return c.json([]);

    const channels: ParsedChannel[] = JSON.parse(channelsRaw);
    const channel = channels.find((ch) => ch.id === id);

    if (!channel) return c.json([]);

    // Also append any custom streams for this channel
    const customStreams = await c.env.DB.prepare(
      'SELECT * FROM custom_streams WHERE channel_id = ? AND active = 1'
    ).all<CustomStream>();

    const allStreams = [
      ...channel.streams,
      ...customStreams.results.map((cs) => ({
        url: cs.url,
        quality: cs.quality || 'custom',
        http_referrer: '',
        user_agent: '',
      })),
    ];

    return c.json(allStreams);
  } catch (e) {
    console.error('Error fetching streams:', e);
    return c.json([]);
  }
});

// GET /api/channels/:id/epg — placeholder for EPG data
app.get('/:id/epg', optionalAuth(), async (c) => {
  return c.json({ programs: [] });
});

// POST /api/channels/:id/watched — mark a channel as recently watched
app.post('/:id/watched', requireAuth(), async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO recently_watched (user_id, channel_id, watched_at) VALUES (?, ?, datetime('now'))`
  )
    .bind(user.sub, id)
    .run();

  return c.json({ ok: true });
});

export default app;
