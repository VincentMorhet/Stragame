import Phaser from "phaser";
import type { TowerConfig, TowerLevelStats, GridCoord } from "../types";
import { TILE_HEIGHT, TILE_WIDTH } from "../systems/IsoGrid";
import { Enemy } from "./Enemy";
import { Projectile } from "./Projectile";

export const RANGE_UNIT_PX = TILE_WIDTH;

export class Tower {
  readonly scene: Phaser.Scene;
  readonly typeKey: string;
  readonly config: TowerConfig;
  readonly tile: GridCoord;
  readonly worldX: number;
  readonly worldY: number;

  level: number = 0;
  totalSpent: number = 0;
  private cooldown: number = 0;

  readonly container: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Polygon;
  private barrel: Phaser.GameObjects.Triangle;
  private rangeIndicator: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    typeKey: string,
    config: TowerConfig,
    tile: GridCoord,
    worldX: number,
    worldY: number,
  ) {
    this.scene = scene;
    this.typeKey = typeKey;
    this.config = config;
    this.tile = tile;
    this.worldX = worldX;
    this.worldY = worldY;
    this.totalSpent = config.levels[0]!.cost;

    this.container = scene.add.container(worldX, worldY);
    this.container.setDepth(900 + worldY);

    const colorInt = parseInt(config.color, 16);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    this.base = scene.add.polygon(
      0,
      0,
      [0, -hh, hw, 0, 0, hh, -hw, 0],
      colorInt,
      0.85,
    );
    this.base.setStrokeStyle(2, 0x000000, 0.5);

    this.barrel = scene.add.triangle(0, -10, -6, 6, 6, 6, 0, -16, colorInt, 1);
    this.barrel.setStrokeStyle(1, 0x000000, 0.6);

    this.rangeIndicator = scene.add.circle(0, 0, this.stats().range * RANGE_UNIT_PX, colorInt, 0.08);
    this.rangeIndicator.setStrokeStyle(1, colorInt, 0.4);
    this.rangeIndicator.setVisible(false);

    this.container.add([this.rangeIndicator, this.base, this.barrel]);
  }

  stats(): TowerLevelStats {
    return this.config.levels[this.level]!;
  }

  rangePixels(): number {
    return this.stats().range * RANGE_UNIT_PX;
  }

  upgradeCost(): number | null {
    const next = this.config.levels[this.level + 1];
    return next ? next.cost : null;
  }

  upgrade(): void {
    const next = this.config.levels[this.level + 1];
    if (!next) return;
    this.level++;
    this.totalSpent += next.cost;
    this.rangeIndicator.setRadius(this.rangePixels());
  }

  sellValue(): number {
    return Math.floor(this.totalSpent * 0.7);
  }

  showRange(show: boolean): void {
    this.rangeIndicator.setVisible(show);
  }

  update(dtMs: number, enemies: Enemy[], projectiles: Projectile[]): void {
    const dt = dtMs / 1000;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) return;

    this.fire(target, projectiles);
    this.cooldown = 1 / this.stats().fireRate;
  }

  private findTarget(enemies: Enemy[]): Enemy | null {
    const r = this.rangePixels();
    let best: Enemy | null = null;
    let bestProgress = -Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.worldX() - this.worldX, e.worldY() - this.worldY);
      if (d > r) continue;
      const progress = e.worldX() + e.worldY();
      if (progress > bestProgress) {
        bestProgress = progress;
        best = e;
      }
    }
    return best;
  }

  private fire(target: Enemy, projectiles: Projectile[]): void {
    const stats = this.stats();
    const proj = new Projectile(
      this.scene,
      this.worldX,
      this.worldY - 12,
      target,
      {
        damage: stats.damage,
        speed: stats.projectileSpeed,
        color: parseInt(this.config.color, 16),
        splashRadius: stats.splashRadius,
        slowFactor: stats.slowFactor,
        slowDuration: stats.slowDuration,
      },
    );
    projectiles.push(proj);

    this.scene.tweens.add({
      targets: this.barrel,
      scaleY: 0.7,
      duration: 60,
      yoyo: true,
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
