import { Hono } from 'hono';
import { signJwt } from '../lib/jwt';
import { verifyPassword } from '../lib/crypto';
import { verifyTotp, buildTotpUri, generateTotpSecret } from '../lib/crypto';
import { requireAuth } from '../lib/middleware';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

// POST /api/auth/login
app.post('/login', async (c) => {
  const { email, password, totp_code } = await c.req.json<{
    email: string;
    password: string;
    totp_code?: string;
  }>();

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first<User>();

  if (!user || !user.active) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // If TOTP is confirmed, require the code
  if (user.totp_confirmed && user.totp_secret) {
    if (!totp_code) {
      // Signal to frontend that TOTP is needed
      return c.json({ totp_required: true }, 200);
    }
    const totpOk = await verifyTotp(user.totp_secret, totp_code);
    if (!totpOk) {
      return c.json({ error: 'Invalid TOTP code' }, 401);
    }
  } else if (!user.totp_secret) {
    // TOTP was reset or never set up — tell frontend to redirect to setup
    return c.json({ totp_setup_required: true, user_id: user.id }, 200);
  }

  await c.env.DB.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role as 'admin' | 'user' },
    c.env.JWT_SECRET
  );

  return new Response(
    JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        nsfw_enabled: user.nsfw_enabled,
        preferences_countries: JSON.parse(user.preferences_countries),
        preferences_languages: JSON.parse(user.preferences_languages),
        preferences_categories: JSON.parse(user.preferences_categories),
        notification_lead_time: user.notification_lead_time,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
      },
    }
  );
});

// POST /api/auth/logout
app.post('/logout', (c) => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    },
  });
});

// GET /api/auth/me
app.get('/me', requireAuth(), async (c) => {
  const jwtUser = c.get('user');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<User>();

  if (!user || !user.active) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    nsfw_enabled: user.nsfw_enabled,
    preferences_countries: JSON.parse(user.preferences_countries),
    preferences_languages: JSON.parse(user.preferences_languages),
    preferences_categories: JSON.parse(user.preferences_categories),
    notification_lead_time: user.notification_lead_time,
    totp_confirmed: user.totp_confirmed,
  });
});

export default app;
