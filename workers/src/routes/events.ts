import { Hono } from 'hono';
import { requireAdmin, requireAuth } from '../lib/middleware';
import { generateId } from '../lib/crypto';
import type { Env, Event } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/events — upcoming events
app.get('/', requireAuth(), async (c) => {
  const user = c.get('user');
  const events = await c.env.DB.prepare(
    `SELECT e.*,
            CASE WHEN es.user_id IS NOT NULL THEN 1 ELSE 0 END as subscribed
     FROM events e
     LEFT JOIN event_subscriptions es ON e.id = es.event_id AND es.user_id = ?
     WHERE e.event_datetime >= datetime('now')
     ORDER BY e.event_datetime ASC`
  )
    .bind(user.sub)
    .all<Event & { subscribed: number }>();

  return c.json(events.results);
});

// POST /api/events — admin only
app.post('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    channel_id: string;
    title: string;
    description?: string;
    image_url?: string;
    event_datetime: string;
  }>();

  if (!body.channel_id || !body.title || !body.event_datetime) {
    return c.json({ error: 'channel_id, title, and event_datetime are required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO events (id, channel_id, title, description, image_url, event_datetime, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.channel_id,
      body.title,
      body.description ?? null,
      body.image_url ?? null,
      body.event_datetime,
      user.sub
    )
    .run();

  return c.json({ ok: true, id });
});

// PATCH /api/events/:id — admin only
app.patch('/:id', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{
    title?: string;
    description?: string;
    image_url?: string;
    event_datetime?: string;
    channel_id?: string;
  }>();

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.title !== undefined) { updates.push('title = ?'); bindings.push(body.title); }
  if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description); }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); bindings.push(body.image_url); }
  if (body.event_datetime !== undefined) { updates.push('event_datetime = ?'); bindings.push(body.event_datetime); }
  if (body.channel_id !== undefined) { updates.push('channel_id = ?'); bindings.push(body.channel_id); }

  if (updates.length > 0) {
    bindings.push(id);
    await c.env.DB.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  return c.json({ ok: true });
});

// DELETE /api/events/:id — admin only
app.delete('/:id', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM event_subscriptions WHERE event_id = ?').bind(id).run();
  return c.json({ ok: true });
});

// POST /api/events/:id/subscribe
app.post('/:id/subscribe', requireAuth(), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO event_subscriptions (user_id, event_id) VALUES (?, ?)`
  )
    .bind(user.sub, id)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/events/:id/subscribe
app.delete('/:id/subscribe', requireAuth(), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM event_subscriptions WHERE user_id = ? AND event_id = ?'
  )
    .bind(user.sub, id)
    .run();

  return c.json({ ok: true });
});

export default app;
