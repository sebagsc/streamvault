import { Hono } from 'hono';
import type { Env } from '../types';
import { generateId } from '../lib/crypto';

const app = new Hono<{ Bindings: Env }>();

// Obtener mensajes de chat de un canal (con polling)
// Query params: since (timestamp), limit (default 50)
app.get('/:channelId', async (c) => {
  const { channelId } = c.req.param();
  const since = c.req.query('since');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100);

  let query = 'SELECT * FROM chat_messages WHERE channel_id = ?';
  const params: (string | number)[] = [channelId];

  if (since) {
    query += ' AND created_at > datetime(?)';
    params.push(since);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Marcar sesión como activa
  const userId = c.req.header('X-User-Id');
  if (userId) {
    await c.env.DB.prepare(
      'UPDATE user_sessions SET last_active = datetime("now"), channel_id = ? WHERE user_id = ?'
    ).bind(channelId, userId).run();
  }

  return c.json({
    messages: results?.reverse() ?? [], // Orden cronológico
    timestamp: new Date().toISOString(),
  });
});

// Enviar un mensaje de chat
app.post('/:channelId', async (c) => {
  const { channelId } = c.req.param();
  const { userId, username, message } = await c.req.json<{
    userId: string;
    username: string;
    message: string;
  }>();

  if (!userId || !username || !message) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Validar longitud del mensaje
  const trimmedMessage = String(message).trim().slice(0, 500);
  if (!trimmedMessage) {
    return c.json({ error: 'Empty message' }, 400);
  }

  // Insertar mensaje
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (id, channel_id, user_id, username, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, channelId, userId, username, trimmedMessage).run();

  // Actualizar sesión del usuario
  await c.env.DB.prepare(
    'UPDATE user_sessions SET last_active = datetime("now"), channel_id = ? WHERE user_id = ?'
  ).bind(channelId, userId).run();

  return c.json({
    ok: true,
    message: {
      id,
      channel_id: channelId,
      user_id: userId,
      username,
      message: trimmedMessage,
      created_at: new Date().toISOString(),
    },
  });
});

// Obtener historial de chat (últimos N mensajes)
app.get('/:channelId/history', async (c) => {
  const { channelId } = c.req.param();
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 200);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(channelId, limit).all();

  return c.json({
    messages: results?.reverse() ?? [],
  });
});

// Eliminar mensajes antiguos (para admin/cleanup)
app.delete('/cleanup', async (c) => {
  // Eliminar mensajes de más de 24 horas
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM chat_messages WHERE created_at < datetime("now", "-1 day")'
  ).run();

  return c.json({
    ok: true,
    deleted: meta.changes ?? 0,
  });
});

export default app;
