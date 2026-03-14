const IPTV_BASE = 'https://iptv-org.github.io/api';

const ENDPOINTS = [
  { key: 'channels', url: `${IPTV_BASE}/channels.json` },
  { key: 'streams', url: `${IPTV_BASE}/streams.json` },
  { key: 'categories', url: `${IPTV_BASE}/categories.json` },
  { key: 'countries', url: `${IPTV_BASE}/countries.json` },
  { key: 'languages', url: `${IPTV_BASE}/languages.json` },
  { key: 'guides', url: `${IPTV_BASE}/guides.json` },
  { key: 'blocklist', url: `${IPTV_BASE}/blocklist.json` },
];

export async function runKvRefresh(kv: KVNamespace): Promise<void> {
  console.log('[KV Refresh] Starting iptv-org data refresh...');

  const results = await Promise.allSettled(
    ENDPOINTS.map(async ({ key, url }) => {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'IPTV-App/1.0 (private-instance)' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
      const data = await resp.json();

      // For blocklist, store just the channel IDs
      if (key === 'blocklist') {
        const ids = (data as Array<{ channel: string }>).map((b) => b.channel);
        await kv.put(key, JSON.stringify(ids), { expirationTtl: 7 * 3600 });
      } else {
        await kv.put(key, JSON.stringify(data), { expirationTtl: 7 * 3600 });
      }

      console.log(`[KV Refresh] ${key}: OK (${JSON.stringify(data).length} bytes)`);
    })
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      console.error(`[KV Refresh] ${ENDPOINTS[i].key}: FAILED —`, r.reason);
    }
  }

  console.log('[KV Refresh] Done.');
}
