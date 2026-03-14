import { Hono } from 'hono';
import { requireAdmin, requireAuth } from '../lib/middleware';
import { generateTotpSecret, buildTotpUri } from '../lib/crypto';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/users — admin only
app.get('/', requireAdmin(), async (c) => {
  const users = await c.env.DB.prepare(
    'SELECT id, email, display_name, role, active, totp_confirmed, last_seen, created_at FROM users ORDER BY created_at DESC'
  ).all<Omit<User, 'password_hash' | 'totp_secret'>>();

  return c.json(users.results);
});

// PATCH /api/users/:id/activate — admin only
app.patch('/:id/activate', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare('UPDATE users SET active = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// PATCH /api/users/:id/deactivate — admin only
app.patch('/:id/deactivate', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const caller = c.get('user');
  if (caller.sub === id) return c.json({ error: 'Cannot deactivate yourself' }, 400);
  await c.env.DB.prepare('UPDATE users SET active = 0 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// PATCH /api/users/:id/reset-totp — admin only
app.patch('/:id/reset-totp', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare(
    'UPDATE users SET totp_secret = NULL, totp_confirmed = 0 WHERE id = ?'
  )
    .bind(id)
    .run();
  return c.json({ ok: true });
});

// POST /api/users/:id/setup-totp — authenticated user sets up new TOTP after reset
app.post('/:id/setup-totp', requireAuth(), async (c) => {
  const { id } = c.req.param();
  const caller = c.get('user');
  if (caller.sub !== id) return c.json({ error: 'Forbidden' }, 403);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  if (!user) return c.json({ error: 'Not found' }, 404);
  if (user.totp_confirmed) return c.json({ error: 'TOTP already configured' }, 400);

  let secret = user.totp_secret;
  if (!secret) {
    secret = generateTotpSecret();
    await c.env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?')
      .bind(secret, id)
      .run();
  }

  const uri = buildTotpUri(secret, user.email, c.env.TOTP_ISSUER_NAME);
  return c.json({ totp_uri: uri });
});

// PATCH /api/users/:id/preferences — authenticated user updates own preferences
app.patch('/:id/preferences', requireAuth(), async (c) => {
  const { id } = c.req.param();
  const caller = c.get('user');
  if (caller.sub !== id && caller.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json<{
    display_name?: string;
    preferences_countries?: string[];
    preferences_languages?: string[];
    preferences_categories?: string[];
    nsfw_enabled?: boolean;
    notification_lead_time?: number;
  }>();

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.display_name !== undefined) {
    updates.push('display_name = ?');
    bindings.push(body.display_name.trim().slice(0, 50));
  }
  if (body.preferences_countries !== undefined) {
    updates.push('preferences_countries = ?');
    bindings.push(JSON.stringify(body.preferences_countries));
  }
  if (body.preferences_languages !== undefined) {
    updates.push('preferences_languages = ?');
    bindings.push(JSON.stringify(body.preferences_languages));
  }
  if (body.preferences_categories !== undefined) {
    updates.push('preferences_categories = ?');
    bindings.push(JSON.stringify(body.preferences_categories));
  }
  if (body.nsfw_enabled !== undefined && caller.role === 'admin') {
    updates.push('nsfw_enabled = ?');
    bindings.push(body.nsfw_enabled ? 1 : 0);
  }
  if (body.notification_lead_time !== undefined) {
    const lt = body.notification_lead_time;
    if ([5, 15, 30].includes(lt)) {
      updates.push('notification_lead_time = ?');
      bindings.push(lt);
    }
  }

  if (updates.length > 0) {
    bindings.push(id);
    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  return c.json({ ok: true });
});

// PATCH /api/users/:id/nsfw — admin only, toggle nsfw for a user
app.patch('/:id/nsfw', requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const { enabled } = await c.req.json<{ enabled: boolean }>();
  await c.env.DB.prepare('UPDATE users SET nsfw_enabled = ? WHERE id = ?')
    .bind(enabled ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

export default app;
