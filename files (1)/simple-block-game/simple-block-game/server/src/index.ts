import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  EYE_HEIGHT, MAX_PLAYERS, REACH, inBounds, playerOverlapsBlock,
  type ClientMsg, type ServerMsg, type Vec3,
} from '../../shared/src/index';
import { World } from './world';
import { Players, type Player } from './players';

const PORT = Number(process.env.PORT) || 3000; // Render provides PORT
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const app = express();
app.use(express.static(clientDir));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

const world = new World();
const players = new Players();

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMsg, except?: WebSocket) {
  const data = JSON.stringify(msg);
  for (const p of players.all()) {
    if (p.ws !== except && p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

function parseBlock(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  if (!v.every((n) => Number.isInteger(n))) return null;
  const [x, y, z] = v as Vec3;
  return inBounds(x, y, z) ? [x, y, z] : null;
}

function inReach(p: Player, b: Vec3): boolean {
  const dx = p.p[0] - (b[0] + 0.5);
  const dy = p.p[1] + EYE_HEIGHT - (b[1] + 0.5);
  const dz = p.p[2] - (b[2] + 0.5);
  return Math.hypot(dx, dy, dz) <= REACH + 2; // small tolerance for latency
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws) => {
  let me: Player | null = null;
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    // 1. Join
    if (msg.t === 'join') {
      if (me) return;
      if (players.size >= MAX_PLAYERS) return ws.close(1013, 'Server full');
      const name =
        String(msg.name ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Player';
      const others = players.all().map((p) => players.state(p));
      me = players.add(ws, name);
      send(ws, { t: 'init', id: me.id, blocks: world.list(), players: others });
      broadcast({ t: 'join', player: players.state(me) }, ws);
      console.log(`+ ${me.name} (${me.id}) joined, ${players.size} online`);
      return;
    }

    if (!me) return; // everything below requires a joined player

    // 2. Movement (position is trusted, but sanitized)
    if (msg.t === 'move') {
      if (!Array.isArray(msg.p) || msg.p.length !== 3 || !msg.p.every(isNum) || !isNum(msg.ry)) return;
      me.p = [clamp(msg.p[0], -100, 130), clamp(msg.p[1], -100, 100), clamp(msg.p[2], -100, 130)];
      me.ry = msg.ry;
      broadcast({ t: 'move', id: me.id, p: me.p, ry: me.ry }, ws);
      return;
    }

    // 3. Break block
    if (msg.t === 'break') {
      const b = parseBlock(msg.b);
      if (!b || !world.has(...b) || !inReach(me, b)) return;
      world.remove(...b);
      broadcast({ t: 'block', b, on: false });
      return;
    }

    // 4. Place block
    if (msg.t === 'place') {
      const b = parseBlock(msg.b);
      if (!b || world.has(...b) || !world.hasNeighbor(...b) || !inReach(me, b)) return;
      // Never place a block inside any player
      for (const p of players.all()) {
        if (playerOverlapsBlock(p.p[0], p.p[1], p.p[2], b[0], b[1], b[2])) return;
      }
      world.add(...b);
      broadcast({ t: 'block', b, on: true });
    }
  });

  ws.on('close', () => {
    if (!me) return;
    players.remove(me.id);
    broadcast({ t: 'leave', id: me.id });
    console.log(`- ${me.name} (${me.id}) left, ${players.size} online`);
  });
});

// Keep connections alive through proxies and drop dead ones
setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
