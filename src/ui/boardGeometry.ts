import { centre, type Grid } from '../engine/grid';
import type { Pos } from '../engine/types';

/** One cell, flat side to flat side, in pixels. */
export const CELL = 34;
/** Hex: centre to corner. */
export const HEX_R = CELL / Math.sqrt(3);

export function boardSize(width: number, height: number, grid: Grid): { w: number; h: number } {
  return grid === 'hex' ? { w: (width + 0.5) * CELL, h: (height - 1) * CELL * (Math.sqrt(3) / 2) + 2 * HEX_R } : { w: width * CELL, h: height * CELL };
}

/** Pixel centre of a cell. */
export function pixel(p: Pos, grid: Grid): { x: number; y: number } {
  const c = centre(p, grid);
  return { x: (c.x + 0.5) * CELL, y: c.y * CELL + (grid === 'hex' ? HEX_R : CELL / 2) };
}

/** Corner `i` of a cell (hex: 6 corners from 30°, square: 4 from 45°), scaled by `k`. */
function corners(grid: Grid): number[] {
  return grid === 'hex' ? [30, 90, 150, 210, 270, 330] : [45, 135, 225, 315];
}

const radius = (grid: Grid) => (grid === 'hex' ? HEX_R : CELL / Math.SQRT2);

/** SVG points of a cell outline, `k` = scale (1 = exact; a little more hides the seams between filled cells). */
export function cellPoints(p: Pos, grid: Grid, k = 1): string {
  const c = pixel(p, grid);
  const r = radius(grid) * k;
  return corners(grid)
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `${(c.x + Math.cos(a) * r).toFixed(2)},${(c.y + Math.sin(a) * r).toFixed(2)}`;
    })
    .join(' ');
}

/** The edge of cell `p` it shares with neighbour `n`, as a line. */
export function sharedEdge(p: Pos, n: Pos, grid: Grid): { x1: number; y1: number; x2: number; y2: number } {
  const c = pixel(p, grid);
  const o = pixel(n, grid);
  const toward = (Math.atan2(o.y - c.y, o.x - c.x) * 180) / Math.PI;
  const half = grid === 'hex' ? 30 : 45;
  const r = radius(grid);
  const at = (deg: number) => ({ x: c.x + Math.cos((deg * Math.PI) / 180) * r, y: c.y + Math.sin((deg * Math.PI) / 180) * r });
  const a = at(toward - half);
  const b = at(toward + half);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}
