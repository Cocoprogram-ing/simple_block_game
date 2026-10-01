import * as THREE from 'three';
import { WORLD_SIZE } from '../../../shared/src/index';
import type { ClientWorld } from '../world/ClientWorld';

const SPEED = 5; // blocks per second
const JUMP = 8; // initial jump velocity (about 1.3 blocks high)
const GRAVITY = 25;
const MAX_FALL = 20;

export class LocalPlayer {
  pos = new THREE.Vector3(); // feet position
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;

  constructor(private world: ClientWorld) {}

  spawn(): void {
    this.pos.set(WORLD_SIZE / 2 + (Math.random() - 0.5) * 6, 3, WORLD_SIZE / 2 + (Math.random() - 0.5) * 6);
    this.vel.set(0, 0, 0);
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0022));
  }

  update(dt: number, keys: Set<string>, active: boolean): void {
    let forward = 0, right = 0;
    if (active) {
      if (keys.has('KeyW')) forward += 1;
      if (keys.has('KeyS')) forward -= 1;
      if (keys.has('KeyD')) right += 1;
      if (keys.has('KeyA')) right -= 1;
    }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = -sin * forward + cos * right;
    let dz = -cos * forward - sin * right;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    this.vel.x = dx * SPEED;
    this.vel.z = dz * SPEED;

    if (active && keys.has('Space') && this.onGround) this.vel.y = JUMP;
    this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -MAX_FALL);

    this.onGround = false;
    this.moveAxis(0, this.vel.x * dt);
    this.moveAxis(2, this.vel.z * dt);
    this.moveAxis(1, this.vel.y * dt);

    if (this.pos.y < -20) this.spawn(); // fell off the platform
  }

  // Move along one axis; if that causes a collision, undo it (this gives wall sliding)
  private moveAxis(axis: 0 | 1 | 2, delta: number): void {
    const old = this.pos.getComponent(axis);
    this.pos.setComponent(axis, old + delta);
    if (!this.world.collides(this.pos)) return;
    if (axis === 1) {
      if (delta < 0) {
        this.pos.y = Math.floor(old + delta) + 1; // land on top of the block
        this.onGround = true;
      } else {
        this.pos.y = old; // bumped head
      }
      this.vel.y = 0;
    } else {
      this.pos.setComponent(axis, old);
    }
  }
}
