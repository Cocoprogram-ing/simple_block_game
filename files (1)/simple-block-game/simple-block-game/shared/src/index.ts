// Code shared by the client and the server: constants, message types, one helper.

export type Vec3 = [number, number, number];

export const WORLD_SIZE = 30; // platform is WORLD_SIZE x WORLD_SIZE blocks, 1 block high
export const WORLD_HEIGHT = 16; // blocks can be stacked up to this height
export const REACH = 6; // how far a player can reach, in blocks
export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.6;
export const MAX_PLAYERS = 20;

export interface PlayerState {
  id: string;
  name: string;
  p: Vec3; // feet position
  ry: number; // yaw (rotation around Y)
}

// Client -> Server
export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'move'; p: Vec3; ry: number }
  | { t: 'break'; b: Vec3 }
  | { t: 'place'; b: Vec3 };

// Server -> Client
export type ServerMsg =
  | { t: 'init'; id: string; blocks: Vec3[]; players: PlayerState[] }
  | { t: 'join'; player: PlayerState }
  | { t: 'leave'; id: string }
  | { t: 'move'; id: string; p: Vec3; ry: number }
  | { t: 'block'; b: Vec3; on: boolean };

export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < WORLD_SIZE && y >= 0 && y < WORLD_HEIGHT && z >= 0 && z < WORLD_SIZE;
}

// Does a player (feet at px,py,pz) overlap the block occupying [bx,bx+1] x [by,by+1] x [bz,bz+1]?
export function playerOverlapsBlock(
  px: number, py: number, pz: number,
  bx: number, by: number, bz: number,
): boolean {
  return (
    px + PLAYER_RADIUS > bx && px - PLAYER_RADIUS < bx + 1 &&
    py + PLAYER_HEIGHT > by && py < by + 1 &&
    pz + PLAYER_RADIUS > bz && pz - PLAYER_RADIUS < bz + 1
  );
}
