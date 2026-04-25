import Phaser from "phaser";
import type { WavesData, WaveSpawn } from "../types";
import { Events } from "../types";

interface ActiveSpawn {
  spawn: WaveSpawn;
  remaining: number;
  timer: number;
  started: boolean;
}

export class WaveManager {
  private bus: Phaser.Events.EventEmitter;
  private data: WavesData;
  private current: number = 0;
  private active: ActiveSpawn[] = [];
  private waveActive: boolean = false;
  private spawnedThisWave: number = 0;
  private destroyedThisWave: number = 0;
  private readonly onSpawn: (type: string) => void;

  constructor(
    bus: Phaser.Events.EventEmitter,
    data: WavesData,
    onSpawn: (type: string) => void,
  ) {
    this.bus = bus;
    this.data = data;
    this.onSpawn = onSpawn;
  }

  get currentIndex(): number {
    return this.current;
  }

  get totalWaves(): number {
    return this.data.waves.length;
  }

  get currentLabel(): string {
    return this.data.waves[this.current]?.label ?? "—";
  }

  isActive(): boolean {
    return this.waveActive;
  }

  isLastCleared(): boolean {
    return !this.waveActive && this.current >= this.data.waves.length;
  }

  emitInitial(): void {
    this.bus.emit(Events.WaveChanged, {
      index: this.current,
      total: this.totalWaves,
      label: this.currentLabel,
      active: this.waveActive,
    });
  }

  startNextWave(): boolean {
    if (this.waveActive) return false;
    if (this.current >= this.data.waves.length) return false;
    const wave = this.data.waves[this.current]!;
    this.active = wave.spawns.map((s) => ({
      spawn: s,
      remaining: s.count,
      timer: s.delay,
      started: false,
    }));
    this.spawnedThisWave = 0;
    this.destroyedThisWave = 0;
    this.waveActive = true;
    this.bus.emit(Events.WaveStarted, this.current);
    this.bus.emit(Events.WaveChanged, {
      index: this.current,
      total: this.totalWaves,
      label: this.currentLabel,
      active: true,
    });
    return true;
  }

  update(dtMs: number): void {
    if (!this.waveActive) return;
    const dt = dtMs / 1000;
    let allExhausted = true;

    for (const slot of this.active) {
      if (slot.remaining <= 0) continue;
      allExhausted = false;
      slot.timer -= dt;
      if (slot.timer <= 0) {
        if (!slot.started) {
          slot.started = true;
        }
        this.onSpawn(slot.spawn.type);
        this.spawnedThisWave++;
        slot.remaining--;
        slot.timer += slot.spawn.interval;
      }
    }

    if (allExhausted && this.destroyedThisWave >= this.spawnedThisWave) {
      this.completeWave();
    }
  }

  notifyEnemyDestroyed(): void {
    this.destroyedThisWave++;
  }

  private completeWave(): void {
    this.waveActive = false;
    this.bus.emit(Events.WaveCleared, {
      index: this.current,
      bonus: this.data.endOfWaveBonus,
    });
    this.current++;
    this.bus.emit(Events.WaveChanged, {
      index: this.current,
      total: this.totalWaves,
      label: this.current < this.totalWaves ? this.currentLabel : "Terminé",
      active: false,
    });
    if (this.current >= this.data.waves.length) {
      this.bus.emit(Events.GameWon);
    }
  }

  endOfWaveBonus(): number {
    return this.data.endOfWaveBonus;
  }
}
