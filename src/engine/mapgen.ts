import { cellDistance, neighbours, type Grid } from './grid';
import { DEFAULT_LIGHT, MAP_SIZES, movementCosts, TERRAIN, type BattleMap, type MapPreset, type MapSpec, type TerrainKind } from './terrain';
import type { Pos } from './types';

/**
 * Random battlefields. Each preset builds a believable layout from the seed – the same spec and grid always give
 * the same map – and then makes sure both sides' starting areas are clear and joined by a walkable path.
 */
export function generateMap(spec: MapSpec, grid: Grid): BattleMap {
  const size = MAP_SIZES[spec.size];
  const b = new Builder(size.width, size.height, grid, spec.seed, spec.preset);
  BUILDERS[spec.preset](b);
  b.finish();
  b.m.light = spec.light ?? DEFAULT_LIGHT[spec.preset];
  return b.m;
}

type Rect = { x: number; y: number; w: number; h: number };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Builder {
  m: BattleMap;
  readonly r: () => number;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly grid: Grid,
    seed: number,
    readonly preset: MapPreset,
  ) {
    this.r = mulberry32(seed * 7919 + preset.length * 104729 + (grid === 'hex' ? 1 : 2));
    const margin = Math.max(3, Math.round(w * 0.12));
    const mid = Math.floor(h / 2);
    this.m = {
      preset,
      width: w,
      height: h,
      cells: new Array(w * h).fill('open'),
      deco: new Array(w * h).fill(''),
      starts: [
        { x: margin, y: mid },
        { x: w - 1 - margin, y: mid },
      ],
      light: 'day',
    };
  }

  int(a: number, b: number): number {
    return a + Math.floor(this.r() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  pick<T>(list: T[]): T {
    return list[Math.floor(this.r() * list.length)];
  }
  inside(p: Pos): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.w && p.y < this.h;
  }
  get(p: Pos): TerrainKind {
    return this.inside(p) ? this.m.cells[p.y * this.w + p.x] : 'wall';
  }
  set(p: Pos, kind: TerrainKind, deco = ''): void {
    if (!this.inside(p)) return;
    this.m.cells[p.y * this.w + p.x] = kind;
    this.m.deco[p.y * this.w + p.x] = deco;
  }
  all(): Pos[] {
    const out: Pos[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.push({ x, y });
    return out;
  }
  fill(kind: TerrainKind): void {
    for (const p of this.all()) this.set(p, kind);
  }
  rect(r: Rect, kind: TerrainKind, deco = ''): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.set({ x, y }, kind, deco);
  }
  rectCells(r: Rect): Pos[] {
    const out: Pos[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
    return out;
  }
  near(p: Pos, kind: TerrainKind): boolean {
    return neighbours(p, this.grid).some((n) => this.get(n) === kind);
  }
  nearStart(p: Pos, d: number): boolean {
    return this.m.starts.some((s) => cellDistance(s, p, this.grid) <= d);
  }
  randomCell(pad = 0): Pos {
    return { x: this.int(pad, this.w - 1 - pad), y: this.int(pad, this.h - 1 - pad) };
  }
  /** A random-walk clump of `n` cells of `kind` on open ground. */
  blob(start: Pos, n: number, kind: TerrainKind, deco = ''): Pos[] {
    const out: Pos[] = [];
    let p = start;
    for (let i = 0; i < n * 3 && out.length < n; i++) {
      if (this.get(p) === 'open' && !this.nearStart(p, 2)) {
        this.set(p, kind, deco);
        out.push(p);
      }
      const next = this.pick(neighbours(p, this.grid).filter((q) => this.inside(q)));
      if (next) p = next;
    }
    return out;
  }
  /** A straight run of cells, `dx`/`dy` per step. */
  line(from: Pos, dx: number, dy: number, n: number, kind: TerrainKind, deco = '', onlyOn: TerrainKind | null = 'open'): void {
    for (let i = 0; i < n; i++) {
      const p = { x: from.x + dx * i, y: from.y + dy * i };
      if (onlyOn === null || this.get(p) === onlyOn) this.set(p, kind, deco);
    }
  }
  clearAround(p: Pos, radius: number): void {
    for (const q of this.all()) if (cellDistance(p, q, this.grid) <= radius && TERRAIN[this.get(q)].blocksMove) this.set(q, 'open');
  }

  /** What a blocking cell turns into when a path must be forced through it. */
  carveAs(kind: TerrainKind): TerrainKind {
    if (kind === 'water') return 'shallow';
    if (kind === 'wall') return this.preset === 'inside' ? 'door' : this.preset === 'cave' ? 'rubble' : 'open';
    return 'open';
  }

  /** Make sure `b` can be walked to from `a`, breaking through as little as possible. */
  connect(a: Pos, b: Pos): void {
    const idx = (p: Pos) => p.y * this.w + p.x;
    const dist = new Array(this.w * this.h).fill(Infinity);
    const prev = new Array<number>(this.w * this.h).fill(-1);
    const buckets: Pos[][] = [[a]];
    dist[idx(a)] = 0;
    for (let c = 0; c < buckets.length; c++) {
      for (const cur of buckets[c] ?? []) {
        if (dist[idx(cur)] < c) continue;
        if (cur.x === b.x && cur.y === b.y) break;
        // On squares only straight steps: movement won't squeeze diagonally between two walls.
        for (const n of neighbours(cur, this.grid).filter((q) => this.grid === 'hex' || q.x === cur.x || q.y === cur.y)) {
          if (!this.inside(n)) continue;
          const t = TERRAIN[this.get(n)];
          // Never break through the outer edge of an enclosed map.
          const edge = n.x === 0 || n.y === 0 || n.x === this.w - 1 || n.y === this.h - 1;
          const step = t.blocksMove ? (edge && this.preset !== 'field' && this.preset !== 'forest' && this.preset !== 'town' ? 1000 : 15) : t.cost;
          const d = c + step;
          if (d >= dist[idx(n)]) continue;
          dist[idx(n)] = d;
          prev[idx(n)] = idx(cur);
          (buckets[d] ??= []).push(n);
        }
      }
    }
    for (let i = idx(b); i !== -1 && i !== idx(a); i = prev[i]) {
      const p = { x: i % this.w, y: Math.floor(i / this.w) };
      const k = this.get(p);
      if (TERRAIN[k].blocksMove) this.set(p, this.carveAs(k));
    }
  }

  /** Cells reachable on foot from `from`. */
  reachable(from: Pos): Set<number> {
    return new Set(
      movementCosts(this.m, this.grid, from, Infinity)
        .cells()
        .map(({ p }) => p.y * this.w + p.x),
    );
  }

  finish(): void {
    const [a, b] = this.m.starts;
    this.clearAround(a, 1);
    this.clearAround(b, 1);
    this.connect(a, b);
  }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const BUILDERS: Record<MapPreset, (b: Builder) => void> = { field, forest, town, inside, dungeon, cave };

function field(b: Builder): void {
  const area = b.w * b.h;
  for (let i = 0; i < Math.round(area / 70); i++) b.blob(b.randomCell(), b.int(2, 6), 'bush');
  for (let i = 0; i < Math.round(area / 120); i++) b.blob(b.randomCell(1), b.int(1, 3), 'tree');
  for (let i = 0; i < Math.round(area / 170); i++) b.blob(b.randomCell(1), b.int(1, 2), 'rock');
  // An old field fence or a dry-stone wall with a gap in it.
  if (b.chance(0.6)) {
    const vertical = b.chance(0.5);
    const n = b.int(5, 9);
    const start = vertical ? { x: b.int(Math.floor(b.w * 0.3), Math.floor(b.w * 0.7)), y: b.int(0, b.h - n) } : { x: b.int(2, b.w - n - 2), y: b.int(2, b.h - 3) };
    const gap = b.int(1, n - 2);
    for (let i = 0; i < n; i++) {
      if (i === gap) continue;
      const p = vertical ? { x: start.x, y: start.y + i } : { x: start.x + i, y: start.y };
      if (b.get(p) === 'open' && !b.nearStart(p, 2)) b.set(p, 'low', 'fence');
    }
  }
}

function forest(b: Builder): void {
  for (const p of b.all()) if (b.chance(0.17)) b.set(p, 'tree');
  // A clearing in the middle.
  if (b.chance(0.6)) {
    const cx = b.w / 2 + b.int(-3, 3);
    const cy = b.h / 2 + b.int(-2, 2);
    const rx = b.w * 0.14;
    const ry = b.h * 0.22;
    for (const p of b.all()) if (((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1) b.set(p, 'open');
  }
  for (const p of b.all()) {
    if (b.get(p) !== 'open') continue;
    if (b.chance(b.near(p, 'tree') ? 0.18 : 0.07)) b.set(p, 'bush');
    else if (b.chance(0.012)) b.set(p, 'rock');
  }
  // A stream running across, with a ford or two.
  if (b.chance(0.5)) {
    let x = b.int(Math.floor(b.w * 0.35), Math.floor(b.w * 0.65));
    const fords = new Set([b.int(1, b.h - 2), b.int(1, b.h - 2)]);
    for (let y = 0; y < b.h; y++) {
      const shallow = fords.has(y) || fords.has(y - 1);
      for (const dx of [0, 1]) b.set({ x: x + dx, y }, shallow || b.chance(0.08) ? 'shallow' : 'water');
      x = Math.max(2, Math.min(b.w - 4, x + b.int(-1, 1)));
    }
  }
}

function town(b: Builder): void {
  const cx = b.w / 2;
  const cy = b.h / 2;
  const rx = b.w * 0.24;
  const ry = b.h * 0.27;
  const inPlaza = (p: Pos) => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1;
  const target = Math.round((b.w * b.h) / 40);
  let houses = 0;
  for (let i = 0; i < 400 && houses < target; i++) {
    const r = { x: b.int(-1, b.w - 3), y: b.int(-1, b.h - 2), w: b.int(3, 6), h: b.int(2, 4) };
    const halo = { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 };
    const cells = b.rectCells(halo);
    if (cells.some((p) => b.inside(p) && (b.get(p) !== 'open' || inPlaza(p) || b.nearStart(p, 2)))) continue;
    b.rect(r, 'house');
    houses++;
  }
  // A well in the middle of the square.
  const well = { x: Math.floor(cx), y: Math.floor(cy) };
  b.set(well, 'water', 'well');
  // Market stalls and a cart.
  const freeSpot = (len: number, pad: number): Pos | null => {
    for (let i = 0; i < 60; i++) {
      const p = { x: b.int(1, b.w - len - 1), y: b.int(1, b.h - 2) };
      const run = Array.from({ length: len }, (_, k) => ({ x: p.x + k, y: p.y }));
      if (run.every((q) => b.get(q) === 'open' && !b.nearStart(q, 2) && cellDistance(q, well, b.grid) > pad && neighbours(q, b.grid).every((n) => b.get(n) !== 'house')))
        return p;
    }
    return null;
  };
  for (let i = 0; i < b.int(2, 4); i++) {
    const p = freeSpot(2, 1);
    if (p) b.line(p, 1, 0, 2, 'low', 'stall');
  }
  const cart = freeSpot(2, 2);
  if (cart) b.line(cart, 1, 0, 2, 'low', 'cart');
  // Crates and barrels stacked against the houses.
  for (const p of b.all()) if (b.get(p) === 'open' && b.near(p, 'house') && !b.nearStart(p, 2) && b.chance(0.07)) b.set(p, 'low', b.chance(0.5) ? 'crate' : 'barrel');
  // A couple of trees and a hedge or two.
  for (let i = 0; i < b.int(1, 3); i++) {
    const p = b.randomCell(1);
    if (b.get(p) === 'open' && !b.near(p, 'house') && cellDistance(p, well, b.grid) > 2 && !b.nearStart(p, 2)) b.set(p, 'tree');
  }
  for (let i = 0; i < b.int(1, 3); i++) b.blob(b.randomCell(1), b.int(2, 4), 'bush');
}

function inside(b: Builder): void {
  b.rect({ x: 0, y: 0, w: b.w, h: 1 }, 'wall');
  b.rect({ x: 0, y: b.h - 1, w: b.w, h: 1 }, 'wall');
  b.rect({ x: 0, y: 0, w: 1, h: b.h }, 'wall');
  b.rect({ x: b.w - 1, y: 0, w: 1, h: b.h }, 'wall');
  const rooms: Rect[] = [];
  const split = (r: Rect, depth: number) => {
    const canV = r.w >= 9;
    const canH = r.h >= 7;
    const want = depth < 2 || b.chance(0.7);
    if (!want || (!canV && !canH) || (r.w < 12 && r.h < 9 && b.chance(0.4))) {
      rooms.push(r);
      return;
    }
    const vertical = canV && (!canH || r.w / r.h > 1.4 || b.chance(0.5));
    if (vertical) {
      const x = r.x + b.int(4, r.w - 5);
      b.line({ x, y: r.y }, 0, 1, r.h, 'wall', '', null);
      for (let i = 0; i < (r.h > 7 ? 2 : 1); i++) b.set({ x, y: r.y + b.int(1, r.h - 2) }, 'door');
      split({ x: r.x, y: r.y, w: x - r.x, h: r.h }, depth + 1);
      split({ x: x + 1, y: r.y, w: r.x + r.w - x - 1, h: r.h }, depth + 1);
    } else {
      const y = r.y + b.int(3, r.h - 4);
      b.line({ x: r.x, y }, 1, 0, r.w, 'wall', '', null);
      for (let i = 0; i < (r.w > 10 ? 2 : 1); i++) b.set({ x: r.x + b.int(1, r.w - 2), y }, 'door');
      split({ x: r.x, y: r.y, w: r.w, h: y - r.y }, depth + 1);
      split({ x: r.x, y: y + 1, w: r.w, h: r.y + r.h - y - 1 }, depth + 1);
    }
  };
  split({ x: 1, y: 1, w: b.w - 2, h: b.h - 2 }, 0);
  const clearOfDoors = (p: Pos) => b.get(p) === 'open' && !b.near(p, 'door') && !b.nearStart(p, 1);
  let hearth = false;
  for (const r of rooms) {
    const inner = b.rectCells({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 });
    const area = r.w * r.h;
    // Long tables (two cells) in the bigger rooms.
    for (let i = 0; i < Math.floor(area / 18); i++) {
      const p = inner.length ? b.pick(inner) : null;
      if (p && clearOfDoors(p) && clearOfDoors({ x: p.x + 1, y: p.y }) && inner.some((q) => q.x === p.x + 1 && q.y === p.y)) b.line(p, 1, 0, 2, 'low', 'table');
    }
    // Pillars holding up a great hall.
    if (r.w >= 8 && r.h >= 6) {
      for (const p of [
        { x: r.x + 2, y: r.y + 1 },
        { x: r.x + r.w - 3, y: r.y + 1 },
        { x: r.x + 2, y: r.y + r.h - 2 },
        { x: r.x + r.w - 3, y: r.y + r.h - 2 },
      ])
        if (clearOfDoors(p)) b.set(p, 'pillar');
    }
    // Barrels and crates in the corners.
    for (const p of [
      { x: r.x, y: r.y },
      { x: r.x + r.w - 1, y: r.y },
      { x: r.x, y: r.y + r.h - 1 },
      { x: r.x + r.w - 1, y: r.y + r.h - 1 },
    ])
      if (clearOfDoors(p) && b.chance(0.35)) b.set(p, 'low', b.chance(0.5) ? 'barrel' : 'crate');
    // One hearth against a wall.
    if (!hearth && area >= 20) {
      const p = { x: r.x + Math.floor(r.w / 2), y: r.y };
      if (b.get({ x: p.x, y: p.y - 1 }) === 'wall' && clearOfDoors(p)) {
        b.set(p, 'wall', 'hearth');
        hearth = true;
      }
    }
  }
  // Every room can be reached.
  for (const r of rooms) b.connect(b.m.starts[0], { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
}

function dungeon(b: Builder): void {
  b.fill('wall');
  const rooms: Rect[] = [];
  const fits = (r: Rect) =>
    r.x >= 1 && r.y >= 1 && r.x + r.w <= b.w - 1 && r.y + r.h <= b.h - 1 && rooms.every((o) => r.x > o.x + o.w || o.x > r.x + r.w || r.y > o.y + o.h || o.y > r.y + r.h);
  const clamp = (r: Rect): Rect => ({ ...r, x: Math.max(1, Math.min(b.w - 1 - r.w, r.x)), y: Math.max(1, Math.min(b.h - 1 - r.h, r.y)) });
  // A room around each side's starting point, then as many others as fit.
  for (const s of b.m.starts) {
    const w = b.int(5, 7);
    const h = b.int(4, 6);
    rooms.push(clamp({ x: s.x - Math.floor(w / 2), y: s.y - Math.floor(h / 2), w, h }));
  }
  for (let i = 0; i < 200 && rooms.length < Math.round((b.w * b.h) / 70); i++) {
    const r = { x: b.int(1, b.w - 6), y: b.int(1, b.h - 5), w: b.int(4, 8), h: b.int(3, 6) };
    if (fits(r)) rooms.push(r);
  }
  for (const r of rooms) b.rect(r, 'open');
  const inRoom = (p: Pos) => rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  const mid = (r: Rect): Pos => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
  const corridor = (a: Pos, c: Pos) => {
    const path: Pos[] = [];
    const horizontalFirst = b.chance(0.5);
    let p = { ...a };
    const stepX = () => {
      while (p.x !== c.x) {
        p = { x: p.x + Math.sign(c.x - p.x), y: p.y };
        path.push(p);
      }
    };
    const stepY = () => {
      while (p.y !== c.y) {
        p = { x: p.x, y: p.y + Math.sign(c.y - p.y) };
        path.push(p);
      }
    };
    if (horizontalFirst) {
      stepX();
      stepY();
    } else {
      stepY();
      stepX();
    }
    const wide = b.chance(0.25);
    path.forEach((q, i) => {
      if (inRoom(q)) return;
      const wasWall = b.get(q) === 'wall';
      // A door where the corridor meets a room.
      const atRoom = (path[i - 1] && inRoom(path[i - 1])) || (path[i + 1] && inRoom(path[i + 1]));
      if (wasWall) b.set(q, atRoom && b.chance(0.55) ? 'door' : 'open');
      if (wide && !atRoom && b.get({ x: q.x, y: q.y + 1 }) === 'wall' && q.y + 1 < b.h - 1) b.set({ x: q.x, y: q.y + 1 }, 'open');
    });
  };
  const sorted = [...rooms].sort((p, q) => p.x - q.x);
  for (let i = 1; i < sorted.length; i++) corridor(mid(sorted[i - 1]), mid(sorted[i]));
  if (sorted.length > 3) corridor(mid(b.pick(sorted)), mid(b.pick(sorted)));
  // Pillars in the big rooms, rubble and the odd crate or sarcophagus.
  for (const r of rooms) {
    if (r.w >= 6 && r.h >= 5 && b.chance(0.7))
      for (const p of [
        { x: r.x + 1, y: r.y + 1 },
        { x: r.x + r.w - 2, y: r.y + 1 },
        { x: r.x + 1, y: r.y + r.h - 2 },
        { x: r.x + r.w - 2, y: r.y + r.h - 2 },
      ])
        if (!b.near(p, 'door') && !b.nearStart(p, 1)) b.set(p, 'pillar');
    if (b.chance(0.3)) {
      const p = mid(r);
      if (!b.nearStart(p, 2)) b.set(p, 'low', 'sarcophagus');
    }
  }
  for (const p of b.all()) {
    if (b.get(p) !== 'open' || b.nearStart(p, 1)) continue;
    if (b.chance(0.05)) b.set(p, 'rubble');
    else if (inRoom(p) && b.near(p, 'wall') && !b.near(p, 'door') && b.chance(0.04)) b.set(p, 'low', b.chance(0.5) ? 'crate' : 'barrel');
  }
}

function cave(b: Builder): void {
  const edge = (p: Pos) => p.x === 0 || p.y === 0 || p.x === b.w - 1 || p.y === b.h - 1;
  for (const p of b.all()) b.set(p, edge(p) || b.chance(0.45) ? 'wall' : 'open');
  const threshold = b.grid === 'hex' ? 4 : 5;
  for (let i = 0; i < 4; i++) {
    const next = b.all().map((p) => {
      if (edge(p)) return 'wall' as TerrainKind;
      const walls = neighbours(p, b.grid).filter((n) => b.get(n) === 'wall').length;
      return walls >= threshold ? 'wall' : walls <= 1 ? 'open' : b.get(p) === 'wall' && walls >= threshold - 1 ? 'wall' : ('open' as TerrainKind);
    });
    next.forEach((k, j) => b.set({ x: j % b.w, y: Math.floor(j / b.w) }, k));
  }
  const [s0, s1] = b.m.starts;
  b.clearAround(s0, 2);
  b.clearAround(s1, 2);
  b.connect(s0, s1);
  // Pockets that can't be reached become rock.
  const main = b.reachable(s0);
  for (const p of b.all()) if (b.get(p) === 'open' && !main.has(p.y * b.w + p.x)) b.set(p, 'wall');
  // Underground pools with shallow edges, stalagmites and fallen rock.
  for (let i = 0; i < b.int(1, 2); i++) {
    const pool = b.blob(b.randomCell(2), b.int(3, 7), 'water');
    for (const p of pool) for (const n of neighbours(p, b.grid)) if (b.get(n) === 'open' && b.chance(0.7)) b.set(n, 'shallow');
  }
  for (const p of b.all()) {
    if (b.get(p) !== 'open' || b.nearStart(p, 2)) continue;
    if (b.chance(0.035)) b.set(p, 'rock');
    else if (b.chance(0.06)) b.set(p, 'rubble');
  }
}
