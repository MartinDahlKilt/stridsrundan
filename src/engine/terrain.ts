import { CELL_M, cellAt, cellDistance, centre, neighbours, sightLines, type Grid } from './grid';
import type { Pos } from './types';

/**
 * Terrain on the battlefield (house rules – the books leave cover and line of sight to the game master).
 *
 * - Walls, houses, tree trunks, boulders and pillars block both movement and sight.
 * - Deep water blocks movement but not sight.
 * - Low obstacles (crates, barrels, tables, market stalls, fences) can't be walked through. With the house rule
 *   `terrainCover` they also give *cover*: a target right behind one, seen from the shooter, has its legs covered
 *   (shots there strike the obstacle) and is −3 CL to hit with ranged attacks.
 * - Bushes cost 2 movement, give +2 to Gömma sig, and with `terrainCover` −3 CL to shoot at someone in or behind them.
 * - Anything solid or low next to a fighter is something to duck behind when taking cover (Att söka skydd).
 * - Rubble and shallow water cost 2 movement. Doorways are open floor.
 */
export type TerrainKind = 'open' | 'wall' | 'house' | 'tree' | 'rock' | 'pillar' | 'water' | 'low' | 'bush' | 'rubble' | 'shallow' | 'door';

export interface TerrainInfo {
  name: string;
  blocksMove: boolean;
  blocksSight: boolean;
  /** Movement cost to enter. */
  cost: number;
  /** Low cover for whoever stands right behind it. */
  cover: boolean;
  /** Hides whoever stands in it (and makes shots through it harder). */
  conceal: boolean;
}

const T = (name: string, blocksMove: boolean, blocksSight: boolean, cost = 1, cover = false, conceal = false): TerrainInfo => ({
  name,
  blocksMove,
  blocksSight,
  cost,
  cover,
  conceal,
});

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  open: T('open ground', false, false),
  wall: T('wall', true, true),
  house: T('house', true, true),
  tree: T('tree', true, true),
  rock: T('boulder', true, true),
  pillar: T('pillar', true, true),
  water: T('deep water', true, false),
  low: T('low obstacle', true, false, 1, true),
  bush: T('bushes', false, false, 2, false, true),
  rubble: T('rubble', false, false, 2),
  shallow: T('shallow water', false, false, 2),
  door: T('doorway', false, false),
};

export const COVER_CL = -3;
export const CONCEAL_CL = -3;
/** Gömma sig in bushes: the game master's terrain modifier (I 2254 leaves it to the GM). */
export const HIDE_IN_BUSHES = 2;

export type MapPreset = 'field' | 'forest' | 'town' | 'inside' | 'dungeon' | 'cave';
export type MapSize = 'small' | 'medium' | 'large';

export const MAP_PRESETS: { id: MapPreset; name: string; description: string }[] = [
  { id: 'field', name: 'Open field', description: 'Grassland with a few bushes, boulders and lone trees.' },
  { id: 'forest', name: 'Forest', description: 'Dense trees and undergrowth, maybe a stream with a ford.' },
  { id: 'town', name: 'Town square', description: 'A cobbled square ringed by houses and alleys, with a well, market stalls and crates.' },
  { id: 'inside', name: 'Inside (hall)', description: 'A large building split into rooms by walls and doors, with tables and pillars.' },
  { id: 'dungeon', name: 'Dungeon', description: 'Rooms hewn out of the rock, joined by narrow corridors and doors.' },
  { id: 'cave', name: 'Cave', description: 'Winding caverns with stalagmites, rubble and underground pools.' },
];

export const MAP_SIZES: Record<MapSize, { name: string; width: number; height: number }> = {
  small: { name: 'Small (21 × 11)', width: 21, height: 11 },
  medium: { name: 'Medium (31 × 19)', width: 31, height: 19 },
  large: { name: 'Large (41 × 25)', width: 41, height: 25 },
};

/** Light (II 1343): daylight; dusk, moonlight or torchlight (−5 to attacks); darkness (−15). */
export type Light = 'day' | 'dim' | 'dark';

export const LIGHTS: Record<Light, { name: string; attack: number; hide: number }> = {
  day: { name: 'Daylight', attack: 0, hide: 0 },
  dim: { name: 'Dusk / torchlight', attack: -5, hide: 2 },
  dark: { name: 'Darkness', attack: -15, hide: 5 },
};

/** The usual light for a setting: torches indoors and underground. */
export const DEFAULT_LIGHT: Record<MapPreset, Light> = { field: 'day', forest: 'day', town: 'day', inside: 'dim', dungeon: 'dim', cave: 'dim' };

export interface MapSpec {
  preset: MapPreset;
  size: MapSize;
  seed: number;
  /** Default: the usual light for the setting. */
  light?: Light;
}

export const DEFAULT_MAP_SPEC: Omit<MapSpec, 'seed'> = { preset: 'field', size: 'medium' };

export interface BattleMap {
  /** null: the bare legacy field (no terrain). */
  preset: MapPreset | null;
  width: number;
  height: number;
  /** Row-major: index = y·width + x. */
  cells: TerrainKind[];
  /** What a cell looks like ('crate', 'barrel', 'table', 'stall', 'fence', 'well', 'hearth' …); '' = plain. */
  deco: string[];
  /** Where each side lines up by default. */
  starts: [Pos, Pos];
  light: Light;
}

/** A field with nothing on it (the original 21 × 11 battlefield, sides 13 cells apart). */
export function emptyMap(width = 21, height = 11, gap = 13): BattleMap {
  const x0 = Math.floor((width - 1 - gap) / 2);
  const mid = Math.floor(height / 2);
  return {
    preset: null,
    width,
    height,
    cells: new Array(width * height).fill('open'),
    deco: new Array(width * height).fill(''),
    starts: [
      { x: x0, y: mid },
      { x: x0 + gap, y: mid },
    ],
    light: 'day',
  };
}

export const inMap = (m: BattleMap, p: Pos) => p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
export const terrainAt = (m: BattleMap, p: Pos): TerrainKind => (inMap(m, p) ? m.cells[p.y * m.width + p.x] : 'wall');
export const terrainInfo = (m: BattleMap, p: Pos): TerrainInfo => TERRAIN[terrainAt(m, p)];
export const decoAt = (m: BattleMap, p: Pos): string => (inMap(m, p) ? m.deco[p.y * m.width + p.x] : '');
export const walkable = (m: BattleMap, p: Pos) => inMap(m, p) && !terrainInfo(m, p).blocksMove;
export const concealed = (m: BattleMap, p: Pos) => terrainInfo(m, p).conceal;

// ---------------------------------------------------------------------------
// Line of sight and cover
// ---------------------------------------------------------------------------

export interface Sight {
  /** A wall, house, tree, boulder or pillar is in the way. */
  blocked: boolean;
  /** The target is right behind a low obstacle (seen from the shooter): its legs are covered. */
  cover: string | null;
  /** The target is in bushes, or the line runs through some. */
  concealed: boolean;
}

/**
 * What lies between `from` and `to`. Obstacles right next to the one looking are ignored – you lean past
 * the crate you crouch behind – and when the line grazes a corner the clearer of the two readings counts.
 */
export function sight(m: BattleMap, grid: Grid, from: Pos, to: Pos): Sight {
  const read = (cells: Pos[]): Sight & { score: number } => {
    let blocked = false;
    let cover: string | null = null;
    let conceal = concealed(m, to);
    for (const p of cells) {
      const t = terrainInfo(m, p);
      if (t.blocksSight) blocked = true;
      const nearShooter = cellDistance(p, from, grid) <= 1;
      if (t.cover && !nearShooter && cellDistance(p, to, grid) <= 1) cover = decoAt(m, p) || 'obstacle';
      if (t.conceal && !nearShooter) conceal = true;
    }
    return { blocked, cover, concealed: conceal, score: (blocked ? 100 : 0) + (cover ? 10 : 0) + (conceal ? 1 : 0) };
  };
  const [a, b] = sightLines(from, to, grid).map(read);
  const best = a.score <= b.score ? a : b;
  return { blocked: best.blocked, cover: best.cover, concealed: best.concealed };
}

export const canSee = (m: BattleMap, grid: Grid, from: Pos, to: Pos) => !sight(m, grid, from, to).blocked;

/** The cells a missile flies through from `from` to `to` (the clearer of the two traced lines, ends excluded). */
export function lineOfFire(m: BattleMap, grid: Grid, from: Pos, to: Pos): Pos[] {
  const [a, b] = sightLines(from, to, grid);
  const blocked = (cells: Pos[]) => cells.some((p) => terrainInfo(m, p).blocksSight);
  return blocked(a) && !blocked(b) ? b : a;
}

/**
 * Where a missile that missed goes on (III 2624): straight on, 50% further than the target was, but no further than
 * the weapon's range, until something solid stops it. Returns the cells past the target, nearest first.
 */
export function missilePath(m: BattleMap, grid: Grid, from: Pos, target: Pos, maxRangeM: number): Pos[] {
  const a = centre(from, grid);
  const t = centre(target, grid);
  const dist = Math.hypot(t.x - a.x, t.y - a.y);
  if (!dist) return [];
  const reach = Math.min(dist * 1.5, maxRangeM / CELL_M);
  if (reach <= dist) return [];
  const end = cellAt({ x: a.x + ((t.x - a.x) / dist) * reach, y: a.y + ((t.y - a.y) / dist) * reach }, grid);
  const out: Pos[] = [];
  const cells = [...lineOfFire(m, grid, from, end), end];
  const past = cells.filter((p) => {
    const c = centre(p, grid);
    return Math.hypot(c.x - a.x, c.y - a.y) > dist + 0.01;
  });
  for (const p of past) {
    if (!inMap(m, p) || terrainInfo(m, p).blocksSight) break;
    out.push(p);
  }
  return out;
}

/** Something next to `p` to duck behind when taking cover (Att söka skydd: a tree, a stone, a corner, a table). */
export function coverNear(m: BattleMap, grid: Grid, p: Pos): string | null {
  for (const n of neighbours(p, grid)) {
    if (!inMap(m, n)) continue;
    const kind = terrainAt(m, n);
    const t = TERRAIN[kind];
    if (t.blocksSight || t.cover) return decoAt(m, n) || t.name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/** Movement costs from one cell, as computed by `movementCosts`. */
export interface CostField {
  /** Cost to walk to `p` (Infinity if out of reach). */
  cost(p: Pos): number;
  /** Every reached cell with its cost (the start included, at 0). */
  cells(): { p: Pos; cost: number }[];
}

const HEX_EVEN = [
  [1, 0],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [-1, 1],
  [0, 1],
];
const HEX_ODD = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [1, -1],
  [0, 1],
  [1, 1],
];
const SQUARE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Movement cost from `from` to every cell reachable within `max` (Dijkstra with a bucket queue over terrain
 * costs). `blocked` marks cells that can't be entered or passed (enemies). On squares a diagonal step may not
 * squeeze between two blocked cells.
 */
export function movementCosts(m: BattleMap, grid: Grid, from: Pos, max: number, blocked: (p: Pos) => boolean = () => false): CostField {
  const w = m.width;
  const h = m.height;
  const n = w * h;
  const dist = new Float64Array(n).fill(Infinity);
  // Per-cell step cost, Infinity where it can't be entered.
  const step = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = TERRAIN[m.cells[i]];
    step[i] = t.blocksMove || blocked({ x: i % w, y: (i / w) | 0 }) ? Infinity : t.cost;
  }
  const start = from.y * w + from.x;
  const reached: number[] = [];
  if (inMap(m, from)) {
    dist[start] = 0;
    const buckets: number[][] = [[start]];
    for (let c = 0; c < buckets.length; c++) {
      const bucket = buckets[c];
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const cur = bucket[b];
        if (dist[cur] < c) continue;
        reached.push(cur);
        const cx = cur % w;
        const cy = (cur / w) | 0;
        const dirs = grid === 'square' ? SQUARE : cy & 1 ? HEX_ODD : HEX_EVEN;
        for (const [dx, dy] of dirs) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          const sc = step[i];
          if (sc === Infinity) continue;
          if (grid === 'square' && dx && dy && step[cy * w + x] === Infinity && step[y * w + cx] === Infinity) continue;
          const d = c + sc;
          if (d > max || d >= dist[i]) continue;
          dist[i] = d;
          (buckets[d] ??= []).push(i);
        }
      }
    }
  }
  return {
    cost: (p) => (inMap(m, p) ? dist[p.y * w + p.x] : Infinity),
    cells: () => reached.map((i) => ({ p: { x: i % w, y: (i / w) | 0 }, cost: dist[i] })),
  };
}

/** Movement cost from `from` to `to` (Infinity if it can't be reached within `max`). */
export function pathCost(m: BattleMap, grid: Grid, from: Pos, to: Pos, max = Infinity, blocked?: (p: Pos) => boolean): number {
  return movementCosts(m, grid, from, max, blocked).cost(to);
}
