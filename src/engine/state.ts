import { createCombatant } from './character';
import type { Dice } from './dice';
import { faceTowards } from './facing';
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
export const SQUARE_M = 1.5;

export function createCombat(setups: CombatantSetup[], seed: number, rules: Partial<RulesConfig> = {}, dice?: Dice): Ctx {
  const merged: RulesConfig = { ...DEFAULT_RULES, ...rules };
  const width = FIELD_WIDTH;
  const height = FIELD_HEIGHT;
  const positions = placeFighters(setups);
  // Two fighters with the same name get numbers, so the log stays readable.
  const names = setups.map((s) => s.sheet.name);
  const combatants: Combatant[] = setups.map((s, n) => {
    const same = names.filter((x) => x === s.sheet.name).length;
    const nth = names.slice(0, n + 1).filter((x) => x === s.sheet.name).length;
    const sheet = same > 1 ? { ...s.sheet, name: `${s.sheet.name} ${nth}` } : s.sheet;
    const c = createCombatant(applyRuleOptions(sheet, merged), `c${n}`, s.team, s.controller, positions[n]);
    c.hidden = !!s.hidden && merged.flanking; // hiding only matters for attacks from behind
    return c;
  });
  // Everyone starts facing the nearest enemy.
  for (const c of combatants) {
    const foes = combatants.filter((o) => o.team !== c.team).sort((p, q) => squares(c.pos, p.pos) - squares(c.pos, q.pos));
    if (foes[0]) faceTowards(c, foes[0].pos);
  }
  const state: CombatState = {
    round: 0,
    opp: 0,
    width,
    height,
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
 * Starting squares: the given ones where valid and free, else the default line-up – side A in one column and
 * side B in another, 13 squares (about 20 m) apart, spreading out from the middle row.
 */
export function placeFighters(setups: { team: number; pos?: Pos }[]): Pos[] {
  const startX = Math.floor((FIELD_WIDTH - 1 - START_DISTANCE_SQUARES) / 2);
  const mid = Math.floor(FIELD_HEIGHT / 2);
  const taken = new Set<string>();
  const key = (p: Pos) => `${p.x},${p.y}`;
  const valid = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < FIELD_WIDTH && p.y < FIELD_HEIGHT && !taken.has(key(p));
  const out: (Pos | null)[] = setups.map((s) => {
    if (s.pos && valid(s.pos)) {
      taken.add(key(s.pos));
      return { ...s.pos };
    }
    return null;
  });
  setups.forEach((s, i) => {
    if (out[i]) return;
    const col = s.team === 0 ? startX : s.team === 1 ? startX + START_DISTANCE_SQUARES : mid;
    // Fill the column from the middle row outwards (5, 4, 6, 3, …), then the next column behind it.
    search: for (let j = 0; j < FIELD_WIDTH; j++) {
      const x = col + j * (s.team === 0 ? -1 : 1);
      for (let k = 0; k < FIELD_HEIGHT; k++) {
        const p = { x, y: mid + (k % 2 === 0 ? k / 2 : -(k + 1) / 2) };
        if (valid(p)) {
          taken.add(key(p));
          out[i] = p;
          break search;
        }
      }
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

/** Grid distance in squares (diagonal steps count as one). */
export function squares(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function metres(a: Pos, b: Pos): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * SQUARE_M * 10) / 10;
}

export function occupied(ctx: Ctx, p: Pos, except?: Combatant): boolean {
  return ctx.state.combatants.some((c) => c !== except && c.status === 'active' && c.pos.x === p.x && c.pos.y === p.y);
}

export function inBounds(ctx: Ctx, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < ctx.state.width && p.y < ctx.state.height;
}
