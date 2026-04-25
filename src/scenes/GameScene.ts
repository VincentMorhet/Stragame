import Phaser from "phaser";
import mapDataRaw from "../data/map.json";
import towersDataRaw from "../data/towers.json";
import enemiesDataRaw from "../data/enemies.json";
import wavesDataRaw from "../data/waves.json";
import type {
  EnemiesData,
  EnemyConfig,
  MapData,
  TowersData,
  WavesData,
} from "../types";
import { Events } from "../types";
import { IsoGrid, TILE_HEIGHT, TILE_WIDTH } from "../systems/IsoGrid";
import { PathfindingHelper } from "../systems/PathfindingHelper";
import { EconomyManager } from "../systems/EconomyManager";
import { WaveManager } from "../systems/WaveManager";
import { Base } from "../entities/Base";
import { Enemy } from "../entities/Enemy";
import { Tower } from "../entities/Tower";
import { Projectile } from "../entities/Projectile";

const STARTING_CREDITS = 100;
const BASE_MAX_HP = 20;

export class GameScene extends Phaser.Scene {
  private mapData!: MapData;
  private towersData!: TowersData;
  private enemiesData!: EnemiesData;
  private wavesData!: WavesData;

  private grid!: IsoGrid;
  private path!: PathfindingHelper;
  private base!: Base;

  private economy!: EconomyManager;
  private waves!: WaveManager;
  private bus!: Phaser.Events.EventEmitter;

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];

  private hoverIndicator!: Phaser.GameObjects.Polygon;
  private gameOver: boolean = false;
  private selectedTowerType: string | null = null;
  private placedKeys: Set<string> = new Set();

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.mapData = mapDataRaw as MapData;
    this.towersData = towersDataRaw as TowersData;
    this.enemiesData = enemiesDataRaw as EnemiesData;
    this.wavesData = wavesDataRaw as WavesData;

    this.bus = this.registry.get("bus") as Phaser.Events.EventEmitter;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.placedKeys = new Set();
    this.gameOver = false;
    this.selectedTowerType = null;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 40;
    const centerOffsetX = ((this.mapData.gridWidth - this.mapData.gridHeight) * TILE_WIDTH) / 4;
    const centerOffsetY = ((this.mapData.gridWidth + this.mapData.gridHeight) * TILE_HEIGHT) / 4;

    this.grid = new IsoGrid(this.mapData, cx - centerOffsetX, cy - centerOffsetY);
    this.path = new PathfindingHelper(this.mapData, this.grid);

    this.drawBackground();
    this.drawTiles();

    const baseWorld = this.grid.gridToWorld(this.path.baseGrid.x, this.path.baseGrid.y);
    this.base = new Base(this, baseWorld.x, baseWorld.y, BASE_MAX_HP);

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const diamondPoints = [0, -hh, hw, 0, 0, hh, -hw, 0];
    this.hoverIndicator = this.add.polygon(0, 0, diamondPoints, 0xffffff, 0.25);
    this.hoverIndicator.setStrokeStyle(2, 0xffffff, 0.8);
    this.hoverIndicator.setVisible(false);
    this.hoverIndicator.setDepth(800);

    this.economy = new EconomyManager(this.bus, STARTING_CREDITS);
    this.waves = new WaveManager(this.bus, this.wavesData, (type) => this.spawnEnemy(type));

    this.economy.emitInitial();
    this.bus.emit(Events.BaseHpChanged, { hp: this.base.hp, max: this.base.maxHp });
    this.waves.emitInitial();

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.handlePointerMove(p));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handlePointerDown(p));

    this.bus.on(Events.TowerSelected, (type: string | null) => {
      this.selectedTowerType = type;
    });
    this.bus.on(Events.RequestStartWave, () => {
      this.waves.startNextWave();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-SPACE", () => this.waves.startNextWave());
      this.input.keyboard.on("keydown-ESC", () => {
        this.selectedTowerType = null;
        this.bus.emit(Events.TowerSelected, null);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    for (const e of this.enemies) e.update(delta);
    for (const t of this.towers) t.update(delta, this.enemies, this.projectiles);
    for (const p of this.projectiles) p.update(delta, this.enemies);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      if (e.reachedBase) {
        if (this.base.takeDamage(e.config.damageToBase)) {
          this.triggerGameOver();
        }
        this.bus.emit(Events.BaseHpChanged, { hp: this.base.hp, max: this.base.maxHp });
        e.destroy();
        this.enemies.splice(i, 1);
        this.waves.notifyEnemyDestroyed();
      } else if (!e.alive) {
        this.economy.award(e.config.reward);
        e.destroy();
        this.enemies.splice(i, 1);
        this.waves.notifyEnemyDestroyed();
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1);
    }

    const wasActive = this.waves.isActive();
    this.waves.update(delta);
    if (wasActive && !this.waves.isActive()) {
      this.economy.award(this.waves.endOfWaveBonus());
    }
  }

  private drawBackground(): void {
    const b = this.grid.bounds();
    const bg = this.add.rectangle(
      (b.minX + b.maxX) / 2,
      (b.minY + b.maxY) / 2,
      b.maxX - b.minX + 80,
      b.maxY - b.minY + 80,
      0x111827,
      0,
    );
    bg.setDepth(-100);
  }

  private drawTiles(): void {
    const g = this.add.graphics();
    g.setDepth(0);
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const isPath = this.path.isPath(x, y);
        const isBase = this.path.isBase(x, y);
        const fill = isBase ? 0xfacc15 : isPath ? 0x6b4f2a : 0x355e3b;
        const altGrass = (x + y) % 2 === 0 ? 0x355e3b : 0x2f5234;
        const fillFinal = isBase ? fill : isPath ? fill : altGrass;
        const stroke = isBase ? 0x7a5a00 : isPath ? 0x3e2d18 : 0x1e3a25;
        const pts = this.grid.tileDiamond(x, y);
        g.fillStyle(fillFinal, 1);
        g.lineStyle(1, stroke, 1);
        g.beginPath();
        g.moveTo(pts[0]!, pts[1]!);
        g.lineTo(pts[2]!, pts[3]!);
        g.lineTo(pts[4]!, pts[5]!);
        g.lineTo(pts[6]!, pts[7]!);
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
    }
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (!this.selectedTowerType) {
      this.hoverIndicator.setVisible(false);
      return;
    }
    const tile = this.grid.worldToGrid(p.worldX, p.worldY);
    if (!this.grid.inBounds(tile.x, tile.y)) {
      this.hoverIndicator.setVisible(false);
      return;
    }
    const c = this.grid.gridToWorld(tile.x, tile.y);
    this.showHover(c.x, c.y, this.canBuildOn(tile.x, tile.y));
  }

  private showHover(x: number, y: number, valid: boolean): void {
    this.hoverIndicator.setPosition(x, y);
    this.hoverIndicator.setFillStyle(valid ? 0x4ade80 : 0xef4444, 0.35);
    this.hoverIndicator.setStrokeStyle(2, valid ? 0x4ade80 : 0xef4444, 1);
    this.hoverIndicator.setVisible(true);
  }

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.gameOver) return;
    if (!this.selectedTowerType) return;
    const tile = this.grid.worldToGrid(p.worldX, p.worldY);
    if (!this.canBuildOn(tile.x, tile.y)) return;
    const config = this.towersData[this.selectedTowerType];
    if (!config) return;
    const cost = config.levels[0]!.cost;
    if (!this.economy.spend(cost)) return;

    const c = this.grid.gridToWorld(tile.x, tile.y);
    const tower = new Tower(this, this.selectedTowerType, config, tile, c.x, c.y);
    this.towers.push(tower);
    this.placedKeys.add(`${tile.x},${tile.y}`);
  }

  private canBuildOn(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    if (this.path.isPath(gx, gy)) return false;
    if (this.placedKeys.has(`${gx},${gy}`)) return false;
    return true;
  }

  private spawnEnemy(type: string): void {
    const cfg: EnemyConfig | undefined = this.enemiesData[type];
    if (!cfg) {
      console.warn(`Unknown enemy type: ${type}`);
      return;
    }
    const enemy = new Enemy(this, cfg, this.path.waypointsWorld);
    this.enemies.push(enemy);
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.bus.emit(Events.GameOver);
  }

  private cleanup(): void {
    this.bus.off(Events.TowerSelected);
    this.bus.off(Events.RequestStartWave);
    for (const e of this.enemies) e.destroy();
    for (const t of this.towers) t.destroy();
    for (const p of this.projectiles) p.sprite.destroy();
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
  }
}
