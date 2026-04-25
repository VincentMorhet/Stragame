import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH } from "../systems/IsoGrid";

export class Base {
  readonly scene: Phaser.Scene;
  readonly worldX: number;
  readonly worldY: number;
  readonly maxHp: number;
  hp: number;

  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, maxHp: number) {
    this.scene = scene;
    this.worldX = worldX;
    this.worldY = worldY;
    this.maxHp = maxHp;
    this.hp = maxHp;

    this.container = scene.add.container(worldX, worldY);
    this.container.setDepth(950 + worldY);

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const tile = scene.add.polygon(0, 0, [0, -hh, hw, 0, 0, hh, -hw, 0], 0xfacc15, 0.9);
    tile.setStrokeStyle(2, 0x7a5a00, 0.8);

    const keep = scene.add.rectangle(0, -16, 28, 28, 0xc2410c, 1);
    keep.setStrokeStyle(2, 0x4a1a05, 1);

    const flagPole = scene.add.rectangle(0, -42, 2, 24, 0x222222);
    const flag = scene.add.triangle(8, -48, 0, 0, 14, 6, 0, 12, 0xef4444);

    this.container.add([tile, keep, flagPole, flag]);
  }

  takeDamage(damage: number): boolean {
    this.hp = Math.max(0, this.hp - damage);
    return this.hp <= 0;
  }
}
