import Phaser from "phaser";
import type { Enemy } from "./Enemy";
import { RANGE_UNIT_PX } from "./Tower";

export interface ProjectileOptions {
  damage: number;
  speed: number;
  color: number;
  splashRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
}

export class Projectile {
  readonly scene: Phaser.Scene;
  readonly sprite: Phaser.GameObjects.Arc;
  readonly target: Enemy;
  readonly options: ProjectileOptions;
  alive: boolean = true;

  constructor(
    scene: Phaser.Scene,
    fromX: number,
    fromY: number,
    target: Enemy,
    options: ProjectileOptions,
  ) {
    this.scene = scene;
    this.target = target;
    this.options = options;
    this.sprite = scene.add.circle(fromX, fromY, 4, options.color);
    this.sprite.setDepth(2000);
  }

  update(dtMs: number, allEnemies: Enemy[]): void {
    if (!this.alive) return;

    if (!this.target.alive) {
      this.alive = false;
      this.sprite.destroy();
      return;
    }

    const dt = dtMs / 1000;
    const tx = this.target.worldX();
    const ty = this.target.worldY();
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const step = this.options.speed * dt;

    if (step >= dist) {
      this.impact(allEnemies);
      return;
    }

    this.sprite.x += (dx / dist) * step;
    this.sprite.y += (dy / dist) * step;
  }

  private impact(allEnemies: Enemy[]): void {
    const splash = this.options.splashRadius;
    if (splash && splash > 0) {
      const radiusPx = splash * RANGE_UNIT_PX;
      const cx = this.sprite.x;
      const cy = this.sprite.y;
      for (const e of allEnemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.worldX() - cx, e.worldY() - cy);
        if (d <= radiusPx) {
          e.takeDamage(this.options.damage);
          if (this.options.slowFactor && this.options.slowDuration) {
            e.applySlow(this.options.slowFactor, this.options.slowDuration);
          }
        }
      }
      this.flashSplash(cx, cy, radiusPx);
    } else {
      this.target.takeDamage(this.options.damage);
      if (this.options.slowFactor && this.options.slowDuration) {
        this.target.applySlow(this.options.slowFactor, this.options.slowDuration);
      }
    }
    this.alive = false;
    this.sprite.destroy();
  }

  private flashSplash(cx: number, cy: number, r: number): void {
    const ring = this.scene.add.circle(cx, cy, r, this.options.color, 0.25);
    ring.setStrokeStyle(2, this.options.color, 0.8);
    ring.setDepth(1900);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.1,
      duration: 250,
      onComplete: () => ring.destroy(),
    });
  }
}
