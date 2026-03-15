import { Hono } from 'hono';
import { optionalAuth } from '../lib/middleware';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

const IPTV_ORG_API = 'https://iptv-org.github.io/api';

// GET /api/channels - Fetch from iptv-org API
app.get('/', optionalAuth(), async (c) => {
  try {
    console.log('Fetching channels from iptv-org...');
    
    // Fetch from iptv-org
    const channelsRes = await fetch(`${IPTV_ORG_API}/channels.json`);
    const streamsRes = await fetch(`${IPTV_ORG_API}/streams.json`);
    
    console.log('Channels status:', channelsRes.status);
    console.log('Streams status:', streamsRes.status);
    
    if (!channelsRes.ok || !streamsRes.ok) {
      throw new Error(`HTTP error: ${channelsRes.status}, ${streamsRes.status}`);
    }
    
    const channels = await channelsRes.json();
    const streams = await streamsRes.json();
    
    console.log('Total channels:', channels.length);
    console.log('Total streams:', streams.length);

    // Build stream map
    const streamMap = new Map();
    for (const s of streams) {
      if (!streamMap.has(s.channel)) streamMap.set(s.channel, []);
      streamMap.get(s.channel).push(s);
    }
    
    console.log('Channels with streams:', streamMap.size);

    // Map channels with their streams
    const result = channels
      .filter(ch => streamMap.has(ch.id))
      .slice(0, 50)
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        logo: ch.logo || '',
        country: ch.country || '',
        languages: ch.languages || [],
        categories: ch.categories || [],
        is_nsfw: ch.is_nsfw || false,
        streams: (streamMap.get(ch.id) || []).map(s => ({
          url: s.url,
          quality: s.height ? `${s.height}p` : 'unknown',
          http_referrer: s.http_referrer || '',
          user_agent: s.user_agent || '',
          is_broken: false
        })),
        is_custom: false
      }));
    
    console.log('Returning channels:', result.length);
    return c.json(result);
    
  } catch (e) {
    console.error('Error fetching channels:', e);
    return c.json({ error: 'Failed to fetch channels', details: e.message }, 500);
  }
});

// GET /api/channels/:id/streams
app.get('/:id/streams', optionalAuth(), async (c) => {
  try {
    const { id } = c.req.param();
    
    const streamsRes = await fetch(`${IPTV_ORG_API}/streams.json`);
    const streams = await streamsRes.json();
    
    const channelStreams = streams
      .filter(s => s.channel === id)
      .map(s => ({
        url: s.url,
        quality: s.height ? `${s.height}p` : 'unknown',
        http_referrer: s.http_referrer || '',
        user_agent: s.user_agent || '',
        is_broken: false
      }));

    return c.json(channelStreams);
  } catch (e) {
    console.error('Error:', e);
    return c.json([]);
  }
});

// GET /api/channels/:id/epg
app.get('/:id/epg', optionalAuth(), async (c) => {
  return c.json({ programs: [] });
});

export default app;
