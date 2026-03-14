interface ConnectedUser {
  id: string;
  username: string;
  isAdmin: boolean;
  ws: WebSocket;
}

interface ChatMessage {
  type: 'chat';
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export class ChannelRoom {
  private state: DurableObjectState;
  private env: { SITE_PRESENCE: DurableObjectNamespace };
  private users: Map<WebSocket, ConnectedUser> = new Map();
  private channelId: string = '';

  constructor(state: DurableObjectState, env: { SITE_PRESENCE: DurableObjectNamespace }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.channelId = url.searchParams.get('channelId') ?? this.channelId;

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = url.searchParams.get('userId') ?? 'anon';
    const username = url.searchParams.get('username') ?? 'Anonymous';
    const isAdmin = url.searchParams.get('isAdmin') === 'true';

    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);

    const user: ConnectedUser = { id: userId, username, isAdmin, ws: server };
    this.users.set(server, user);

    this.broadcastPresence();
    this.updateSitePresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const user = this.users.get(ws);
    if (!user) return;

    try {
      const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));

      if (data.type === 'chat_send') {
        const text = String(data.message ?? '').trim().slice(0, 500);
        if (!text) return;

        const chatMsg: ChatMessage = {
          type: 'chat',
          userId: user.id,
          username: user.username,
          message: text,
          timestamp: Date.now(),
        };

        this.broadcast(JSON.stringify(chatMsg));
      }
    } catch {
      // ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const user = this.users.get(ws);
    this.users.delete(ws);

    if (user) {
      this.broadcast(JSON.stringify({ type: 'leave', userId: user.id }));
    }

    this.broadcastPresence();
    this.updateSitePresence();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.users.delete(ws);
    this.broadcastPresence();
    this.updateSitePresence();
  }

  private broadcast(message: string, exclude?: WebSocket): void {
    for (const [ws] of this.users) {
      if (ws === exclude) continue;
      try {
        ws.send(message);
      } catch {
        this.users.delete(ws);
      }
    }
  }

  private broadcastPresence(): void {
    const publicUsers = [];
    for (const [, u] of this.users) {
      if (!u.isAdmin) {
        publicUsers.push({ id: u.id, username: u.username });
      }
    }

    const message = JSON.stringify({
      type: 'presence',
      users: publicUsers,
      count: publicUsers.length,
    });

    this.broadcast(message);
  }

  private async updateSitePresence(): Promise<void> {
    const publicCount = [...this.users.values()].filter((u) => !u.isAdmin).length;

    const siteId = this.env.SITE_PRESENCE.idFromName('global');
    const sitePresence = this.env.SITE_PRESENCE.get(siteId);

    try {
      const resp = await sitePresence.fetch('http://internal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: this.channelId, count: publicCount }),
      });
      const { total } = (await resp.json()) as { total: number };

      // Broadcast updated site total to all connected clients
      this.broadcast(JSON.stringify({ type: 'site_total', total }));
    } catch {
      // Non-critical
    }
  }
}
