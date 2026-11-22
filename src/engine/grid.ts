import type { Pos } from './types';

/**
 * Battlefield geometry. The rules count movement and reach in squares of 1.5 m (§2.5), but on a square grid a
 * diagonal step covers 1.4× the ground of a straight one. The hex grid (a house option, the default) fixes that:
 * every step to a neighbour is 1.5 m, whichever way you go.
 *
 * Hexes are "pointy-top" in offset coordinates ("odd-r": every odd row is shoved half a hex to the right), so the
 * board stays a rectangle of `width × height` cells and a `Pos` is still `{ x: column, y: row }`. A fighter can
 * step straight east or west, and diagonally at 60° – there is no straight north/south neighbour.
 */
export type Grid = 'hex' | 'square';

/** One cell, flat side to flat side (hex) or side to side (square). */
export const CELL_M = 1.5;

const ROW_H = Math.sqrt(3) / 2;

/** Cell centre in "cell widths" on the plane – the same space facing vectors live in. */
export function centre(p: Pos, grid: Grid): Pos {
  return grid === 'hex' ? { x: p.x + (p.y & 1 ? 0.5 : 0), y: p.y * ROW_H } : { x: p.x, y: p.y };
}

/** Distance in steps: Chebyshev on squares (diagonals count as one), hex steps on hexes. */
export function cellDistance(a: Pos, b: Pos, grid: Grid): number {
  if (grid === 'square') return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  // odd-r offset → axial (q, r).
  const aq = a.x - (a.y - (a.y & 1)) / 2;
  const bq = b.x - (b.y - (b.y & 1)) / 2;
  const dq = aq - bq;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Straight-line distance in metres between cell centres, one decimal. */
export function cellMetres(a: Pos, b: Pos, grid: Grid): number {
  const ca = centre(a, grid);
  const cb = centre(b, grid);
  return Math.round(Math.hypot(ca.x - cb.x, ca.y - cb.y) * CELL_M * 10) / 10;
}

/** The cells right next to `p` (8 on squares, 6 on hexes), on or off the board. */
export function neighbours(p: Pos, grid: Grid): Pos[] {
  if (grid === 'square') {
    const out: Pos[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) out.push({ x: p.x + dx, y: p.y + dy });
    return out;
  }
  const odd = p.y & 1;
  const diag = odd ? [0, 1] : [-1, 0];
  return [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    ...[-1, 1].flatMap((dy) => diag.map((dx) => ({ x: p.x + dx, y: p.y + dy }))),
  ];
}

/**
 * The facing that points from `from` towards `to`: one of the 8 square directions (components −1, 0, 1) or one of
 * the 6 hex directions (a unit vector on the plane). Null if the points coincide.
 */
export function facingVector(from: Pos, to: Pos, grid: Grid): Pos | null {
  const a = centre(from, grid);
  const b = centre(to, grid);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  if (!vx && !vy) return null;
  if (grid === 'square') return { x: Math.sign(vx), y: Math.sign(vy) };
  const step = Math.PI / 3;
  const ang = Math.round(Math.atan2(vy, vx) / step) * step;
  const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // + 0 turns −0 into 0
  return { x: r(Math.cos(ang)), y: r(Math.sin(ang)) };
}

/** "square"/"hex" with the right plural. */
export function cellWord(grid: Grid, n = 1): string {
  return `${grid === 'hex' ? 'hex' : 'square'}${n === 1 ? '' : grid === 'hex' ? 'es' : 's'}`;
}

/** The cell under a point on the plane (the inverse of `centre`). */
export function cellAt(pt: Pos, grid: Grid): Pos {
  if (grid === 'square') return { x: Math.round(pt.x), y: Math.round(pt.y) };
  // plane → axial (pointy-top, 1 cell wide): x = q + r/2, y = r·√3/2; then cube rounding.
  const r = pt.y / ROW_H;
  const q = pt.x - r / 2;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { x: rq + (rr - (rr & 1)) / 2, y: rr };
}

/**
 * The cells a straight line from the centre of `a` to the centre of `b` passes through, without the two end cells.
 * Two lines are traced, nudged a hair to either side, so a line running exactly along an edge or through a corner
 * gives both readings; the caller can be lenient and pick the clearer one.
 */
export function sightLines(a: Pos, b: Pos, grid: Grid): [Pos[], Pos[]] {
  const ca = centre(a, grid);
  const cb = centre(b, grid);
  const len = Math.hypot(cb.x - ca.x, cb.y - ca.y);
  if (len === 0) return [[], []];
  const nx = -(cb.y - ca.y) / len;
  const ny = (cb.x - ca.x) / len;
  const steps = Math.ceil(len * 6);
  const trace = (side: number): Pos[] => {
    const out: Pos[] = [];
    const seen = new Set<string>([`${a.x},${a.y}`, `${b.x},${b.y}`]);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = cellAt({ x: ca.x + (cb.x - ca.x) * t + nx * side * 1e-3, y: ca.y + (cb.y - ca.y) * t + ny * side * 1e-3 }, grid);
      const k = `${p.x},${p.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  };
  return [trace(1), trace(-1)];
}
