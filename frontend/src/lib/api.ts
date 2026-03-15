// @ts-ignore
const API_BASE = (import.meta.env?.VITE_API_URL as string) || '/api';

export { API_BASE };

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new ApiError(resp.status, body.error ?? resp.statusText);
  }

  return resp.json() as T;
}

// Auth
export const auth = {
  login: (email: string, password: string, totp_code?: string) =>
    request<{
      ok?: boolean;
      totp_required?: boolean;
      totp_setup_required?: boolean;
      user_id?: string;
      user?: UserProfile;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<UserProfile>('/auth/me'),
};

// Invite
export const invite = {
  validate: (token: string) =>
    request<{ valid: boolean; reason?: string }>(`/invite/${token}`),

  register: (token: string, email: string, password: string) =>
    request<{ ok: boolean; totp_uri: string; user_id: string }>('/invite/register', {
      method: 'POST',
      body: JSON.stringify({ token, email, password }),
    }),

  confirmTotp: (user_id: string, totp_code: string) =>
    request<{ ok: boolean }>('/invite/confirm-totp', {
      method: 'POST',
      body: JSON.stringify({ user_id, totp_code }),
    }),

  generate: () => request<{ token: string; url: string }>('/invite/generate', { method: 'POST' }),

  list: () => request<InviteLink[]>('/invite/list'),

  revoke: (token: string) => request(`/invite/${token}`, { method: 'DELETE' }),
};

// Users
export const users = {
  list: () => request<UserRow[]>('/users'),

  activate: (id: string) => request(`/users/${id}/activate`, { method: 'PATCH' }),
  deactivate: (id: string) => request(`/users/${id}/deactivate`, { method: 'PATCH' }),
  resetTotp: (id: string) => request(`/users/${id}/reset-totp`, { method: 'PATCH' }),

  updatePreferences: (id: string, prefs: Partial<UserPreferences>) =>
    request(`/users/${id}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),

  setNsfw: (id: string, enabled: boolean) =>
    request(`/users/${id}/nsfw`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
};

// Channels
export const channels = {
  list: (params?: ChannelQueryParams) => {
    const qs = new URLSearchParams();
    if (params?.country) qs.set('country', params.country);
    if (params?.language) qs.set('language', params.language);
    if (params?.category) qs.set('category', params.category);
    if (params?.nsfw) qs.set('nsfw', 'true');
    if (params?.search) qs.set('search', params.search);
    if (params?.show_all) qs.set('show_all', 'true');
    return request<Channel[]>(`/channels?${qs}`);
  },

  streams: (id: string) => request<ChannelStream[]>(`/channels/${id}/streams`),

  epg: (id: string) => request<{ programs: EpgProgram[] }>(`/channels/${id}/epg`),

  markWatched: (id: string) =>
    request(`/channels/${id}/recently-watched`, { method: 'POST' }),

  recentlyWatched: () =>
    request<{ channel_id: string; watched_at: string }[]>('/channels/recently-watched'),
};

// Streams
export const streams = {
  addCustom: (data: CustomStreamInput) =>
    request<{ ok: boolean; id: string }>('/streams/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCustom: (id: string) => request(`/streams/custom/${id}`, { method: 'DELETE' }),

  report: (streamUrl: string, channelId?: string) =>
    request('/streams/report', {
      method: 'POST',
      body: JSON.stringify({ stream_url: streamUrl, channel_id: channelId }),
    }),

  setHealth: (id: string, status: 'working' | 'broken' | 'hidden') =>
    request(`/streams/${id}/health`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  reports: () => request<StreamReport[]>('/streams/reports'),
};

// Events
export const events = {
  list: () => request<EventWithSub[]>('/events'),

  create: (data: EventInput) =>
    request<{ ok: boolean; id: string }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<EventInput>) =>
    request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => request(`/events/${id}`, { method: 'DELETE' }),

  subscribe: (id: string) =>
    request(`/events/${id}/subscribe`, { method: 'POST' }),

  unsubscribe: (id: string) =>
    request(`/events/${id}/subscribe`, { method: 'DELETE' }),
};

// Push
export const push = {
  subscribe: (endpoint: string, keys: { p256dh: string; auth: string }) =>
    request('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint, keys }),
    }),

  unsubscribe: (endpoint: string) =>
    request('/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),

  preferences: () => request<{ notification_lead_time: number }>('/push/preferences'),

  updatePreferences: (notification_lead_time: number) =>
    request('/push/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ notification_lead_time }),
    }),

  vapidPublicKey: () =>
    request<{ public_key: string }>('/push/vapid-public-key'),
};

// Meta
export const meta = {
  categories: () => request<{ id: string; name: string }[]>('/meta/categories'),
  countries: () => request<{ code: string; name: string; flag: string }[]>('/meta/countries'),
  languages: () => request<{ code: string; name: string }[]>('/meta/languages'),
};

// Types
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'user';
  nsfw_enabled: number;
  preferences_countries: string[];
  preferences_languages: string[];
  preferences_categories: string[];
  notification_lead_time: number;
  totp_confirmed: number;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  active: number;
  totp_confirmed: number;
  last_seen: string | null;
  created_at: string;
}

export interface InviteLink {
  token: string;
  created_by: string;
  used: number;
  used_by: string | null;
  used_at: string | null;
  revoked: number;
  created_at: string;
  used_by_email: string | null;
}

export interface UserPreferences {
  display_name: string;
  preferences_countries: string[];
  preferences_languages: string[];
  preferences_categories: string[];
  nsfw_enabled: boolean;
  notification_lead_time: number;
}

export interface Channel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  streams: ChannelStream[];
  is_custom: boolean;
}

export interface ChannelStream {
  url: string;
  quality: string;
  http_referrer?: string;
  user_agent?: string;
  is_broken: boolean;
}

export interface ChannelQueryParams {
  country?: string;
  language?: string;
  category?: string;
  nsfw?: boolean;
  search?: string;
  show_all?: boolean;
}

export interface EpgProgram {
  title: string;
  start: string;
  stop: string;
  description?: string;
}

export interface EventWithSub {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  event_datetime: string;
  subscribed: number;
}

export interface EventInput {
  channel_id: string;
  title: string;
  description?: string;
  image_url?: string;
  event_datetime: string;
}

export interface CustomStreamInput {
  channel_id?: string;
  title: string;
  url: string;
  quality?: string;
  country?: string;
  language?: string;
  category?: string;
  is_nsfw?: boolean;
}

export interface StreamReport {
  id: string;
  stream_url: string;
  channel_id: string | null;
  reported_by: string;
  reporter_email: string;
  admin_override: string | null;
  created_at: string;
}

export { ApiError };
