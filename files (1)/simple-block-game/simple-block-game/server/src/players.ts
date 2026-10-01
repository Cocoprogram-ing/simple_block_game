import type { WebSocket } from 'ws';
import { WORLD_SIZE, type PlayerState, type Vec3 } from '../../shared/src/index';

export interface Player {
  id: string;
  name: string;
  p: Vec3; // feet position, as last reported by the client
  ry: number;
  ws: WebSocket;
}

export class Players {
  private map = new Map<string, Player>();
  private nextId = 1;

  get size(): number {
    return this.map.size;
  }

  add(ws: WebSocket, name: string): Player {
    const player: Player = {
      id: String(this.nextId++),
      name,
      p: [WORLD_SIZE / 2, 2, WORLD_SIZE / 2],
      ry: 0,
      ws,
    };
    this.map.set(player.id, player);
    return player;
  }

  remove(id: string): void {
    this.map.delete(id);
  }

  all(): Player[] {
    return [...this.map.values()];
  }

  state(p: Player): PlayerState {
    return { id: p.id, name: p.name, p: p.p, ry: p.ry };
  }
}
