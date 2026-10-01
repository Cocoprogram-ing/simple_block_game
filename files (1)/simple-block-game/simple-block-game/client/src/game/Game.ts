import * as THREE from 'three';
import { EYE_HEIGHT, REACH, playerOverlapsBlock, type ServerMsg, type Vec3 } from '../../../shared/src/index';
import { Network } from '../networking/Network';
import { ClientWorld } from '../world/ClientWorld';
import { LocalPlayer } from '../player/LocalPlayer';
import { RemotePlayers } from '../player/RemotePlayers';

export interface Hud {
  name: HTMLElement;
  status: HTMLElement;
  pause: HTMLElement;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200);
  private world: ClientWorld;
  private player: LocalPlayer;
  private remotes: RemotePlayers;
  private net = new Network();
  private outline: THREE.LineSegments;
  private keys = new Set<string>();
  private clock = new THREE.Clock();
  private ready = false; // world received from the server
  private connected = false;
  private target: { block: Vec3; normal: Vec3 } | null = null;
  private lastSend = 0;
  private sent = { x: NaN, y: NaN, z: NaN, ry: NaN };
  private dir = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, private hud: Hud) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.rotation.order = 'YXZ';
    this.scene.background = new THREE.Color('#87ceeb');
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    this.world = new ClientWorld(this.scene);
    this.player = new LocalPlayer(this.world);
    this.remotes = new RemotePlayers(this.scene);

    // Outline around the targeted block
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.net.onMessage = (m) => this.handle(m);
    this.net.onClose = () => {
      this.connected = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.hud.status.textContent = 'Disconnected - refresh the page to rejoin';
      this.updatePause();
    };

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  private get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  // Must be called from a click handler (browsers require a user gesture)
  lockPointer(): void {
    if (this.connected || !this.ready) this.canvas.requestPointerLock();
  }

  async join(name: string): Promise<void> {
    this.hud.name.textContent = `Username: ${name}`;
    await this.net.connect(name);
    this.connected = true;
  }

  private handle(m: ServerMsg): void {
    switch (m.t) {
      case 'init':
        this.world.setAll(m.blocks);
        m.players.forEach((p) => this.remotes.add(p));
        this.player.spawn();
        this.ready = true;
        this.updateStatus();
        this.updatePause();
        break;
      case 'join':
        this.remotes.add(m.player);
        this.updateStatus();
        break;
      case 'leave':
        this.remotes.remove(m.id);
        this.updateStatus();
        break;
      case 'move':
        this.remotes.moveTo(m.id, m.p, m.ry);
        break;
      case 'block': {
        const [x, y, z] = m.b;
        this.world.set(x, y, z, m.on);
        // If someone built a block on top of us, lift us out of it
        if (m.on && this.ready && this.world.collides(this.player.pos)) this.player.pos.y = y + 1;
        break;
      }
    }
  }

  private updateStatus(): void {
    this.hud.status.textContent = `Connected - Players: ${this.remotes.count + 1}`;
  }

  private updatePause(): void {
    const show = this.ready && (!this.locked || !this.connected);
    this.hud.pause.style.display = show ? 'flex' : 'none';
    this.hud.pause.textContent = this.connected
      ? 'Click to resume (ESC unlocks the mouse)'
      : 'Disconnected - refresh the page to rejoin';
  }

  private bindInput(): void {
    document.addEventListener('keydown', (e) => {
      if (this.locked && e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) this.keys.clear();
      this.updatePause();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.ready) this.player.look(e.movementX, e.movementY);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.hud.pause.addEventListener('click', () => {
      if (this.connected) this.canvas.requestPointerLock();
    });
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.locked || !this.ready || !this.connected || !this.target) return;
    const [x, y, z] = this.target.block;
    if (e.button === 0) {
      this.net.send({ t: 'break', b: [x, y, z] });
    } else if (e.button === 2) {
      const [nx, ny, nz] = this.target.normal;
      const b: Vec3 = [x + nx, y + ny, z + nz];
      const p = this.player.pos;
      if (playerOverlapsBlock(p.x, p.y, p.z, b[0], b[1], b[2])) return; // not inside ourselves
      this.net.send({ t: 'place', b });
    }
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private sendMove(now: number): void {
    if (!this.connected || now - this.lastSend < 50) return; // 20 times per second
    const { x, y, z } = this.player.pos;
    const ry = this.player.yaw;
    const s = this.sent;
    if (x === s.x && y === s.y && z === s.z && ry === s.ry) return;
    this.lastSend = now;
    this.sent = { x, y, z, ry };
    this.net.send({ t: 'move', p: [x, y, z], ry });
  }

  private updateTarget(): void {
    this.camera.getWorldDirection(this.dir);
    this.target = this.world.raycast(this.camera.position, this.dir, REACH);
    if (this.target && this.locked) {
      const [x, y, z] = this.target.block;
      this.outline.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.outline.visible = true;
    } else {
      this.outline.visible = false;
    }
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 30);

    if (this.ready) {
      if (this.connected) this.player.update(dt, this.keys, this.locked);
      this.camera.position.set(this.player.pos.x, this.player.pos.y + EYE_HEIGHT, this.player.pos.z);
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
      this.updateTarget();
      this.sendMove(performance.now());
    } else {
      this.camera.position.set(15, 8, 40);
      this.camera.lookAt(15, 0, 15);
    }

    this.remotes.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
