export interface GridCoord {
  x: number;
  y: number;
}

export interface TowerLevelStats {
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  splashRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
}

export interface TowerConfig {
  name: string;
  description: string;
  color: string;
  levels: TowerLevelStats[];
}

export type TowersData = Record<string, TowerConfig>;

export interface EnemyConfig {
  name: string;
  color: string;
  hp: number;
  speed: number;
  damageToBase: number;
  reward: number;
  radius: number;
}

export type EnemiesData = Record<string, EnemyConfig>;

export interface WaveSpawn {
  type: string;
  count: number;
  interval: number;
  delay: number;
}

export interface WaveConfig {
  label: string;
  spawns: WaveSpawn[];
}

export interface WavesData {
  endOfWaveBonus: number;
  waves: WaveConfig[];
}

export interface MapData {
  gridWidth: number;
  gridHeight: number;
  waypoints: GridCoord[];
}

export const Events = {
  CreditsChanged: "credits-changed",
  BaseHpChanged: "base-hp-changed",
  WaveChanged: "wave-changed",
  WaveStarted: "wave-started",
  WaveCleared: "wave-cleared",
  GameOver: "game-over",
  GameWon: "game-won",
  TowerSelected: "tower-selected",
  RequestStartWave: "request-start-wave",
} as const;
