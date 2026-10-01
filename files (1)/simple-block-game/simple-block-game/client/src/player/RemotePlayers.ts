import * as THREE from 'three';
import type { PlayerState, Vec3 } from '../../../shared/src/index';

interface Remote {
  group: THREE.Group;
  target: THREE.Vector3;
  ry: number;
}

function hueFromId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function makeLabel(name: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.strokeText(name, 128, 32);
  g.fillStyle = '#fff';
  g.fillText(name, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.25;
  return sprite;
}

export class RemotePlayers {
  private map = new Map<string, Remote>();

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.map.size;
  }

  add(p: PlayerState): void {
    if (this.map.has(p.id)) return;
    const group = new THREE.Group();
    const color = new THREE.Color().setHSL(hueFromId(p.id) / 360, 0.65, 0.5);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.2, 4, 12),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.9;
    group.add(body);

    // small white box on the front so you can see where they are looking
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.25),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    nose.position.set(0, 1.5, -0.3);
    group.add(nose);

    group.add(makeLabel(p.name));
    group.position.set(...p.p);
    group.rotation.y = p.ry;
    this.scene.add(group);
    this.map.set(p.id, { group, target: new THREE.Vector3(...p.p), ry: p.ry });
  }

  remove(id: string): void {
    const r = this.map.get(id);
    if (!r) return;
    this.scene.remove(r.group);
    r.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) {
        (mat as THREE.SpriteMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.map.delete(id);
  }

  moveTo(id: string, p: Vec3, ry: number): void {
    const r = this.map.get(id);
    if (!r) return;
    r.target.set(...p);
    r.ry = ry;
  }

  // Smoothly move every remote player toward the last position the server told us
  update(dt: number): void {
    const k = 1 - Math.exp(-12 * dt);
    for (const r of this.map.values()) {
      r.group.position.lerp(r.target, k);
      let diff = r.ry - r.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest angle
      r.group.rotation.y += diff * k;
    }
  }
}
