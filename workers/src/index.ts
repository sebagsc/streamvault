import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import inviteRoutes from './routes/invite';
import usersRoutes from './routes/users';
import channelsRoutes from './routes/channels';
import streamsRoutes from './routes/streams';
import eventsRoutes from './routes/events';
import pushRoutes from './routes/push';
import metaRoutes from './routes/meta';
import chatRoutes from './routes/chat';
import presenceRoutes from './routes/presence';
import { runKvRefresh } from './cron/kvRefresh';
import { runPushSender } from './cron/pushSender';
import { requireAdmin } from './lib/middleware';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS - Permitir múltiples orígenes
app.use('*', async (c, next) => {
  const allowedOrigins = [
    c.env.FRONTEND_URL,
    'https://iptv-frontend-2x9.pages.dev',
    'https://iptv-frontend.pages.dev',
    'http://localhost:5173',
  ].filter(Boolean);
  
  const origin = c.req.header('origin');
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '*';
  
  const handler = cors({
    origin: allowOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return handler(c, next);
});

// Health check
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/invite', inviteRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/channels', channelsRoutes);
app.route('/api/streams', streamsRoutes);
app.route('/api/events', eventsRoutes);
app.route('/api/push', pushRoutes);
app.route('/api/meta', metaRoutes);
app.route('/api/chat', chatRoutes);           // Polling chat endpoints
app.route('/api/presence', presenceRoutes);   // Polling presence endpoints

// Admin: seed initial admin user
app.post('/api/admin/seed', async (c) => {
  const { secret, email, password } = await c.req.json<{
    secret: string;
    email: string;
    password: string;
  }>();

  if (secret !== c.env.JWT_SECRET) {
    return c.json({ error: 'Invalid seed secret' }, 403);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE role = ?')
    .bind('admin')
    .first();

  if (existing) {
    return c.json({ error: 'Admin already exists' }, 409);
  }

  const { hashPassword, generateId, generateTotpSecret, buildTotpUri } = await import('./lib/crypto');
  const id = generateId();
  const passwordHash = await hashPassword(password);
  const totpSecret = generateTotpSecret();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, totp_secret, totp_confirmed, role, active)
     VALUES (?, ?, ?, ?, 0, 'admin', 1)`
  )
    .bind(id, email.toLowerCase(), passwordHash, totpSecret)
    .run();

  const totpUri = buildTotpUri(totpSecret, email, c.env.TOTP_ISSUER_NAME);
  return c.json({ ok: true, user_id: id, totp_uri: totpUri });
});

// Admin: manually trigger KV refresh (secret-based, for CLI/cron)
// Runs synchronously so errors are visible in the response
app.post('/api/admin/refresh-kv', async (c) => {
  const { secret } = await c.req.json<{ secret: string }>();
  if (secret !== c.env.JWT_SECRET) {
    return c.json({ error: 'Invalid secret' }, 403);
  }
  try {
    await runKvRefresh(c.env.KV);
    return c.json({ ok: true, message: 'Refresh completed' });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Admin: trigger KV refresh (JWT-authenticated, for admin panel)
app.post('/api/admin/refresh-sources', requireAdmin(), async (c) => {
  c.executionCtx.waitUntil(runKvRefresh(c.env.KV));
  return c.json({ ok: true, message: 'Refresh started in background' });
});

// Admin: get refresh status with source breakdown
app.get('/api/admin/refresh-status', requireAdmin(), async (c) => {
  const lastRefresh = await c.env.KV.get('last_refresh');
  // Count channels per source from KV cache
  const channelsRaw = await c.env.KV.get('channels');
  const sourceCounts: Record<string, number> = {};
  if (channelsRaw) {
    const channels: { source: string }[] = JSON.parse(channelsRaw);
    for (const ch of channels) {
      sourceCounts[ch.source] = (sourceCounts[ch.source] || 0) + 1;
    }
  }
  return c.json({ last_refresh: lastRefresh, sources: sourceCounts, total: Object.values(sourceCounts).reduce((a, b) => a + b, 0) });
});

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Scheduled handler (cron)
async function scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron;
  console.log(`[Cron] Triggered: ${cron}`);

  if (cron === '0 */6 * * *') {
    await runKvRefresh(env.KV);
  } else if (cron === '* * * * *') {
    await runPushSender(env);
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
