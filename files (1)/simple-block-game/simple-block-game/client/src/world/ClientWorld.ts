import * as THREE from 'three';
import {
  PLAYER_HEIGHT, PLAYER_RADIUS, WORLD_HEIGHT, WORLD_SIZE,
  blockKey, playerOverlapsBlock, type Vec3,
} from '../../../shared/src/index';

const MAX_BLOCKS = WORLD_SIZE * WORLD_SIZE * WORLD_HEIGHT;

function makeBlockTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6aa84f';
  g.fillRect(0, 0, 16, 16);
  g.strokeStyle = '#41722d'; // darker border so single blocks are visible
  g.lineWidth = 2;
  g.strokeRect(1, 1, 14, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// All blocks are drawn with ONE InstancedMesh (one draw call).
export class ClientWorld {
  private index = new Map<string, number>(); // block key -> instance index
  private keys: string[] = []; // instance index -> block key
  private mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshLambertMaterial({ map: makeBlockTexture() });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX_BLOCKS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  has(x: number, y: number, z: number): boolean {
    return this.index.has(blockKey(x, y, z));
  }

  set(x: number, y: number, z: number, on: boolean): void {
    const key = blockKey(x, y, z);
    const existing = this.index.get(key);
    if (on) {
      if (existing !== undefined || this.keys.length >= MAX_BLOCKS) return;
      const i = this.keys.length;
      this.keys.push(key);
      this.index.set(key, i);
      this.m.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
      this.mesh.setMatrixAt(i, this.m);
    } else {
      if (existing === undefined) return;
      const last = this.keys.length - 1;
      if (existing !== last) {
        // move the last instance into the freed slot
        const lastKey = this.keys[last];
        this.mesh.getMatrixAt(last, this.m);
        this.mesh.setMatrixAt(existing, this.m);
        this.keys[existing] = lastKey;
        this.index.set(lastKey, existing);
      }
      this.keys.pop();
      this.index.delete(key);
    }
    this.mesh.count = this.keys.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setAll(blocks: Vec3[]): void {
    for (const [x, y, z] of blocks) this.set(x, y, z, true);
  }

  // Does a player standing with feet at `pos` overlap any block?
  collides(pos: THREE.Vector3): boolean {
    const x0 = Math.floor(pos.x - PLAYER_RADIUS), x1 = Math.floor(pos.x + PLAYER_RADIUS);
    const y0 = Math.floor(pos.y), y1 = Math.floor(pos.y + PLAYER_HEIGHT);
    const z0 = Math.floor(pos.z - PLAYER_RADIUS), z1 = Math.floor(pos.z + PLAYER_RADIUS);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (this.has(x, y, z) && playerOverlapsBlock(pos.x, pos.y, pos.z, x, y, z)) return true;
        }
      }
    }
    return false;
  }

  // Voxel ray traversal (Amanatides & Woo). Returns the first block hit and the face normal.
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): { block: Vec3; normal: Vec3 } | null {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const dx = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
    const dy = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
    const dz = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
    let tx = d.x !== 0 ? (sx > 0 ? x + 1 - o.x : o.x - x) * dx : Infinity;
    let ty = d.y !== 0 ? (sy > 0 ? y + 1 - o.y : o.y - y) * dy : Infinity;
    let tz = d.z !== 0 ? (sz > 0 ? z + 1 - o.z : o.z - z) * dz : Infinity;
    let normal: Vec3 = [0, 0, 0];
    let t = 0;
    while (t <= maxDist) {
      if (this.has(x, y, z)) {
        if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) return null; // camera inside a block
        return { block: [x, y, z], normal };
      }
      if (tx < ty && tx < tz) {
        x += sx; t = tx; tx += dx; normal = [-sx, 0, 0];
      } else if (ty < tz) {
        y += sy; t = ty; ty += dy; normal = [0, -sy, 0];
      } else {
        z += sz; t = tz; tz += dz; normal = [0, 0, -sz];
      }
    }
    return null;
  }
}
