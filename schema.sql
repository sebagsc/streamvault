-- IPTV Streaming Platform — D1 Database Schema (100% Gratis - Sin Durable Objects)

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  totp_secret TEXT,
  totp_confirmed INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  active INTEGER DEFAULT 1,
  preferences_countries TEXT DEFAULT '[]',
  preferences_languages TEXT DEFAULT '[]',
  preferences_categories TEXT DEFAULT '[]',
  nsfw_enabled INTEGER DEFAULT 0,
  notification_lead_time INTEGER DEFAULT 15,
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_links (
  token TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_by TEXT,
  used_at TEXT,
  revoked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_streams (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  quality TEXT,
  country TEXT,
  language TEXT,
  category TEXT,
  is_nsfw INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stream_health_reports (
  id TEXT PRIMARY KEY,
  stream_url TEXT NOT NULL,
  channel_id TEXT,
  reported_by TEXT NOT NULL,
  status TEXT DEFAULT 'broken',
  admin_override TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  event_datetime TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_subscriptions (
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recently_watched (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  watched_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, channel_id)
);

-- ============================================
-- TABLAS PARA CHAT Y PRESENCIA (POLLING)
-- ============================================

-- Sesiones activas de usuarios (para presencia)
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_id TEXT,              -- NULL si no está viendo ningún canal
  username TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  last_active TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Mensajes de chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_custom_streams_channel ON custom_streams(channel_id);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(event_datetime);
CREATE INDEX IF NOT EXISTS idx_event_subs_user ON event_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_subs_event ON event_subscriptions(event_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_watched_user ON recently_watched(user_id);
CREATE INDEX IF NOT EXISTS idx_health_reports_url ON stream_health_reports(stream_url);

-- Indexes para chat y presencia
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON user_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON user_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

-- ============================================
-- LIMPIEZA AUTOMÁTICA DE SESIONES INACTIVAS
-- ============================================
-- Nota: En D1 no hay triggers, así que la limpieza se hace vía código
-- Las sesiones inactivas por más de 5 minutos se consideran "offline"
