import type { ClientMsg, ServerMsg } from '../../../shared/src/index';

export class Network {
  private ws: WebSocket | null = null;
  onMessage: (m: ServerMsg) => void = () => {};
  onClose: () => void = () => {};

  connect(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Same host the page was served from (works locally and on Render)
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => {
        this.send({ t: 'join', name });
        resolve();
      };
      ws.onerror = () => reject(new Error('Could not connect to the server'));
      ws.onmessage = (e) => {
        try {
          this.onMessage(JSON.parse(e.data));
        } catch (err) {
          console.error(err);
        }
      };
      ws.onclose = () => this.onClose();
    });
  }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}
