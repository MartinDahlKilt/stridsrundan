import { createCombatant } from './character';
import type { Dice } from './dice';
import { faceTowards } from './facing';
import { CELL_M, cellDistance, cellMetres, type Grid } from './grid';
import { canSee, emptyMap, movementCosts, walkable, type BattleMap } from './terrain';
import { seededDice } from './dice';
import { applyRuleOptions, DEFAULT_RULES, type RulesConfig } from './rules';
import type { CharacterSheet, Combatant, CombatState, LogEntry, Pos } from './types';

export interface Ctx {
  state: CombatState;
  dice: Dice;
  rules: RulesConfig;
}

export interface CombatantSetup {
  sheet: CharacterSheet;
  team: number;
  controller: 'human' | 'ai';
  /** Starting square; fighters without one get the default line-up. */
  pos?: Pos;
  /** Starts the fight hidden from the enemy, so it can steal up behind someone (combat-rules §7.5). */
  hidden?: boolean;
}

export const FIELD_WIDTH = 21;
export const FIELD_HEIGHT = 11;

/** Squares between the two sides at the start: 13 squares × 1.5 m ≈ 20 m. */
export const START_DISTANCE_SQUARES = 13;
export const SQUARE_M = CELL_M;

/** `map`: the battlefield (see mapgen.ts); without one, the bare 21 × 11 field. */
export function createCombat(setups: CombatantSetup[], seed: number, rules: Partial<RulesConfig> = {}, dice?: Dice, map?: BattleMap): Ctx {
  const merged: RulesConfig = { ...DEFAULT_RULES, ...rules };
  const field = map ?? emptyMap(FIELD_WIDTH, FIELD_HEIGHT, START_DISTANCE_SQUARES);
  const width = field.width;
  const height = field.height;
  const positions = placeFighters(setups, field, merged.grid);
  // Two fighters with the same name get numbers, so the log stays readable.
  const names = setups.map((s) => s.sheet.name);
  const combatants: Combatant[] = setups.map((s, n) => {
    const same = names.filter((x) => x === s.sheet.name).length;
    const nth = names.slice(0, n + 1).filter((x) => x === s.sheet.name).length;
    const sheet = same > 1 ? { ...s.sheet, name: `${s.sheet.name} ${nth}` } : s.sheet;
    const c = createCombatant(applyRuleOptions(sheet, merged), `c${n}`, s.team, s.controller, positions[n]);
    c.hidden = !!s.hidden;
    return c;
  });
  // Everyone starts facing the nearest enemy.
  for (const c of combatants) {
    const foes = combatants.filter((o) => o.team !== c.team).sort((p, q) => squares(c.pos, p.pos, merged.grid) - squares(c.pos, q.pos, merged.grid));
    if (foes[0]) faceTowards(c, foes[0].pos, merged.grid);
  }
  const state: CombatState = {
    round: 0,
    opp: 0,
    width,
    height,
    grid: merged.grid,
    map: field,
    combatants,
    log: [],
    nextLogId: 1,
    over: false,
    winner: null,
    seed,
    engaged: [],
    bloodDrawn: false,
    rolls: [],
  };
  return { state, dice: recordingDice(dice ?? seededDice(seed), state), rules: merged };
}

/**
 * Starting cells: the given ones where valid (on the board, walkable) and free, else the default line-up – each side
 * in a column at its starting point (13 cells, about 20 m, apart on the bare field), filling from the middle row
 * outwards and then the column behind. Only cells a few steps' walk from the starting point count, so a side
 * doesn't end up split across a wall.
 */
export function placeFighters(setups: { team: number; pos?: Pos }[], map: BattleMap = emptyMap(FIELD_WIDTH, FIELD_HEIGHT, START_DISTANCE_SQUARES), grid: Grid = 'hex'): Pos[] {
  const taken = new Set<string>();
  const key = (p: Pos) => `${p.x},${p.y}`;
  const valid = (p: Pos) => walkable(map, p) && !taken.has(key(p));
  const out: (Pos | null)[] = setups.map((s) => {
    if (s.pos && valid(s.pos)) {
      taken.add(key(s.pos));
      return { ...s.pos };
    }
    return null;
  });
  const centre = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const lineUp = new Map<number, Pos[]>();
  const candidates = (team: number): Pos[] => {
    if (lineUp.has(team)) return lineUp.get(team)!;
    const anchor = team === 0 || team === 1 ? map.starts[team] : centre;
    const back = team === 0 ? -1 : 1;
    const rowRank = (y: number) => (y === anchor.y ? 0 : y < anchor.y ? 2 * (anchor.y - y) - 1 : 2 * (y - anchor.y));
    const colRank = (x: number) => ((x - anchor.x) * back >= 0 ? (x - anchor.x) * back : 1000 - (x - anchor.x) * back);
    const reach = movementCosts(map, grid, anchor, 1000).cells();
    const near = reach.filter((r) => r.cost <= 6).map((r) => r.p);
    const far = reach.filter((r) => r.cost > 6).sort((p, q) => p.cost - q.cost).map((r) => r.p);
    near.sort((p, q) => colRank(p.x) - colRank(q.x) || rowRank(p.y) - rowRank(q.y));
    const list = walkable(map, anchor) ? [...near, ...far] : [];
    lineUp.set(team, list);
    return list;
  };
  setups.forEach((s, i) => {
    if (out[i]) return;
    const p = candidates(s.team).find(valid);
    if (p) {
      taken.add(key(p));
      out[i] = { ...p };
    }
  });
  return out.map((p) => p ?? { x: 0, y: 0 });
}

/** Wraps the dice so every roll is also stored in the state (shown in the dice tray). */
function recordingDice(inner: Dice, state: CombatState): Dice {
  let id = 1;
  return {
    d(sides) {
      const value = inner.d(sides);
      state.rolls.push({ id: id++, sides, value, logId: state.nextLogId, round: state.round });
      return value;
    },
  };
}

export function log(ctx: Ctx, text: string, tone: LogEntry['tone'] = 'info', depth: LogEntry['depth'] = 1, actorId?: string): void {
  const s = ctx.state;
  s.log.push({ id: s.nextLogId++, round: s.round, opp: s.opp, depth, tone, text, actorId });
}

export function byId(ctx: Ctx, id: string): Combatant {
  const c = ctx.state.combatants.find((x) => x.id === id);
  if (!c) throw new Error(`No combatant ${id}`);
  return c;
}

export const active = (c: Combatant) => c.status === 'active';

export function enemiesOf(ctx: Ctx, c: Combatant): Combatant[] {
  return ctx.state.combatants.filter((o) => o.team !== c.team && active(o));
}

export function alliesOf(ctx: Ctx, c: Combatant): Combatant[] {
  return ctx.state.combatants.filter((o) => o.team === c.team && o.id !== c.id && active(o));
}

/** Grid distance in steps (squares: diagonal steps count as one; hexes: every step is the same length). */
export function squares(a: Pos, b: Pos, grid: Grid): number {
  return cellDistance(a, b, grid);
}

export function metres(a: Pos, b: Pos, grid: Grid): number {
  return cellMetres(a, b, grid);
}

export function occupied(ctx: Ctx, p: Pos, except?: Combatant): boolean {
  return ctx.state.combatants.some((c) => c !== except && c.status === 'active' && c.pos.x === p.x && c.pos.y === p.y);
}

export function inBounds(ctx: Ctx, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < ctx.state.width && p.y < ctx.state.height;
}

/** Is `h` hidden from `observer`? Hidden, and not found by that observer since it last hid. */
export function hiddenFrom(h: Combatant, observer: Combatant): boolean {
  return h.hidden && !h.spottedBy.includes(observer.id);
}

/** Enemies `c` knows about: ones hidden from it can't be targeted, approached or shot at. */
export function visibleEnemiesOf(ctx: Ctx, c: Combatant): Combatant[] {
  return enemiesOf(ctx, c).filter((e) => !hiddenFrom(e, c));
}

/** Whoever has lost sight of a hidden fighter loses track of it (it is hidden from them again). */
export function updateAwareness(ctx: Ctx): void {
  const { map, grid, combatants } = ctx.state;
  for (const h of combatants) {
    if (!h.hidden || !h.spottedBy.length) continue;
    h.spottedBy = h.spottedBy.filter((id) => {
      const o = combatants.find((x) => x.id === id);
      return !!o && o.status === 'active' && canSee(map, grid, o.pos, h.pos);
    });
  }
}
