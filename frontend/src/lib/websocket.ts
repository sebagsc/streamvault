// @ts-ignore
const WS_BASE = (import.meta.env?.VITE_WS_URL as string) || '';

export type WsMessage =
  | { type: 'join'; userId: string; username: string }
  | { type: 'leave'; userId: string }
  | { type: 'presence'; users: { id: string; username: string }[]; count: number }
  | { type: 'chat'; userId: string; username: string; message: string; timestamp: number }
  | { type: 'chat_send'; message: string }
  | { type: 'site_total'; total: number };

type MessageHandler = (msg: WsMessage) => void;

export class ChannelWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private channelId: string;
  private userId: string;
  private username: string;
  private isAdmin: boolean;

  constructor(channelId: string, userId: string, username: string, isAdmin: boolean) {
    this.channelId = channelId;
    this.userId = userId;
    this.username = username;
    this.isAdmin = isAdmin;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.openSocket();
  }

  private buildUrl(): string {
    const wsBase = WS_BASE || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    const url = new URL(`${wsBase}/api/ws/${this.channelId}`);
    url.searchParams.set('userId', this.userId);
    url.searchParams.set('username', this.username);
    url.searchParams.set('isAdmin', this.isAdmin ? 'true' : 'false');
    return url.toString();
  }

  private openSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(this.buildUrl());

      this.ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          this.handlers.forEach((h) => h(msg));
        } catch {
          // ignore
        }
      });

      this.ws.addEventListener('close', () => {
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.openSocket(), 3000);
        }
      });

      this.ws.addEventListener('error', () => {
        this.ws?.close();
      });
    } catch {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.openSocket(), 5000);
      }
    }
  }

  send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendChat(message: string): void {
    this.send({ type: 'chat_send', message });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
