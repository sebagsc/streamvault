export class SitePresence {
  private state: DurableObjectState;
  private roomCounts: Map<string, number> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/update') {
      const { roomId, count } = (await request.json()) as { roomId: string; count: number };
      if (count <= 0) {
        this.roomCounts.delete(roomId);
      } else {
        this.roomCounts.set(roomId, count);
      }
      return new Response(JSON.stringify({ total: this.getTotal() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/total') {
      return new Response(JSON.stringify({ total: this.getTotal() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private getTotal(): number {
    let total = 0;
    for (const count of this.roomCounts.values()) {
      total += count;
    }
    return total;
  }
}
