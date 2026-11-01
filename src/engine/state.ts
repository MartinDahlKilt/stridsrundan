import { createCombatant } from './character';
import type { Dice } from './dice';
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
}

/** Squares between the two sides at the start: 13 squares × 1.5 m ≈ 20 m. */
export const START_DISTANCE_SQUARES = 13;
export const SQUARE_M = 1.5;

export function createCombat(setups: CombatantSetup[], seed: number, rules: Partial<RulesConfig> = {}, dice?: Dice): Ctx {
  const merged: RulesConfig = { ...DEFAULT_RULES, ...rules };
  const width = 21;
  const height = 11;
  const byTeam = new Map<number, CombatantSetup[]>();
  for (const s of setups) byTeam.set(s.team, [...(byTeam.get(s.team) ?? []), s]);
  const startX = Math.floor((width - 1 - START_DISTANCE_SQUARES) / 2);
  const combatants: Combatant[] = [];
  let n = 0;
  for (const [team, list] of byTeam) {
    list.forEach((s, i) => {
      const x = team === 0 ? startX : startX + START_DISTANCE_SQUARES;
      const y = Math.floor(height / 2) + (i % 2 === 0 ? i : -i);
      combatants.push(createCombatant(applyRuleOptions(s.sheet, merged), `c${n++}`, team, s.controller, { x, y }));
    });
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
  };
  return { state, dice: dice ?? seededDice(seed), rules: merged };
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
