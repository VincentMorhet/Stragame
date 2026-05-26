import Phaser from "phaser";
import type { TowerConfig, TowerLevelStats, GridCoord } from "../types";
import { TILE_HEIGHT, TILE_WIDTH } from "../systems/IsoGrid";
import { Enemy } from "./Enemy";
import { Projectile } from "./Projectile";

export const RANGE_UNIT_PX = TILE_WIDTH;

const STONE = 0x6b7280;
const STONE_DARK = 0x374151;
const STONE_LIGHT = 0x9ca3af;

interface TowerStyle {
  bodyWidth: number;
  bodyHeight: number;
  barrelLength: number;
  barrelWidth: number;
  crowns: number;
}

const TOWER_STYLES: Record<string, TowerStyle> = {
  turret: { bodyWidth: 14, bodyHeight: 18, barrelLength: 14, barrelWidth: 3, crowns: 0 },
  cannon: { bodyWidth: 20, bodyHeight: 14, barrelLength: 12, barrelWidth: 6, crowns: 0 },
  slower: { bodyWidth: 12, bodyHeight: 16, barrelLength: 10, barrelWidth: 4, crowns: 4 },
  sniper: { bodyWidth: 10, bodyHeight: 22, barrelLength: 20, barrelWidth: 2, crowns: 0 },
};

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
  private barrelPivot: Phaser.GameObjects.Container;
  private rangeIndicator: Phaser.GameObjects.Arc;
  private style: TowerStyle;

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
    this.style = TOWER_STYLES[typeKey] ?? TOWER_STYLES.turret!;

    this.container = scene.add.container(worldX, worldY);
    this.container.setDepth(900 + worldY);

    const colorInt = parseInt(config.color, 16);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    this.rangeIndicator = scene.add.circle(0, 0, this.stats().range * RANGE_UNIT_PX, colorInt, 0.08);
    this.rangeIndicator.setStrokeStyle(1, colorInt, 0.4);
    this.rangeIndicator.setVisible(false);

    const shadow = scene.add.ellipse(0, 4, TILE_WIDTH * 0.7, TILE_HEIGHT * 0.7, 0x000000, 0.35);

    const inset = 3;
    const stonePlatform = scene.add.polygon(
      0,
      0,
      [0, -hh + inset, hw - inset, 0, 0, hh - inset, -hw + inset, 0],
      STONE,
      1,
    );
    stonePlatform.setStrokeStyle(2, STONE_DARK, 1);

    const innerInset = 10;
    const accent = scene.add.polygon(
      0,
      -2,
      [
        0, -hh + innerInset,
        hw - innerInset, 0,
        0, hh - innerInset,
        -hw + innerInset, 0,
      ],
      colorInt,
      0.55,
    );
    accent.setStrokeStyle(1, colorInt, 0.9);

    const stoneRim = scene.add.ellipse(0, -2, this.style.bodyWidth + 6, this.style.bodyWidth * 0.55, STONE_LIGHT, 1);
    stoneRim.setStrokeStyle(1, STONE_DARK, 1);

    const body = scene.add.rectangle(
      0,
      -this.style.bodyHeight / 2 - 2,
      this.style.bodyWidth,
      this.style.bodyHeight,
      colorInt,
      1,
    );
    body.setStrokeStyle(2, STONE_DARK, 1);

    const bodyHighlight = scene.add.rectangle(
      -this.style.bodyWidth / 2 + 2,
      -this.style.bodyHeight / 2 - 2,
      2,
      this.style.bodyHeight - 4,
      0xffffff,
      0.25,
    );

    const cap = scene.add.circle(0, -this.style.bodyHeight - 2, this.style.bodyWidth / 2 + 1, colorInt, 1);
    cap.setStrokeStyle(1, STONE_DARK, 1);

    const capHighlight = scene.add.circle(-1, -this.style.bodyHeight - 3, 1.5, 0xffffff, 0.7);

    this.barrelPivot = scene.add.container(0, -this.style.bodyHeight - 2);
    const barrel = scene.add.rectangle(
      0,
      -this.style.barrelLength / 2,
      this.style.barrelWidth,
      this.style.barrelLength,
      STONE_DARK,
      1,
    );
    barrel.setStrokeStyle(1, 0x111827, 1);
    const muzzle = scene.add.rectangle(
      0,
      -this.style.barrelLength,
      this.style.barrelWidth + 2,
      3,
      colorInt,
      1,
    );
    muzzle.setStrokeStyle(1, STONE_DARK, 1);
    this.barrelPivot.add([barrel, muzzle]);

    const decorations: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < this.style.crowns; i++) {
      const a = (i / this.style.crowns) * Math.PI * 2;
      const cx = Math.cos(a) * (this.style.bodyWidth / 2 + 3);
      const cy = -this.style.bodyHeight / 2 - 2 + Math.sin(a) * 4;
      const crystal = scene.add.triangle(cx, cy, -2, 3, 2, 3, 0, -4, colorInt, 1);
      crystal.setStrokeStyle(1, STONE_DARK, 1);
      decorations.push(crystal);
    }

    this.container.add([
      this.rangeIndicator,
      shadow,
      stonePlatform,
      accent,
      stoneRim,
      body,
      bodyHighlight,
      cap,
      capHighlight,
      ...decorations,
      this.barrelPivot,
    ]);
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

    const target = this.findTarget(enemies);
    if (target) {
      const dx = target.worldX() - this.worldX;
      const dy = target.worldY() - (this.worldY - this.style.bodyHeight - 2);
      this.barrelPivot.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    }

    if (this.cooldown > 0) return;
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
    const muzzleAngle = this.barrelPivot.rotation - Math.PI / 2;
    const muzzleX = this.worldX + Math.cos(muzzleAngle) * this.style.barrelLength;
    const muzzleY = (this.worldY - this.style.bodyHeight - 2) + Math.sin(muzzleAngle) * this.style.barrelLength;
    const proj = new Projectile(
      this.scene,
      muzzleX,
      muzzleY,
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
      targets: this.barrelPivot,
      scaleY: 0.85,
      duration: 60,
      yoyo: true,
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
