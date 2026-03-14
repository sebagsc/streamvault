import { Hono } from 'hono';
import type { Env } from '../types';
import { generateId } from '../lib/crypto';

const app = new Hono<{ Bindings: Env }>();

const SESSION_TIMEOUT_MINUTES = 5;

// Registrar/actualizar sesión de usuario (heartbeat)
app.post('/heartbeat', async (c) => {
  const { userId, username, channelId, isAdmin } = await c.req.json<{
    userId: string;
    username: string;
    channelId?: string;
    isAdmin?: boolean;
  }>();

  if (!userId || !username) {
    return c.json({ error: 'Missing userId or username' }, 400);
  }

  // Buscar sesión existente
  const existing = await c.env.DB.prepare(
    'SELECT id FROM user_sessions WHERE user_id = ?'
  ).bind(userId).first<{ id: string }>();

  if (existing) {
    // Actualizar sesión existente
    await c.env.DB.prepare(
      'UPDATE user_sessions SET last_active = datetime("now"), channel_id = ?, username = ?, is_admin = ? WHERE user_id = ?'
    ).bind(channelId ?? null, username, isAdmin ? 1 : 0, userId).run();
  } else {
    // Crear nueva sesión
    const id = generateId();
    await c.env.DB.prepare(
      'INSERT INTO user_sessions (id, user_id, channel_id, username, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, userId, channelId ?? null, username, isAdmin ? 1 : 0).run();
  }

  return c.json({ ok: true });
});

// Obtener presencia en un canal específico
app.get('/channel/:channelId', async (c) => {
  const { channelId } = c.req.param();

  // Limpiar sesiones inactivas primero
  await cleanupInactiveSessions(c.env.DB);

  // Obtener usuarios activos en el canal (no admins)
  const { results } = await c.env.DB.prepare(
    `SELECT user_id, username, last_active FROM user_sessions 
     WHERE channel_id = ? AND is_admin = 0 AND last_active > datetime("now", "-${SESSION_TIMEOUT_MINUTES} minutes")
     ORDER BY last_active DESC`
  ).bind(channelId).all();

  return c.json({
    users: results ?? [],
    count: results?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// Obtener conteo total de usuarios en el sitio
app.get('/site', async (c) => {
  // Limpiar sesiones inactivas
  await cleanupInactiveSessions(c.env.DB);

  // Contar usuarios activos (no admins)
  const result = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM user_sessions 
     WHERE is_admin = 0 AND last_active > datetime("now", "-${SESSION_TIMEOUT_MINUTES} minutes")`
  ).first<{ total: number }>();

  return c.json({
    total: result?.total ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// Obtener presencia completa (todos los canales)
app.get('/all', async (c) => {
  await cleanupInactiveSessions(c.env.DB);

  const { results } = await c.env.DB.prepare(
    `SELECT channel_id, COUNT(*) as count FROM user_sessions 
     WHERE is_admin = 0 AND last_active > datetime("now", "-${SESSION_TIMEOUT_MINUTES} minutes")
     AND channel_id IS NOT NULL
     GROUP BY channel_id`
  ).all<{ channel_id: string; count: number }>();

  const presence: Record<string, number> = {};
  results?.forEach((row) => {
    presence[row.channel_id] = row.count;
  });

  return c.json({
    channels: presence,
    timestamp: new Date().toISOString(),
  });
});

// Cerrar sesión (logout)
app.post('/leave', async (c) => {
  const { userId } = await c.req.json<{ userId: string }>();

  if (!userId) {
    return c.json({ error: 'Missing userId' }, 400);
  }

  await c.env.DB.prepare(
    'DELETE FROM user_sessions WHERE user_id = ?'
  ).bind(userId).run();

  return c.json({ ok: true });
});

// Limpiar todas las sesiones (admin/debug)
app.delete('/cleanup', async (c) => {
  const { meta } = await c.env.DB.prepare('DELETE FROM user_sessions').run();
  return c.json({ ok: true, deleted: meta.changes ?? 0 });
});

// Función auxiliar para limpiar sesiones inactivas
async function cleanupInactiveSessions(db: D1Database): Promise<void> {
  await db.prepare(
    `DELETE FROM user_sessions WHERE last_active < datetime("now", "-${SESSION_TIMEOUT_MINUTES} minutes")`
  ).run();
}

export default app;
