import type { GridCoord, MapData } from "../types";

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export class IsoGrid {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;

  constructor(map: MapData, originX: number, originY: number) {
    this.width = map.gridWidth;
    this.height = map.gridHeight;
    this.originX = originX;
    this.originY = originY;
  }

  gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.originX + (gx - gy) * (TILE_WIDTH / 2),
      y: this.originY + (gx + gy) * (TILE_HEIGHT / 2),
    };
  }

  worldToGrid(wx: number, wy: number): GridCoord {
    const dx = wx - this.originX;
    const dy = wy - this.originY;
    const gx = dx / TILE_WIDTH + dy / TILE_HEIGHT;
    const gy = dy / TILE_HEIGHT - dx / TILE_WIDTH;
    return { x: Math.floor(gx), y: Math.floor(gy) };
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < this.width && gy < this.height;
  }

  tileDiamond(gx: number, gy: number): number[] {
    const c = this.gridToWorld(gx, gy);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    return [
      c.x, c.y - hh,
      c.x + hw, c.y,
      c.x, c.y + hh,
      c.x - hw, c.y,
    ];
  }

  bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const corners = [
      this.gridToWorld(0, 0),
      this.gridToWorld(this.width - 1, 0),
      this.gridToWorld(0, this.height - 1),
      this.gridToWorld(this.width - 1, this.height - 1),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    return {
      minX: Math.min(...xs) - TILE_WIDTH / 2,
      maxX: Math.max(...xs) + TILE_WIDTH / 2,
      minY: Math.min(...ys) - TILE_HEIGHT / 2,
      maxY: Math.max(...ys) + TILE_HEIGHT / 2,
    };
  }
}
