import { Hono } from 'hono';
import { requireAdmin, requireAuth } from '../lib/middleware';
import { generateId } from '../lib/crypto';
import type { Env, CustomStream, StreamHealthReport } from '../types';

const app = new Hono<{ Bindings: Env }>();

// POST /api/streams/custom — admin only
app.post('/custom', requireAdmin(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    channel_id?: string;
    title: string;
    url: string;
    quality?: string;
    country?: string;
    language?: string;
    category?: string;
    is_nsfw?: boolean;
  }>();

  if (!body.title || !body.url) {
    return c.json({ error: 'title and url are required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO custom_streams (id, channel_id, title, url, quality, country, language, category, is_nsfw, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.channel_id ?? null,
      body.title,
      body.url,
      body.quality ?? null,
      body.country ?? null,
      body.language ?? null,
      body.category ?? null,
      body.is_nsfw ? 1 : 0,
      user.sub
    )
    .run();

  return c.json({ ok: true, id });
});

// DELETE /api/streams/custom/:id — admin only
app.delete('/custom/:id', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare('UPDATE custom_streams SET active = 0 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// POST /api/streams/report — authenticated user reports broken stream
app.post('/report', requireAuth(), async (c) => {
  const user = c.get('user');
  const { stream_url, channel_id } = await c.req.json<{
    stream_url: string;
    channel_id?: string;
  }>();

  if (!stream_url) return c.json({ error: 'stream_url required' }, 400);

  const reportId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO stream_health_reports (id, stream_url, channel_id, reported_by)
     VALUES (?, ?, ?, ?)`
  )
    .bind(reportId, stream_url, channel_id ?? null, user.sub)
    .run();

  return c.json({ ok: true });
});

// PATCH /api/streams/:id/health — admin only, set health status
app.patch('/:id/health', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json<{ status: 'working' | 'broken' | 'hidden' }>();

  if (!['working', 'broken', 'hidden'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const override = status === 'working' ? null : status;
  await c.env.DB.prepare('UPDATE stream_health_reports SET admin_override = ? WHERE id = ?')
    .bind(override, id)
    .run();

  return c.json({ ok: true });
});

// GET /api/streams/reports — admin only, get flagged streams
app.get('/reports', requireAdmin(), async (c) => {
  const reports = await c.env.DB.prepare(
    `SELECT shr.*, u.email as reporter_email
     FROM stream_health_reports shr
     JOIN users u ON shr.reported_by = u.id
     WHERE shr.admin_override IS NULL
     ORDER BY shr.created_at DESC`
  ).all();

  return c.json(reports.results);
});

export default app;
