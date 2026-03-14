import { Hono } from 'hono';
import { requireAuth } from '../lib/middleware';
import { generateId } from '../lib/crypto';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// POST /api/push/subscribe
app.post('/subscribe', requireAuth(), async (c) => {
  const user = c.get('user');
  const { endpoint, keys } = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ error: 'endpoint and keys.p256dh, keys.auth required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  )
    .bind(id, user.sub, endpoint, keys.p256dh, keys.auth)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/push/subscribe
app.delete('/subscribe', requireAuth(), async (c) => {
  const user = c.get('user');
  const { endpoint } = await c.req.json<{ endpoint: string }>();

  await c.env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  )
    .bind(user.sub, endpoint)
    .run();

  return c.json({ ok: true });
});

// GET /api/push/preferences
app.get('/preferences', requireAuth(), async (c) => {
  const user = c.get('user');
  const row = await c.env.DB.prepare(
    'SELECT notification_lead_time FROM users WHERE id = ?'
  )
    .bind(user.sub)
    .first<{ notification_lead_time: number }>();

  return c.json({ notification_lead_time: row?.notification_lead_time ?? 15 });
});

// PATCH /api/push/preferences
app.patch('/preferences', requireAuth(), async (c) => {
  const user = c.get('user');
  const { notification_lead_time } = await c.req.json<{ notification_lead_time: number }>();

  if (![5, 15, 30].includes(notification_lead_time)) {
    return c.json({ error: 'notification_lead_time must be 5, 15, or 30' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET notification_lead_time = ? WHERE id = ?')
    .bind(notification_lead_time, user.sub)
    .run();

  return c.json({ ok: true });
});

// GET /api/push/vapid-public-key — return VAPID public key for client subscription
app.get('/vapid-public-key', (c) => {
  return c.json({ public_key: c.env.VAPID_PUBLIC_KEY });
});

export default app;
