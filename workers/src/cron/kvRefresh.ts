// ============================================
// KV Refresh — Cron Job (every 6 hours)
//
// Fetches ALL iptv-org data and stores in KV:
// 1. M3U playlist (index.m3u) → parsed into structured channel+stream data
// 2. channels.json → rich metadata to enrich M3U entries
// 3. categories.json, countries.json, languages.json → filter options
// 4. blocklist.json → channels to hide
// 5. guides.json → EPG references
// ============================================

const IPTV_API = 'https://iptv-org.github.io/api';
const IPTV_M3U = 'https://iptv-org.github.io/iptv/index.m3u';

// ---------- M3U Parser ----------

interface M3UEntry {
  tvgId: string;
  tvgLogo: string;
  groupTitle: string;
  name: string;
  url: string;
  tvgLanguage: string;
  tvgCountry: string;
  userAgent: string;
  referrer: string;
}

function parseM3U(text: string): M3UEntry[] {
  const lines = text.split('\n');
  const entries: M3UEntry[] = [];
  let current: Partial<M3UEntry> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      current = {};

      // Parse attributes from #EXTINF line
      const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] ?? '';
      const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? '';
      const groupTitle = line.match(/group-title="([^"]*)"/)?.[1] ?? '';
      const tvgLanguage = line.match(/tvg-language="([^"]*)"/)?.[1] ?? '';
      const tvgCountry = line.match(/tvg-country="([^"]*)"/)?.[1] ?? '';
      const userAgent = line.match(/user-agent="([^"]*)"/)?.[1] ?? '';
      const referrer = line.match(/http-referrer="([^"]*)"/)?.[1] ?? '';

      // Channel name is after the last comma
      const lastComma = line.lastIndexOf(',');
      const name = lastComma !== -1 ? line.substring(lastComma + 1).trim() : '';

      current = { tvgId, tvgLogo, groupTitle, name, tvgLanguage, tvgCountry, userAgent, referrer };
    } else if (line.startsWith('#EXTVLCOPT:')) {
      // VLC options like http-referrer, http-user-agent
      if (current) {
        const refMatch = line.match(/http-referrer=(.*)/);
        if (refMatch) current.referrer = refMatch[1];
        const uaMatch = line.match(/http-user-agent=(.*)/);
        if (uaMatch) current.userAgent = uaMatch[1];
      }
    } else if (line && !line.startsWith('#') && current) {
      // This is the stream URL
      entries.push({
        tvgId: current.tvgId ?? '',
        tvgLogo: current.tvgLogo ?? '',
        groupTitle: current.groupTitle ?? '',
        name: current.name ?? '',
        url: line,
        tvgLanguage: current.tvgLanguage ?? '',
        tvgCountry: current.tvgCountry ?? '',
        userAgent: current.userAgent ?? '',
        referrer: current.referrer ?? '',
      });
      current = null;
    }
  }

  return entries;
}

// ---------- Types ----------

export interface ParsedChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  streams: ParsedStream[];
}

export interface ParsedStream {
  url: string;
  quality: string;
  http_referrer: string;
  user_agent: string;
}

interface IptvOrgChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  categories: string[];
  is_nsfw: boolean;
  [key: string]: unknown;
}

interface IptvOrgFeed {
  channel: string;   // e.g. "123tv.de"
  id: string;        // e.g. "SD", "Plus1", "Adelaide"
  languages: string[];
  broadcast_area: string[];
  [key: string]: unknown;
}

// ---------- Helpers ----------

// M3U tvg-id format: "ChannelId.cc@FeedId" → extract channel base id
function extractChannelId(tvgId: string): string {
  const atIdx = tvgId.indexOf('@');
  return atIdx !== -1 ? tvgId.substring(0, atIdx) : tvgId;
}

// ---------- Channel building ----------

function buildChannels(
  m3uEntries: M3UEntry[],
  channelMetadata: Map<string, IptvOrgChannel>,
  feedMap: Map<string, IptvOrgFeed>,
  blocklist: Set<string>
): ParsedChannel[] {
  // Group M3U entries by their base channel id (stripping @FeedId)
  const channelMap = new Map<string, { info: M3UEntry; streams: ParsedStream[]; feedIds: Set<string> }>();

  for (const entry of m3uEntries) {
    if (!entry.tvgId && !entry.name) continue;

    // Derive the base channel id for grouping and metadata lookup
    const baseChannelId = entry.tvgId ? extractChannelId(entry.tvgId) : '';
    const key = baseChannelId || entry.name;

    // Skip blocked channels
    if (blocklist.has(key) || blocklist.has(entry.tvgId)) continue;

    if (!channelMap.has(key)) {
      channelMap.set(key, { info: entry, streams: [], feedIds: new Set() });
    }

    const existing = channelMap.get(key)!;

    // Track feed ids for language lookup
    if (entry.tvgId) existing.feedIds.add(entry.tvgId);

    // Avoid duplicate stream URLs per channel
    if (!existing.streams.some((s) => s.url === entry.url)) {
      existing.streams.push({
        url: entry.url,
        quality: 'auto',
        http_referrer: entry.referrer,
        user_agent: entry.userAgent,
      });
    }
  }

  // Build final channel list, enriching with API metadata
  const channels: ParsedChannel[] = [];

  for (const [key, { info, streams, feedIds }] of channelMap) {
    // Look up channel metadata using the base channel id
    const meta = channelMetadata.get(key);

    // Collect languages from all feeds associated with this channel
    const languageSet = new Set<string>();
    for (const fullTvgId of feedIds) {
      const feed = feedMap.get(fullTvgId);
      if (feed?.languages) {
        for (const lang of feed.languages) languageSet.add(lang);
      }
    }
    // Fallback: also look up feeds by base channel id + common feed ids
    if (languageSet.size === 0) {
      for (const feedId of ['SD', 'HD', 'FHD']) {
        const feed = feedMap.get(`${key}@${feedId}`);
        if (feed?.languages) {
          for (const lang of feed.languages) languageSet.add(lang);
        }
      }
    }

    // Fallback to M3U tvg-language if still empty
    const languages = languageSet.size > 0
      ? [...languageSet]
      : (info.tvgLanguage ? info.tvgLanguage.split(';').filter(Boolean) : []);

    channels.push({
      id: key,
      name: meta?.name || info.name,
      logo: meta?.logo || info.tvgLogo,
      country: meta?.country || info.tvgCountry.split(';')[0] || '',
      languages,
      categories: meta?.categories || (info.groupTitle ? info.groupTitle.split(';') : []),
      is_nsfw: meta?.is_nsfw ?? false,
      streams,
    });
  }

  // Sort alphabetically
  channels.sort((a, b) => a.name.localeCompare(b.name));

  return channels;
}

// ---------- Main refresh function ----------

export async function runKvRefresh(kv: KVNamespace): Promise<void> {
  console.log('[KV Refresh] Starting full data refresh...');
  const TTL = 7 * 3600; // 7 hours (slightly > 6h cron interval)

  // Fetch all data sources in parallel
  const [m3uRes, channelsRes, feedsRes, categoriesRes, countriesRes, languagesRes, blocklistRes, guidesRes] =
    await Promise.all([
      fetch(IPTV_M3U, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/channels.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/feeds.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/categories.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/countries.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/languages.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/blocklist.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
      fetch(`${IPTV_API}/guides.json`, { headers: { 'User-Agent': 'StreamVault/1.0' } }),
    ]);

  // ---------- 1. Parse M3U ----------
  if (!m3uRes.ok) {
    console.error(`[KV Refresh] M3U fetch failed: HTTP ${m3uRes.status}`);
    return;
  }
  const m3uText = await m3uRes.text();
  const m3uEntries = parseM3U(m3uText);
  console.log(`[KV Refresh] M3U parsed: ${m3uEntries.length} stream entries`);

  // ---------- 2. Parse channels.json for metadata enrichment ----------
  const channelMetadata = new Map<string, IptvOrgChannel>();
  if (channelsRes.ok) {
    const channelsData: IptvOrgChannel[] = await channelsRes.json();
    for (const ch of channelsData) {
      channelMetadata.set(ch.id, ch);
    }
    console.log(`[KV Refresh] Channel metadata: ${channelMetadata.size} entries`);
  }

  // ---------- 3. Parse feeds.json for language data ----------
  const feedMap = new Map<string, IptvOrgFeed>();
  if (feedsRes.ok) {
    const feedsData: IptvOrgFeed[] = await feedsRes.json();
    for (const feed of feedsData) {
      // Key: "ChannelId.cc@FeedId" — matches the full tvg-id from M3U
      const fullId = `${feed.channel}@${feed.id}`;
      feedMap.set(fullId, feed);
    }
    console.log(`[KV Refresh] Feeds: ${feedMap.size} entries`);
  }

  // ---------- 4. Parse blocklist ----------
  const blocklist = new Set<string>();
  if (blocklistRes.ok) {
    const blocklistData: { channel: string }[] = await blocklistRes.json();
    for (const b of blocklistData) {
      blocklist.add(b.channel);
    }
    console.log(`[KV Refresh] Blocklist: ${blocklist.size} blocked channels`);
  }

  // ---------- 5. Build channels ----------
  const channels = buildChannels(m3uEntries, channelMetadata, feedMap, blocklist);
  console.log(`[KV Refresh] Built ${channels.length} unique channels`);

  // ---------- 6. Store in KV ----------
  const channelsJson = JSON.stringify(channels);
  console.log(`[KV Refresh] Channels data size: ${(channelsJson.length / 1024 / 1024).toFixed(2)} MB`);
  await kv.put('channels', channelsJson, { expirationTtl: TTL });

  // Store metadata for filter dropdowns
  const storeIfOk = async (key: string, res: Response) => {
    if (res.ok) {
      const data = await res.json();
      await kv.put(key, JSON.stringify(data), { expirationTtl: TTL });
      console.log(`[KV Refresh] ${key}: OK`);
    } else {
      console.error(`[KV Refresh] ${key}: FAILED (HTTP ${res.status})`);
    }
  };

  await Promise.all([
    storeIfOk('categories', categoriesRes),
    storeIfOk('countries', countriesRes),
    storeIfOk('languages', languagesRes),
    storeIfOk('guides', guidesRes),
  ]);

  // Store blocklist IDs
  await kv.put('blocklist', JSON.stringify([...blocklist]), { expirationTtl: TTL });

  // Store refresh timestamp
  await kv.put('last_refresh', new Date().toISOString(), { expirationTtl: TTL });

  console.log('[KV Refresh] Done!');
}
