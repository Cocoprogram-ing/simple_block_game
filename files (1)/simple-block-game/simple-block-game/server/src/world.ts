import { WORLD_SIZE, blockKey, type Vec3 } from '../../shared/src/index';

const NEIGHBORS: Vec3[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

// The server's copy of the world. Clients can only change it by asking the server.
export class World {
  private blocks = new Set<string>();

  constructor() {
    // Flat platform: WORLD_SIZE x WORLD_SIZE blocks, one block high (y = 0)
    for (let x = 0; x < WORLD_SIZE; x++) {
      for (let z = 0; z < WORLD_SIZE; z++) this.blocks.add(blockKey(x, 0, z));
    }
  }

  has(x: number, y: number, z: number): boolean {
    return this.blocks.has(blockKey(x, y, z));
  }

  add(x: number, y: number, z: number): void {
    this.blocks.add(blockKey(x, y, z));
  }

  remove(x: number, y: number, z: number): void {
    this.blocks.delete(blockKey(x, y, z));
  }

  // New blocks must touch an existing block (no floating blocks)
  hasNeighbor(x: number, y: number, z: number): boolean {
    return NEIGHBORS.some(([dx, dy, dz]) => this.has(x + dx, y + dy, z + dz));
  }

  list(): Vec3[] {
    return [...this.blocks].map((k) => k.split(',').map(Number) as Vec3);
  }
}
