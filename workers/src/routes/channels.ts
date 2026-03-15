import { Hono } from 'hono';
import { optionalAuth } from '../lib/middleware';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// URLs de iptv-org
const IPTV_ORG_API = 'https://iptv-org.github.io/api';

interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string;
  owners: string[];
  country: string;
  subdivision: string;
  city: string;
  broadcast_area: string[];
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  launched: string;
  closed: string;
  replaced_by: string;
  website: string;
  logo: string;
}

interface IptvStream {
  channel: string;
  url: string;
  http_referrer: string;
  user_agent: string;
  status: string;
  width: number;
  height: number;
  bitrate: number;
  frame_rate: number;
}

// GET /api/channels - Fetch from iptv-org API
app.get('/', optionalAuth(), async (c) => {
  try {
    const q = c.req.query();
    const country = q.country;
    const language = q.language;
    const category = q.category;
    const search = q.search?.toLowerCase();

    // Fetch from iptv-org
    const [channelsRes, streamsRes] = await Promise.all([
      fetch(`${IPTV_ORG_API}/channels.json`),
      fetch(`${IPTV_ORG_API}/streams.json`)
    ]);

    const channels: IptvChannel[] = await channelsRes.json();
    const streams: IptvStream[] = await streamsRes.json();

    // Build stream map
    const streamMap = new Map<string, IptvStream[]>();
    for (const s of streams) {
      if (s.status === 'online') {
        if (!streamMap.has(s.channel)) streamMap.set(s.channel, []);
        streamMap.get(s.channel)!.push(s);
      }
    }

    // Filter and map channels
    let result = channels
      .filter(ch => {
        if (country && ch.country !== country) return false;
        if (language && !ch.languages.includes(language)) return false;
        if (category && !ch.categories.includes(category)) return false;
        if (search && !ch.name.toLowerCase().includes(search)) return false;
        return streamMap.has(ch.id); // Only channels with streams
      })
      .slice(0, 100) // Limit for performance
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        logo: ch.logo || '',
        country: ch.country,
        languages: ch.languages,
        categories: ch.categories,
        is_nsfw: ch.is_nsfw,
        streams: (streamMap.get(ch.id) || []).map(s => ({
          url: s.url,
          quality: s.height ? `${s.height}p` : 'unknown',
          http_referrer: s.http_referrer,
          user_agent: s.user_agent,
          is_broken: s.status !== 'online'
        })),
        is_custom: false
      }));

    return c.json(result);
  } catch (e) {
    console.error('Error fetching channels:', e);
    return c.json([], 500);
  }
});

// GET /api/channels/:id/streams
app.get('/:id/streams', optionalAuth(), async (c) => {
  try {
    const { id } = c.req.param();
    
    const streamsRes = await fetch(`${IPTV_ORG_API}/streams.json`);
    const streams: IptvStream[] = await streamsRes.json();
    
    const channelStreams = streams
      .filter(s => s.channel === id && s.status === 'online')
      .map(s => ({
        url: s.url,
        quality: s.height ? `${s.height}p` : 'unknown',
        http_referrer: s.http_referrer,
        user_agent: s.user_agent,
        is_broken: false
      }));

    return c.json(channelStreams);
  } catch (e) {
    console.error('Error fetching streams:', e);
    return c.json([]);
  }
});

// GET /api/channels/:id/epg
app.get('/:id/epg', optionalAuth(), async (c) => {
  return c.json({ programs: [] }); // EPG requiere implementación adicional
});

export default app;
