import { parseDice, rollDice } from './dice';
import { armOfHand, heldItem, mainArm, offArm } from './character';
import { applyDirectKp, hitFriend, setOut } from './damage';
import { alliesOf, log, squares, type Ctx } from './state';
import { lookup, RANDOM_MELEE } from '../data/tables';
import type { ClScope, Combatant, Condition, ConditionKind, Effect, Location, RoundSpan, Slot, SlotWeapon, TableEntry } from './types';
import { isArm, isLeg, LOCATION_NAMES } from './types';

export const FOREVER = 9999;

export function activeConditions(c: Combatant, round: number, kind?: ConditionKind): Condition[] {
  return c.conditions.filter(
    (x) => (!kind || x.kind === kind) && x.fromRound <= round && x.throughRound >= round && (x.uses === undefined || x.uses > 0),
  );
}

export const hasCondition = (c: Combatant, round: number, kind: ConditionKind) => activeConditions(c, round, kind).length > 0;

export function useCondition(cond: Condition): void {
  if (cond.uses !== undefined) cond.uses -= 1;
}

/** Remove expired / used-up conditions. */
export function pruneConditions(c: Combatant, round: number): void {
  c.conditions = c.conditions.filter((x) => x.throughRound >= round && (x.uses === undefined || x.uses > 0));
}

/** Which CL-modifier scopes apply to a roll of the given kind. */
export function scopesFor(kind: 'attack' | 'parry' | 'ranged' | 'spell', usesMainHand: boolean, arm: Location | null): (cond: Condition) => boolean {
  return (cond) => {
    const s = cond.scope ?? 'all';
    if (s === 'all') return true;
    if (kind === 'spell') return false;
    if (s === 'attack') return kind === 'attack' || kind === 'ranged';
    if (s === 'parry') return kind === 'parry';
    if (s === 'attackParry') return true;
    if (s === 'ranged') return kind === 'ranged';
    if (s === 'mainHand') return usesMainHand;
    if (s === 'hitArm') return arm !== null && cond.location === arm;
    return false;
  };
}

export function limbUsable(c: Combatant, loc: Location, round: number): boolean {
  return !activeConditions(c, round, 'limbUnusable').some((x) => x.location === loc);
}

/** Current movement in squares per SR (load penalty, crit factors, fumble modifiers). */
export function currentFF(c: Combatant, round: number): number {
  let ff = c.derived.ffBase + c.derived.loadPenalty;
  for (const x of activeConditions(c, round, 'ffMod')) ff += x.value ?? 0;
  ff = Math.max(1, ff);
  let factor = 1;
  for (const x of activeConditions(c, round, 'movementFactor')) factor = Math.min(factor, x.value ?? 1);
  if (!limbUsable(c, 'leftLeg', round) || !limbUsable(c, 'rightLeg', round)) factor = 0;
  if (hasCondition(c, round, 'prone')) factor = 0;
  return Math.floor(ff * factor);
}

// ---------------------------------------------------------------------------
// Action slots
// ---------------------------------------------------------------------------

export function freeSlots(c: Combatant, opp?: number) {
  return c.slots.filter((s) => !s.used && !s.lost && (opp === undefined || s.opp === opp));
}

/** Free slots usable for anything (not weapon-restricted). */
export function generalSlots(c: Combatant, opp?: number) {
  return freeSlots(c, opp).filter((s) => !s.weapon);
}

/** A free slot usable for an attack/parry with `weapon` – the weapon-only slot first, then a general one. */
export function slotFor(c: Combatant, opp: number | { from: number }, weapon: SlotWeapon | null): Slot | undefined {
  const pool = typeof opp === 'number' ? freeSlots(c, opp) : c.slots.filter((s) => !s.used && !s.lost && s.opp >= opp.from);
  return (weapon ? pool.find((s) => s.weapon === weapon) : undefined) ?? pool.find((s) => !s.weapon);
}

/** Which restricted-slot kind a weapon reference uses. */
export function slotWeaponOf(ref: string | null): SlotWeapon | null {
  if (!ref) return null;
  if (ref.startsWith('unarmed')) return 'unarmed';
  return ref === 'main' || ref === 'off' ? ref : null;
}

/** Lose the next N actions: unused slots from the current opportunity on, then carried into next round. */
export function loseActions(ctx: Ctx, c: Combatant, n: number): void {
  let left = n;
  for (const s of c.slots) {
    if (left <= 0) break;
    if (!s.used && !s.lost && s.opp >= ctx.state.opp) {
      s.lost = true;
      left--;
    }
  }
  c.pendingLostActions += left;
}

export function loseRestOfRound(ctx: Ctx, c: Combatant): void {
  for (const s of c.slots) if (!s.used && s.opp >= ctx.state.opp) s.lost = true;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export interface EffectInfo {
  /** Location hit (criticals) – used for 'hit' limbs and arm-scoped penalties. */
  location?: Location;
  /** Where the effect came from, for the log. */
  source: string;
}

function spanToRounds(ctx: Ctx, span: RoundSpan | { from: number; throughDice: string }): { from: number; through: number; uses?: number } {
  const r = ctx.state.round;
  if ('uses' in span) return { from: r, through: FOREVER, uses: span.uses };
  if ('throughDice' in span) return { from: r + span.from, through: r + rollDice(ctx.dice, parseDice(span.throughDice)).total };
  return { from: r + span.from, through: span.through === 'fight' ? FOREVER : r + span.through };
}

export function addCondition(c: Combatant, cond: Condition): void {
  c.conditions.push(cond);
}

function handForArm(c: Combatant, arm: Location): 'main' | 'off' | null {
  if (arm === mainArm(c)) return 'main';
  if (arm === offArm(c)) return 'off';
  return null;
}

export function dropHand(ctx: Ctx, c: Combatant, hand: 'main' | 'off', how: 'dropped' | 'broken', squaresAway?: number): void {
  const held = heldItem(c, hand);
  if (!held) return;
  held.state.status = how;
  c.hands[hand] = null;
  // A two-handed weapon can't be held in the other hand alone.
  const where = how === 'broken' ? 'breaks' : squaresAway ? `flies ${squaresAway} squares away` : 'falls to the ground';
  log(ctx, `${c.sheet.name}'s ${held.def.name} ${where}.`, 'status', 2, c.id);
}

export function applyEffects(ctx: Ctx, c: Combatant, effects: Effect[], info: EffectInfo): void {
  const r = ctx.state.round;
  const text = info.source;
  for (const ef of effects) {
    if (c.status !== 'active' && ef.t !== 'bleed') continue;
    switch (ef.t) {
      case 'loseActions':
        loseActions(ctx, c, ef.n);
        break;
      case 'loseRestOfRound':
        loseRestOfRound(ctx, c);
        break;
      case 'cannotAct': {
        const through = typeof ef.through === 'number' ? r + ef.through : r + rollDice(ctx.dice, parseDice(ef.through)).total;
        addCondition(c, { kind: 'cannotAct', fromRound: r + ef.from, throughRound: through, text });
        if (ef.from === 0) loseRestOfRound(ctx, c);
        break;
      }
      case 'onlyParry':
        addCondition(c, { kind: 'onlyParry', fromRound: r + ef.from, throughRound: r + ef.through, text });
        break;
      case 'noParry':
        addCondition(c, { kind: 'noParry', fromRound: r + ef.from, throughRound: r + ef.through, text });
        break;
      case 'noAttack':
        addCondition(c, { kind: 'noAttack', fromRound: r + ef.from, throughRound: ef.through === 'fight' ? FOREVER : r + ef.through, text });
        break;
      case 'autoFail': {
        const span = spanToRounds(ctx, ef.span);
        addCondition(c, { kind: 'autoFail', fromRound: span.from, throughRound: span.through, uses: span.uses, text });
        break;
      }
      case 'missNext':
        addCondition(c, { kind: 'missNext', fromRound: r, throughRound: FOREVER, uses: ef.uses, text });
        break;
      case 'clMod': {
        const span = spanToRounds(ctx, ef.span);
        let location: Location | undefined;
        if (ef.scope === 'hitArm') location = info.location && isArm(info.location) ? info.location : ctx.dice.d(2) === 1 ? 'rightArm' : 'leftArm';
        addCondition(c, { kind: 'clMod', value: ef.value, scope: ef.scope as ClScope, location, fromRound: span.from, throughRound: span.through, uses: span.uses, text });
        break;
      }
      case 'actionPenalty':
        addCondition(c, { kind: 'actionPenalty', value: ef.n, fromRound: r + 1, throughRound: FOREVER, text });
        break;
      case 'bleed':
        c.bleeds.push({ kp: ef.kp, every: ef.every, counter: 0, source: text });
        log(ctx, `${c.sheet.name} is bleeding: ${ef.kp} KP every ${ef.every === 1 ? 'round' : `${ef.every} rounds`}.`, 'status', 2, c.id);
        break;
      case 'limbUnusable': {
        let loc: Location | undefined;
        if (ef.which === 'hit') loc = info.location;
        else if (ef.which === 'randomArm') loc = ctx.dice.d(2) === 1 ? 'rightArm' : 'leftArm';
        else loc = offArm(c);
        if (!loc || !(isArm(loc) || isLeg(loc))) break;
        const through = ef.throughDice ? r + rollDice(ctx.dice, parseDice(ef.throughDice)).total : FOREVER;
        makeLimbUnusable(ctx, c, loc, through, text);
        break;
      }
      case 'dropItem': {
        let hand: 'main' | 'off' | null = null;
        if (ef.which === 'main') hand = 'main';
        else if (ef.which === 'shield') hand = heldItem(c, 'off')?.def.kind === 'shield' ? 'off' : null;
        else if (info.location && isArm(info.location)) hand = handForArm(c, info.location);
        if (hand) {
          const twoHanded = hand === 'off' && !c.hands.off;
          dropHand(ctx, c, twoHanded ? 'main' : hand, 'dropped', ef.squares ? rollDice(ctx.dice, parseDice(ef.squares)).total : undefined);
        }
        break;
      }
      case 'breakItem': {
        const hand = ef.which === 'shield' ? 'off' : 'main';
        dropHand(ctx, c, hand, 'broken');
        break;
      }
      case 'movementFactor':
        addCondition(c, { kind: 'movementFactor', value: ef.factor, fromRound: r, throughRound: FOREVER, text });
        break;
      case 'ffMod':
        addCondition(c, { kind: 'ffMod', value: ef.value, fromRound: r, throughRound: FOREVER, text });
        break;
      case 'prone':
        addCondition(c, { kind: 'prone', fromRound: r, throughRound: ef.through === 'fight' ? FOREVER : r + ef.through, text });
        log(ctx, `${c.sheet.name} is on the ground.`, 'status', 2, c.id);
        break;
      case 'opponentBonus': {
        const span = spanToRounds(ctx, ef.span);
        addCondition(c, { kind: 'opponentBonus', value: ef.value, fromRound: span.from, throughRound: span.through, uses: span.uses, text });
        break;
      }
      case 'autoHitAgainst':
        addCondition(c, { kind: 'autoHitAgainst', fromRound: r, throughRound: FOREVER, uses: ef.uses, noParry: ef.noParry, text });
        break;
      case 'selfDamage': {
        let loc: Location;
        if (ef.location === 'randomLeg') loc = ctx.dice.d(2) === 1 ? 'rightLeg' : 'leftLeg';
        else if (ef.location === 'mainArm') loc = armOfHand(c, 'main');
        else loc = ef.location;
        applyDirectKp(ctx, c, loc, ef.kp, 'self-inflicted');
        break;
      }
      case 'loseArmour': {
        const loc = lookup(RANDOM_MELEE, ctx.dice.d(20));
        if (c.armour[loc].length) {
          c.armour[loc] = [];
          log(ctx, `${c.sheet.name} loses the armour on the ${LOCATION_NAMES[loc].toLowerCase()}.`, 'status', 2, c.id);
        } else log(ctx, `(${LOCATION_NAMES[loc]} had no armour to lose.)`, 'info', 2, c.id);
        break;
      }
      case 'hitFriend': {
        const friend = alliesOf(ctx, c).find((a) => squares(a.pos, c.pos, ctx.state.grid) <= 1);
        if (friend) hitFriend(ctx, c, friend);
        else log(ctx, 'No friend is close enough to be hit.', 'info', 2, c.id);
        break;
      }
      case 'out':
        setOut(ctx, c, ef.kind, ef.reason);
        break;
      case 'rollTwice':
        break;
    }
  }
}

export function makeLimbUnusable(ctx: Ctx, c: Combatant, loc: Location, throughRound: number, text: string): void {
  const r = ctx.state.round;
  addCondition(c, { kind: 'limbUnusable', location: loc, fromRound: r, throughRound, text });
  const temp = throughRound < FOREVER ? ` until round ${throughRound}` : '';
  log(ctx, `${c.sheet.name}'s ${LOCATION_NAMES[loc].toLowerCase()} is useless${temp}.`, 'status', 2, c.id);
  if (isArm(loc)) {
    const hand = handForArm(c, loc);
    if (hand) dropHand(ctx, c, hand, 'dropped');
    // Two-handed weapons need both arms.
    const main = heldItem(c, 'main');
    if (main && hand === 'off' && !c.hands.off && (main.def.twoHandedOnly || main.def.kind === 'projectile')) dropHand(ctx, c, 'main', 'dropped');
  }
}

/** Roll on a table; a "roll twice" result rolls twice more, re-rolling further 20s (III 3154). */
export function rollTable(ctx: Ctx, table: TableEntry[], sides: number): TableEntry[] {
  const roll = ctx.dice.d(sides);
  const entry = table.find((t) => t.roll === roll) ?? table[table.length - 1];
  if (!entry.effects.some((e) => e.t === 'rollTwice')) return [entry];
  const out: TableEntry[] = [entry];
  for (let i = 0; i < 2; i++) {
    let r2 = ctx.dice.d(sides);
    while (r2 === 20) r2 = ctx.dice.d(sides);
    out.push(table.find((t) => t.roll === r2)!);
  }
  return out;
}
