// ============================================
// VERSION 100% GRATIS - Sin Durable Objects
// Usa polling HTTP en lugar de WebSockets
// ============================================

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  // Nota: Durable Objects removidos para mantener plan gratuito
  // Se usa polling HTTP + D1 para chat y presencia
  JWT_SECRET: string;
  TOTP_ISSUER_NAME: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  totp_secret: string | null;
  totp_confirmed: number;
  role: 'admin' | 'user';
  active: number;
  preferences_countries: string;
  preferences_languages: string;
  preferences_categories: string;
  nsfw_enabled: number;
  notification_lead_time: number;
  last_seen: string | null;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

export interface InviteLink {
  token: string;
  created_by: string;
  used: number;
  used_by: string | null;
  used_at: string | null;
  revoked: number;
  created_at: string;
}

export interface CustomStream {
  id: string;
  channel_id: string | null;
  title: string;
  url: string;
  quality: string | null;
  country: string | null;
  language: string | null;
  category: string | null;
  is_nsfw: number;
  active: number;
  created_by: string;
  created_at: string;
}

export interface StreamHealthReport {
  id: string;
  stream_url: string;
  channel_id: string | null;
  reported_by: string;
  status: string;
  admin_override: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  event_datetime: string;
  created_by: string;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// iptv-org API types
export interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string;
  owners: string[];
  country: string;
  subdivision: string;
  city: string;
  broadcast_area: string[];
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  launched: string;
  closed: string;
  replaced_by: string;
  website: string;
  logo: string;
}

export interface IptvStream {
  channel: string;
  feed: string;
  is_main: boolean;
  user_agent: string;
  url: string;
  http_referrer: string;
  timeshift: string;
  added: string;
  request_headers: Record<string, string>;
  quality: string;
}

export interface IptvGuide {
  channel: string;
  site: string;
  site_id: string;
  site_name: string;
  lang: string;
}
