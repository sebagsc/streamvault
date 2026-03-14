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
import { runKvRefresh } from './cron/kvRefresh';
import { runPushSender } from './cron/pushSender';
import type { Env } from './types';

export { ChannelRoom } from './durable-objects/ChannelRoom';
export { SitePresence } from './durable-objects/SitePresence';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', async (c, next) => {
  const origin = c.env.FRONTEND_URL ?? '*';
  const handler = cors({
    origin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return handler(c, next);
});

// Health check
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// WebSocket endpoint for channel rooms
app.get('/api/ws/:channelId', async (c) => {
  const { channelId } = c.req.param();
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426);
  }

  const userId = c.req.query('userId') ?? 'anon';
  const username = c.req.query('username') ?? 'Anonymous';
  const isAdmin = c.req.query('isAdmin') === 'true';

  const id = c.env.CHANNEL_ROOM.idFromName(channelId);
  const room = c.env.CHANNEL_ROOM.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('userId', userId);
  url.searchParams.set('username', username);
  url.searchParams.set('isAdmin', isAdmin ? 'true' : 'false');

  return room.fetch(new Request(url.toString(), c.req.raw));
});

// Site presence count
app.get('/api/presence', async (c) => {
  const id = c.env.SITE_PRESENCE.idFromName('global');
  const presence = c.env.SITE_PRESENCE.get(id);
  const resp = await presence.fetch('http://internal/total');
  return resp;
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/invite', inviteRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/channels', channelsRoutes);
app.route('/api/streams', streamsRoutes);
app.route('/api/events', eventsRoutes);
app.route('/api/push', pushRoutes);
app.route('/api/meta', metaRoutes);

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
