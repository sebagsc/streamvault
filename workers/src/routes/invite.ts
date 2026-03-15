import { Hono } from 'hono';
import { requireAdmin, requireAuth } from '../lib/middleware';
import { generateToken, generateId, hashPassword, generateTotpSecret, buildTotpUri } from '../lib/crypto';
import type { Env, InviteLink } from '../types';

const app = new Hono<{ Bindings: Env }>();

// POST /api/invite/generate — admin only
app.post('/generate', requireAdmin(), async (c) => {
  const user = c.get('user');
  const token = generateToken();

  await c.env.DB.prepare(
    'INSERT INTO invite_links (token, created_by) VALUES (?, ?)'
  )
    .bind(token, user.sub)
    .run();

  const url = `${c.env.FRONTEND_URL}/invite/${token}`;
  return c.json({ token, url });
});

// GET /api/invite/list — admin only (MUST be before /:token to avoid being caught by it)
app.get('/list', requireAdmin(), async (c) => {
  const invites = await c.env.DB.prepare(
    `SELECT i.*, u.email as used_by_email
     FROM invite_links i
     LEFT JOIN users u ON i.used_by = u.id
     ORDER BY i.created_at DESC`
  ).all<InviteLink & { used_by_email: string | null }>();

  return c.json(invites.results);
});

// GET /api/invite/:token — public, validate token
app.get('/:token', async (c) => {
  const { token } = c.req.param();
  const invite = await c.env.DB.prepare('SELECT * FROM invite_links WHERE token = ?')
    .bind(token)
    .first<InviteLink>();

  if (!invite) return c.json({ valid: false, reason: 'not_found' });
  if (invite.revoked) return c.json({ valid: false, reason: 'revoked' });
  if (invite.used) return c.json({ valid: false, reason: 'already_used' });

  return c.json({ valid: true });
});

// POST /api/invite/register — consume token, create account
app.post('/register', async (c) => {
  const { token, email, password } = await c.req.json<{
    token: string;
    email: string;
    password: string;
  }>();

  if (!token || !email || !password) {
    return c.json({ error: 'token, email, and password are required' }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const invite = await c.env.DB.prepare('SELECT * FROM invite_links WHERE token = ?')
    .bind(token)
    .first<InviteLink>();

  if (!invite || invite.revoked || invite.used) {
    return c.json({ error: 'Invalid or already-used invite link' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first();

  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const id = generateId();
  const passwordHash = await hashPassword(password);
  const totpSecret = generateTotpSecret();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, totp_secret, totp_confirmed, role, active)
     VALUES (?, ?, ?, ?, 0, 'user', 1)`
  )
    .bind(id, email.toLowerCase().trim(), passwordHash, totpSecret)
    .run();

  await c.env.DB.prepare(
    `UPDATE invite_links SET used = 1, used_by = ?, used_at = datetime('now') WHERE token = ?`
  )
    .bind(id, token)
    .run();

  const totpUri = buildTotpUri(totpSecret, email, c.env.TOTP_ISSUER_NAME);

  return c.json({ ok: true, totp_uri: totpUri, user_id: id });
});

// POST /api/invite/confirm-totp — mark TOTP as confirmed after user scans QR
app.post('/confirm-totp', async (c) => {
  const { user_id, totp_code } = await c.req.json<{ user_id: string; totp_code: string }>();
  if (!user_id || !totp_code) return c.json({ error: 'user_id and totp_code required' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(user_id)
    .first<{ totp_secret: string; totp_confirmed: number }>();

  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.totp_confirmed) return c.json({ ok: true }); // already confirmed

  const { verifyTotp } = await import('../lib/crypto');
  const valid = await verifyTotp(user.totp_secret, totp_code);
  if (!valid) return c.json({ error: 'Invalid TOTP code' }, 400);

  await c.env.DB.prepare('UPDATE users SET totp_confirmed = 1 WHERE id = ?')
    .bind(user_id)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/invite/:token — admin only
app.delete('/:token', requireAdmin(), async (c) => {
  const { token } = c.req.param();
  await c.env.DB.prepare('UPDATE invite_links SET revoked = 1 WHERE token = ?')
    .bind(token)
    .run();
  return c.json({ ok: true });
});

export default app;
