// ============================================
// KV Refresh — Cron Job (every 6 hours)
//
// Fetches data from MULTIPLE sources and merges:
//  1. Free-TV/IPTV (curated, reliable — highest priority)
//  2. Xumo (389 channels, US FAST)
//  3. Roku Channel (328 channels, US FAST)
//  4. Vizio (424 channels, US FAST)
//  5. LG Channels (1286 channels, multi-region)
//  6. iptv-org (comprehensive 10k+ — lowest priority)
// Also fetches metadata from iptv-org API for enrichment.
// ============================================

const IPTV_API = 'https://iptv-org.github.io/api';
const IPTV_M3U = 'https://iptv-org.github.io/iptv/index.m3u';
const FREETV_M3U = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const XUMO_M3U = 'https://www.apsattv.com/xumo.m3u';
const ROKU_M3U = 'https://www.apsattv.com/rok.m3u';
const VIZIO_M3U = 'https://www.apsattv.com/vizio.m3u';
const LG_M3U = 'https://www.apsattv.com/lg.m3u';

type SourceTag = 'freetv' | 'xumo' | 'roku' | 'vizio' | 'lg' | 'iptv-org';

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
  source: SourceTag;
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
  blocklist: Set<string>,
  source: SourceTag = 'iptv-org'
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
      source,
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

  // Fetch data in sequential batches of 4 to stay within Workers 6-connection limit.
  // Each batch is fully consumed (text/json) before starting the next to free connections.
  const ua = { headers: { 'User-Agent': 'StreamVault/1.0' } };

  const fetchText = async (url: string, name: string): Promise<string> => {
    try {
      const res = await fetch(url, ua);
      if (!res.ok) {
        console.error(`[KV Refresh] ${name} fetch failed: HTTP ${res.status}`);
        return '';
      }
      return await res.text();
    } catch (err: any) {
      console.error(`[KV Refresh] ${name} fetch error: ${err.message}`);
      return '';
    }
  };

  const fetchJson = async <T>(url: string, name: string): Promise<T | null> => {
    try {
      const res = await fetch(url, ua);
      if (!res.ok) {
        console.error(`[KV Refresh] ${name} fetch failed: HTTP ${res.status}`);
        return null;
      }
      return await res.json() as T;
    } catch (err: any) {
      console.error(`[KV Refresh] ${name} fetch error: ${err.message}`);
      return null;
    }
  };

  // Batch 1: Core M3U playlists (4 concurrent)
  const [freeTvText, m3uText, xumoText, rokuText] = await Promise.all([
    fetchText(FREETV_M3U, 'Free-TV'),
    fetchText(IPTV_M3U, 'iptv-org'),
    fetchText(XUMO_M3U, 'Xumo'),
    fetchText(ROKU_M3U, 'Roku'),
  ]);

  // Batch 2: More M3U + metadata JSON (4 concurrent)
  const [vizioText, lgText, channelsData, feedsData] = await Promise.all([
    fetchText(VIZIO_M3U, 'Vizio'),
    fetchText(LG_M3U, 'LG'),
    fetchJson<IptvOrgChannel[]>(`${IPTV_API}/channels.json`, 'channels.json'),
    fetchJson<IptvOrgFeed[]>(`${IPTV_API}/feeds.json`, 'feeds.json'),
  ]);

  // Batch 3: Remaining metadata (4 concurrent)
  const [blocklistData, categoriesData, countriesData, languagesData] = await Promise.all([
    fetchJson<{ channel: string }[]>(`${IPTV_API}/blocklist.json`, 'blocklist'),
    fetchJson<{ id: string; name: string }[]>(`${IPTV_API}/categories.json`, 'categories'),
    fetchJson<{ code: string; name: string; flag: string }[]>(`${IPTV_API}/countries.json`, 'countries'),
    fetchJson<{ code: string; name: string }[]>(`${IPTV_API}/languages.json`, 'languages'),
  ]);

  // Batch 4: Guides (1 fetch)
  const guidesData = await fetchJson<any[]>(`${IPTV_API}/guides.json`, 'guides');

  // ---------- 1. Parse M3U playlists from all sources ----------
  const parseEntries = (text: string, name: string): M3UEntry[] => {
    if (!text) return [];
    const entries = parseM3U(text);
    console.log(`[KV Refresh] ${name}: ${entries.length} stream entries`);
    return entries;
  };

  const freeTvEntries = parseEntries(freeTvText, 'Free-TV');
  const xumoEntries = parseEntries(xumoText, 'Xumo');
  const rokuEntries = parseEntries(rokuText, 'Roku');
  const vizioEntries = parseEntries(vizioText, 'Vizio');
  const lgEntries = parseEntries(lgText, 'LG');
  const m3uEntries = parseEntries(m3uText, 'iptv-org');

  if (freeTvEntries.length === 0 && m3uEntries.length === 0 &&
      xumoEntries.length === 0 && rokuEntries.length === 0) {
    console.error('[KV Refresh] No sources returned data, aborting');
    return;
  }

  // ---------- 2. Parse channels.json for metadata enrichment ----------
  const channelMetadata = new Map<string, IptvOrgChannel>();
  if (channelsData) {
    for (const ch of channelsData) {
      channelMetadata.set(ch.id, ch);
    }
    console.log(`[KV Refresh] Channel metadata: ${channelMetadata.size} entries`);
  }

  // ---------- 3. Parse feeds.json for language data ----------
  const feedMap = new Map<string, IptvOrgFeed>();
  if (feedsData) {
    for (const feed of feedsData) {
      const fullId = `${feed.channel}@${feed.id}`;
      feedMap.set(fullId, feed);
    }
    console.log(`[KV Refresh] Feeds: ${feedMap.size} entries`);
  }

  // ---------- 4. Parse blocklist ----------
  const blocklist = new Set<string>();
  if (blocklistData) {
    for (const b of blocklistData) {
      blocklist.add(b.channel);
    }
    console.log(`[KV Refresh] Blocklist: ${blocklist.size} blocked channels`);
  }

  // ---------- 5. Build channels from all sources ----------
  // Build each source separately
  const sourceSets: { tag: SourceTag; entries: M3UEntry[] }[] = [
    { tag: 'iptv-org', entries: m3uEntries },     // lowest priority (added first)
    { tag: 'lg', entries: lgEntries },
    { tag: 'vizio', entries: vizioEntries },
    { tag: 'roku', entries: rokuEntries },
    { tag: 'xumo', entries: xumoEntries },
    { tag: 'freetv', entries: freeTvEntries },     // highest priority (added last, overwrites)
  ];

  // Language filter: only keep channels in these languages to save KV space.
  // Applies mainly to iptv-org (10k+ channels); curated sources are kept as-is.
  const ALLOWED_LANGS = new Set(['eng', 'spa', 'jpn']);

  const passesLangFilter = (ch: ParsedChannel): boolean => {
    // Curated sources (not iptv-org) are always kept
    if (ch.source !== 'iptv-org') return true;
    // Keep if channel has at least one allowed language
    if (ch.languages.some((l) => ALLOWED_LANGS.has(l))) return true;
    // Keep if no language info at all (unknown → don't discard)
    if (ch.languages.length === 0) return true;
    return false;
  };

  // Merge: later sources overwrite earlier ones for same channel id
  const channelById = new Map<string, ParsedChannel>();
  const sourceCounts: Record<string, number> = {};

  for (const { tag, entries } of sourceSets) {
    if (entries.length === 0) continue;
    const built = buildChannels(entries, channelMetadata, feedMap, blocklist, tag);
    const filtered = built.filter(passesLangFilter);
    sourceCounts[tag] = filtered.length;
    console.log(`[KV Refresh] ${tag}: ${built.length} built → ${filtered.length} after lang filter`);
    for (const ch of filtered) {
      channelById.set(ch.id, ch);
    }
  }

  const channels = [...channelById.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[KV Refresh] Merged: ${channels.length} unique channels`);

  // ---------- 6. Store in KV ----------
  const channelsJson = JSON.stringify(channels);
  console.log(`[KV Refresh] Channels data size: ${(channelsJson.length / 1024 / 1024).toFixed(2)} MB`);
  await kv.put('channels', channelsJson, { expirationTtl: TTL });

  // Build filtered metadata lists from actual channel data (only items with channels)
  const allLanguages = languagesData || [];
  const allCountries = countriesData || [];
  const allCategories = categoriesData || [];

  const langNameMap = new Map(allLanguages.map((l) => [l.code, l.name]));
  const countryNameMap = new Map(allCountries.map((c) => [c.code, { name: c.name, flag: c.flag }]));
  const catNameMap = new Map(allCategories.map((c) => [c.id, c.name]));

  // Count channels per language, country, and category
  const langCount = new Map<string, number>();
  const countryCount = new Map<string, number>();
  const catCount = new Map<string, number>();

  for (const ch of channels) {
    for (const lang of ch.languages) {
      langCount.set(lang, (langCount.get(lang) || 0) + 1);
    }
    if (ch.country) {
      countryCount.set(ch.country, (countryCount.get(ch.country) || 0) + 1);
    }
    for (const cat of ch.categories) {
      catCount.set(cat, (catCount.get(cat) || 0) + 1);
    }
  }

  // Build sorted lists (most channels first)
  const filteredLanguages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, name: langNameMap.get(code) || code, count }));

  const filteredCountries = [...countryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => {
      const info = countryNameMap.get(code);
      return { code, name: info?.name || code, flag: info?.flag || '', count };
    });

  const filteredCategories = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, name: catNameMap.get(id) || id, count }));

  console.log(`[KV Refresh] Filters: ${filteredLanguages.length} languages, ${filteredCountries.length} countries, ${filteredCategories.length} categories`);

  await Promise.all([
    kv.put('languages', JSON.stringify(filteredLanguages), { expirationTtl: TTL }),
    kv.put('countries', JSON.stringify(filteredCountries), { expirationTtl: TTL }),
    kv.put('categories', JSON.stringify(filteredCategories), { expirationTtl: TTL }),
    guidesData
      ? kv.put('guides', JSON.stringify(guidesData), { expirationTtl: TTL })
      : Promise.resolve(),
  ]);

  // Store blocklist IDs
  await kv.put('blocklist', JSON.stringify([...blocklist]), { expirationTtl: TTL });

  // Store refresh timestamp
  await kv.put('last_refresh', new Date().toISOString(), { expirationTtl: TTL });

  console.log('[KV Refresh] Done!');
}
