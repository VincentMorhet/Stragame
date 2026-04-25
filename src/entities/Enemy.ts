import Phaser from "phaser";
import type { EnemyConfig } from "../types";
import type { WorldPoint } from "../systems/PathfindingHelper";

export class Enemy {
  readonly scene: Phaser.Scene;
  readonly config: EnemyConfig;
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Arc;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;

  hp: number;
  readonly maxHp: number;
  readonly baseSpeed: number;
  speed: number;

  private waypoints: WorldPoint[];
  private segIndex: number = 0;
  private slowTimer: number = 0;
  private slowFactor: number = 1;

  alive: boolean = true;
  reachedBase: boolean = false;

  constructor(scene: Phaser.Scene, config: EnemyConfig, waypoints: WorldPoint[]) {
    this.scene = scene;
    this.config = config;
    this.waypoints = waypoints;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.baseSpeed = config.speed;
    this.speed = config.speed;

    const start = waypoints[0]!;
    this.container = scene.add.container(start.x, start.y);
    this.container.setDepth(1000);

    this.body = scene.add.circle(0, -8, config.radius, parseInt(config.color, 16));
    this.body.setStrokeStyle(2, 0x000000, 0.6);

    this.hpBarBg = scene.add.rectangle(0, -config.radius - 14, 28, 4, 0x000000, 0.6);
    this.hpBar = scene.add.rectangle(0, -config.radius - 14, 26, 2, 0x4ade80, 1);

    this.container.add([this.body, this.hpBarBg, this.hpBar]);
  }

  update(dtMs: number): void {
    if (!this.alive) return;

    const dt = dtMs / 1000;

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
        this.speed = this.baseSpeed;
      }
    }

    if (this.segIndex >= this.waypoints.length - 1) {
      this.reachedBase = true;
      return;
    }

    const target = this.waypoints[this.segIndex + 1]!;
    const dx = target.x - this.container.x;
    const dy = target.y - this.container.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (step >= dist) {
      this.container.setPosition(target.x, target.y);
      this.segIndex++;
      if (this.segIndex >= this.waypoints.length - 1) {
        this.reachedBase = true;
      }
    } else {
      this.container.x += (dx / dist) * step;
      this.container.y += (dy / dist) * step;
    }

    this.container.setDepth(1000 + this.container.y);
  }

  takeDamage(damage: number): void {
    if (!this.alive) return;
    this.hp -= damage;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scaleX = ratio;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  applySlow(factor: number, durationSec: number): void {
    if (factor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = factor;
      this.speed = this.baseSpeed * factor;
    }
    this.slowTimer = Math.max(this.slowTimer, durationSec);
  }

  worldX(): number {
    return this.container.x;
  }

  worldY(): number {
    return this.container.y - 8;
  }

  destroy(): void {
    this.container.destroy();
  }
}
