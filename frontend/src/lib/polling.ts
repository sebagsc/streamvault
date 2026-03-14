// ============================================
// VERSION GRATUITA - Polling HTTP en lugar de WebSockets
// ============================================

import { API_BASE } from './api';

const POLL_INTERVAL = 3000; // 3 segundos para chat
const HEARTBEAT_INTERVAL = 30000; // 30 segundos para presencia

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

export interface PresenceUser {
  user_id: string;
  username: string;
  last_active: string;
}

export interface PresenceInfo {
  users: PresenceUser[];
  count: number;
  timestamp: string;
}

type ChatHandler = (messages: ChatMessage[]) => void;
type PresenceHandler = (info: PresenceInfo) => void;
type SiteTotalHandler = (total: number) => void;

export class ChannelPolling {
  private channelId: string;
  private userId: string;
  private username: string;
  private isAdmin: boolean;
  private chatHandlers: Set<ChatHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageTime: string | null = null;
  private abortController: AbortController | null = null;

  constructor(channelId: string, userId: string, username: string, isAdmin: boolean) {
    this.channelId = channelId;
    this.userId = userId;
    this.username = username;
    this.isAdmin = isAdmin;
  }

  start(): void {
    this.stop();
    this.abortController = new AbortController();
    
    // Iniciar polling de chat
    this.pollChat();
    this.pollTimer = setInterval(() => this.pollChat(), POLL_INTERVAL);
    
    // Iniciar heartbeat de presencia
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);
  }

  private async pollChat(): Promise<void> {
    try {
      const url = new URL(`${API_BASE}/chat/${this.channelId}`);
      if (this.lastMessageTime) {
        url.searchParams.set('since', this.lastMessageTime);
      }
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString(), {
        headers: {
          'X-User-Id': this.userId,
        },
        signal: this.abortController?.signal,
      });

      if (!response.ok) return;

      const data = await response.json() as { messages: ChatMessage[]; timestamp: string };
      
      if (data.messages.length > 0) {
        this.lastMessageTime = data.timestamp;
        this.chatHandlers.forEach((h) => h(data.messages));
      }

      // También actualizar presencia
      await this.pollPresence();
    } catch {
      // Ignorar errores de red
    }
  }

  private async pollPresence(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/presence/channel/${this.channelId}`, {
        signal: this.abortController?.signal,
      });

      if (!response.ok) return;

      const data = await response.json() as PresenceInfo;
      this.presenceHandlers.forEach((h) => h(data));
    } catch {
      // Ignorar errores de red
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      await fetch(`${API_BASE}/presence/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          username: this.username,
          channelId: this.channelId,
          isAdmin: this.isAdmin,
        }),
        signal: this.abortController?.signal,
      });
    } catch {
      // Ignorar errores de red
    }
  }

  async sendChat(message: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/chat/${this.channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          username: this.username,
          message: message.slice(0, 500),
        }),
      });

      if (response.ok) {
        // Forzar actualización inmediata
        this.pollChat();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  onChat(handler: ChatHandler): () => void {
    this.chatHandlers.add(handler);
    return () => this.chatHandlers.delete(handler);
  }

  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // Notificar que el usuario dejó el canal
    this.leaveChannel();
  }

  private async leaveChannel(): Promise<void> {
    try {
      await fetch(`${API_BASE}/presence/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId }),
      });
    } catch {
      // Ignorar errores
    }
  }
}

// Presencia global del sitio
export class SitePresencePolling {
  private handlers: Set<SiteTotalHandler> = new Set();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), 10000); // Cada 10 segundos
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/presence/site`);
      if (!response.ok) return;
      
      const data = await response.json() as { total: number };
      this.handlers.forEach((h) => h(data.total));
    } catch {
      // Ignorar errores
    }
  }

  onTotal(handler: SiteTotalHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
