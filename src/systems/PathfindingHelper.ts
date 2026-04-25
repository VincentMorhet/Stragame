import type { GridCoord, MapData } from "../types";
import { IsoGrid } from "./IsoGrid";

export interface WorldPoint {
  x: number;
  y: number;
}

export class PathfindingHelper {
  readonly waypointsGrid: GridCoord[];
  readonly waypointsWorld: WorldPoint[];
  readonly pathTiles: Set<string>;
  readonly spawnGrid: GridCoord;
  readonly baseGrid: GridCoord;

  constructor(map: MapData, grid: IsoGrid) {
    this.waypointsGrid = map.waypoints.map((w) => ({ ...w }));
    this.waypointsWorld = this.waypointsGrid.map((w) => grid.gridToWorld(w.x, w.y));
    this.spawnGrid = this.waypointsGrid[0]!;
    this.baseGrid = this.waypointsGrid[this.waypointsGrid.length - 1]!;
    this.pathTiles = this.buildPathTileSet();
  }

  private buildPathTileSet(): Set<string> {
    const tiles = new Set<string>();
    for (let i = 0; i < this.waypointsGrid.length - 1; i++) {
      const a = this.waypointsGrid[i]!;
      const b = this.waypointsGrid[i + 1]!;
      if (a.x === b.x) {
        const step = b.y > a.y ? 1 : -1;
        for (let y = a.y; y !== b.y; y += step) tiles.add(key(a.x, y));
      } else if (a.y === b.y) {
        const step = b.x > a.x ? 1 : -1;
        for (let x = a.x; x !== b.x; x += step) tiles.add(key(x, a.y));
      } else {
        throw new Error("Path segments must be axis-aligned");
      }
    }
    const last = this.waypointsGrid[this.waypointsGrid.length - 1]!;
    tiles.add(key(last.x, last.y));
    return tiles;
  }

  isPath(gx: number, gy: number): boolean {
    return this.pathTiles.has(key(gx, gy));
  }

  isBase(gx: number, gy: number): boolean {
    return gx === this.baseGrid.x && gy === this.baseGrid.y;
  }
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
