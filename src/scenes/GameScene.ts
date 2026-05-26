import Phaser from "phaser";
import mapDataRaw from "../data/map.json";
import towersDataRaw from "../data/towers.json";
import enemiesDataRaw from "../data/enemies.json";
import wavesDataRaw from "../data/waves.json";
import type {
  EnemiesData,
  EnemyConfig,
  GridCoord,
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
const DEFAULT_ZOOM = 2;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4;
const DRAG_THRESHOLD = 8;

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

  private pointerDownPos: { x: number; y: number } | null = null;
  private isDragging: boolean = false;
  private pinchPrevDist: number | null = null;

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
    this.pointerDownPos = null;
    this.isDragging = false;
    this.pinchPrevDist = null;

    this.cameras.main.setBackgroundColor(0x0b1220);

    this.grid = new IsoGrid(this.mapData, 0, 0);
    this.path = new PathfindingHelper(this.mapData, this.grid);

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

    this.setupCamera();

    this.economy = new EconomyManager(this.bus, STARTING_CREDITS);
    this.waves = new WaveManager(this.bus, this.wavesData, (type) => this.spawnEnemy(type));

    this.economy.emitInitial();
    this.bus.emit(Events.BaseHpChanged, { hp: this.base.hp, max: this.base.maxHp });
    this.waves.emitInitial();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on(
      "wheel",
      (
        _p: Phaser.Input.Pointer,
        _objs: Phaser.GameObjects.GameObject[],
        _dx: number,
        deltaY: number,
      ) => this.applyZoom(this.cameras.main.zoom * (deltaY > 0 ? 0.9 : 1.1), null),
    );

    this.bus.on(Events.TowerSelected, (type: string | null) => {
      this.selectedTowerType = type;
      if (!type) this.hoverIndicator.setVisible(false);
    });
    this.bus.on(Events.RequestStartWave, () => {
      this.waves.startNextWave();
    });
    this.bus.on(Events.RequestZoomIn, () => this.applyZoom(this.cameras.main.zoom * 1.25, null));
    this.bus.on(Events.RequestZoomOut, () => this.applyZoom(this.cameras.main.zoom * 0.8, null));
    this.bus.on(Events.RequestCenterCamera, () => this.centerCameraOnGrid());

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-SPACE", () => this.waves.startNextWave());
      this.input.keyboard.on("keydown-ESC", () => {
        this.selectedTowerType = null;
        this.bus.emit(Events.TowerSelected, null);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private setupCamera(): void {
    const b = this.grid.bounds();
    const margin = 240;
    this.cameras.main.setBounds(
      b.minX - margin,
      b.minY - margin,
      b.maxX - b.minX + 2 * margin,
      b.maxY - b.minY + 2 * margin,
    );
    this.cameras.main.setZoom(DEFAULT_ZOOM);
    this.centerCameraOnGrid();
  }

  private centerCameraOnGrid(): void {
    const b = this.grid.bounds();
    this.cameras.main.centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  }

  private applyZoom(target: number, anchorScreen: { x: number; y: number } | null): void {
    const cam = this.cameras.main;
    const before = anchorScreen ? cam.getWorldPoint(anchorScreen.x, anchorScreen.y) : null;
    cam.setZoom(Phaser.Math.Clamp(target, MIN_ZOOM, MAX_ZOOM));
    if (before && anchorScreen) {
      const after = cam.getWorldPoint(anchorScreen.x, anchorScreen.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    }
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

  private drawTiles(): void {
    const g = this.add.graphics();
    g.setDepth(0);
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const isPath = this.path.isPath(x, y);
        const isBase = this.path.isBase(x, y);
        const altGrass = (x + y) % 2 === 0 ? 0x3d6b40 : 0x355e3b;
        const fillFinal = isBase ? 0xfacc15 : isPath ? 0x8c6b3a : altGrass;
        const stroke = isBase ? 0x7a5a00 : isPath ? 0x4a3520 : 0x1e3a25;
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
        if (isPath && !isBase) {
          const c = this.grid.gridToWorld(x, y);
          g.fillStyle(0x6b4f2a, 0.7);
          g.fillCircle(c.x - 6, c.y - 2, 1.5);
          g.fillCircle(c.x + 4, c.y + 3, 1.5);
        }
      }
    }
  }

  private pointerToTile(p: Phaser.Input.Pointer): { tile: GridCoord; world: { x: number; y: number } } {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return { tile: this.grid.worldToGrid(wp.x, wp.y), world: { x: wp.x, y: wp.y } };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.gameOver) return;
    if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) {
      this.pinchPrevDist = this.pinchDistance();
      this.pointerDownPos = null;
      return;
    }
    this.pointerDownPos = { x: p.x, y: p.y };
    this.isDragging = false;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) {
      const d = this.pinchDistance();
      if (this.pinchPrevDist !== null && d > 0) {
        const ratio = d / this.pinchPrevDist;
        const mid = this.pinchMidpoint();
        this.applyZoom(this.cameras.main.zoom * ratio, mid);
      }
      this.pinchPrevDist = d;
      this.isDragging = true;
      this.hoverIndicator.setVisible(false);
      return;
    }

    if (this.pointerDownPos && p.isDown) {
      const dx = p.x - this.pointerDownPos.x;
      const dy = p.y - this.pointerDownPos.y;
      if (!this.isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        this.isDragging = true;
        this.hoverIndicator.setVisible(false);
      }
      if (this.isDragging) {
        const cam = this.cameras.main;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
        return;
      }
    }

    if (!this.selectedTowerType) {
      this.hoverIndicator.setVisible(false);
      return;
    }
    const { tile } = this.pointerToTile(p);
    if (!this.grid.inBounds(tile.x, tile.y)) {
      this.hoverIndicator.setVisible(false);
      return;
    }
    const c = this.grid.gridToWorld(tile.x, tile.y);
    this.showHover(c.x, c.y, this.canBuildOn(tile.x, tile.y));
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.input.pointer1?.isDown || this.input.pointer2?.isDown) {
      this.pinchPrevDist = null;
      return;
    }
    this.pinchPrevDist = null;

    if (this.isDragging) {
      this.isDragging = false;
      this.pointerDownPos = null;
      return;
    }
    this.pointerDownPos = null;
    if (this.gameOver) return;
    if (!this.selectedTowerType) return;

    const { tile } = this.pointerToTile(p);
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

  private pinchDistance(): number {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pinchMidpoint(): { x: number; y: number } {
    const a = this.input.pointer1!;
    const b = this.input.pointer2!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private showHover(x: number, y: number, valid: boolean): void {
    this.hoverIndicator.setPosition(x, y);
    this.hoverIndicator.setFillStyle(valid ? 0x4ade80 : 0xef4444, 0.35);
    this.hoverIndicator.setStrokeStyle(2, valid ? 0x4ade80 : 0xef4444, 1);
    this.hoverIndicator.setVisible(true);
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
    this.bus.off(Events.RequestZoomIn);
    this.bus.off(Events.RequestZoomOut);
    this.bus.off(Events.RequestCenterCamera);
    for (const e of this.enemies) e.destroy();
    for (const t of this.towers) t.destroy();
    for (const p of this.projectiles) p.sprite.destroy();
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
  }
}
