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
