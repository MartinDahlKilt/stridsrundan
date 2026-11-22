import { spellDef, type SpellDef } from '../data/spells';
import { armourAt, heldItem } from './character';
import { meleeWeapons, rangedWeapon } from './cl';
import { currentFF } from './conditions';
import type { SpellOption, SpellTarget, SpellTargetOption } from './magic';
import type { ActionChoice, ActionOptions } from './requests';
import { maxReach } from './requests';
import { activeSpell, weaponSpellMod } from './spellEffects';
import { byId, enemiesOf, squares, SQUARE_M, type Ctx } from './state';
import type { Combatant, Location } from './types';
import { LOCATIONS } from './types';

/**
 * Spellcasting for the computer opponent (implementation-plan §3.4 style: simple, transparent, logged).
 * Every spell/E/target is scored by expected effect × chance to succeed, per action spent, discounted when an
 * enemy is close enough to break the concentration before a long spell is finished.
 */

export interface MagicPlan {
  choice: ActionChoice;
  /** Comparable with the melee attack score in ai.ts (≈ expected KP + 0.6 SP per action). */
  score: number;
  why: string;
}

const LOC_WEIGHT: Record<Location, number> = { head: 1.4, chest: 1.2, abdomen: 1.2, rightArm: 1.0, leftArm: 0.9, rightLeg: 0.9, leftLeg: 0.9 };

const chance = (cl: number) => Math.max(0.05, Math.min(0.95, cl / 20));

/** Chance that the caster's PSY (after paying E) beats the target's on the resistance table. */
function resistChance(c: Combatant, t: Combatant, def: SpellDef, e: number): number {
  if (def.physical) return 1;
  const target = c.psy - e - Math.max(0, t.psy) + 10;
  return Math.max(0, Math.min(1, target / 20));
}

/** Expected KP + 0.6 SP after armour, capped at what the target has left. */
function damageValue(t: Combatant, kp: number, sp: number, abs: { absKP: number; absSP: number }, weight = 1): number {
  const k = Math.min(Math.max(0, kp - abs.absKP), Math.max(1, t.kpTotal.cur) + 2);
  const s = Math.min(Math.max(0, sp - abs.absSP), Math.max(1, t.spTotal.cur));
  return (k + 0.6 * s) * weight;
}

function bestAimedLocation(t: Combatant, avg: number): Location {
  return LOCATIONS.map((l) => ({ l, v: (Math.max(0, avg - armourAt(t, l).absKP) + 0.6 * Math.max(0, avg - armourAt(t, l).absSP)) * LOC_WEIGHT[l] })).sort((a, b) => b.v - a.v)[0].l;
}

/** Value of releasing `def` at E on one target option (before the casting chance). */
function targetValue(ctx: Ctx, c: Combatant, def: SpellDef, e: number, opt: SpellTargetOption): { value: number; target: SpellTarget } {
  const t = opt.target.targetId ? byId(ctx, opt.target.targetId) : c;
  const r = ctx.state.round;
  switch (def.kind) {
    case 'damage':
    case 'explosion': {
      const spec = def.damage!;
      const avg = spec.flatPerE ? spec.flatPerE * e : (e * (spec.sides + 1)) / 2;
      const loc = spec.mode === 'aimed' ? bestAimedLocation(t, avg) : undefined;
      const abs = !spec.armour ? { absKP: 0, absSP: 0 } : armourAt(t, loc ?? 'chest');
      const burn = spec.burn ? 3.5 * (spec.burn.rounds === '1T10' ? 5.5 : 2) : 0;
      const one = (v: Combatant, falloff = 0) => damageValue(v, avg - falloff + burn, avg - falloff + burn, abs, loc ? LOC_WEIGHT[loc] : 1) * resistChance(c, v, def, e);
      if (!spec.area) return { value: one(t), target: { ...opt.target, location: loc } };
      // Area spells: enemies count, the caster and friends count against (×1.5).
      const radius = Math.floor(e / SQUARE_M);
      let value = 0;
      for (const v of ctx.state.combatants.filter((x) => x.status === 'active')) {
        const d = squares(v.pos, t.pos, ctx.state.grid);
        const falloff = def.kind === 'explosion' ? Math.max(0, d - radius) : d <= radius ? 0 : Infinity;
        if (falloff === Infinity || avg - falloff <= 0) continue;
        value += (v.team === c.team ? -1.5 : 1) * one(v, falloff);
      }
      if (def.kind === 'explosion') value += 2 * enemiesOf(ctx, c).length; // blinded next round
      return { value, target: { ...opt.target, location: loc } };
    }
    case 'breathless':
      // Ends the target's fight – E1 is enough, so the AI never pays for more.
      return { value: e === 1 ? (t.kpTotal.cur + 0.6 * t.spTotal.cur) * 1.5 * resistChance(c, t, def, e) : 0, target: opt.target };
    case 'coldHand': {
      const left = t.slots.filter((s) => !s.used && !s.lost).length;
      // Only worth it while the target still has actions this round: lost (fail) or at −4 (success).
      const fail = 1 - Math.max(0, Math.min(1, (t.sheet.attributes.FYS - 5) / 20));
      return { value: e === 1 ? left * (3 * fail + (1 - fail)) : 0, target: opt.target };
    }
    case 'shatter': {
      const held = heldItem(t, opt.target.item ?? 'main');
      if (!held) return { value: 0, target: opt.target };
      const breaks = (held.state.bv ?? 10) - (10 + 2 * (e - 1)) <= 0;
      // Only pay for the grades needed to break it outright.
      const needed = Math.max(1, Math.ceil(((held.state.bv ?? 10) - 10) / 2) + 1);
      const v = !breaks || e > needed ? 0.5 : held.def.kind === 'shield' ? 6 : 12;
      return { value: v, target: opt.target };
    }
    case 'weapon': {
      const owner = def.targeting === 'ownItem' ? c : t;
      const held = heldItem(owner, opt.target.item ?? 'main');
      if (!held || weaponSpellMod(owner, held.key, r) !== 0 || held.def.kind === 'shield') return { value: 0, target: opt.target };
      if (def.targeting === 'ownItem') return { value: inMelee(ctx, c) ? e * 0.6 : 0, target: opt.target };
      return { value: e * 1.2, target: opt.target };
    }
    case 'whirlwind': {
      if (activeSpell(c, 'whirlwind', r)) return { value: 0, target: opt.target };
      const archers = enemiesOf(ctx, c).filter((x) => ['projectile', 'thrown'].includes(heldItem(x, 'main')?.def.kind ?? ''));
      return { value: archers.length ? 4 + e : 0, target: opt.target };
    }
    case 'flamingHand':
      return { value: !activeSpell(c, 'flamingHand', r) && inMelee(ctx, c) ? e * 2 * 0.8 : 0, target: opt.target };
    case 'shield':
      return { value: 0, target: opt.target };
  }
}

function inMelee(ctx: Ctx, c: Combatant): boolean {
  return enemiesOf(ctx, c).some((e) => squares(c.pos, e.pos, ctx.state.grid) <= Math.max(maxReach(ctx, e), 1));
}

/**
 * How likely the spell gets finished: a long spell next to an enemy will be interrupted by the first wound
 * (concentration, §22.4). An enemy who can cover the distance and still strike before the release counts too.
 */
function timeFactor(ctx: Ctx, c: Combatant, actions: number): number {
  if (actions <= 1) return 1;
  const perRound = Math.max(1, c.slots.filter((s) => !s.lost).length);
  const roundsToRelease = Math.floor((actions - 1) / perRound);
  let worst = 1;
  for (const e of enemiesOf(ctx, c)) {
    const d = squares(c.pos, e.pos, ctx.state.grid);
    const reach = Math.max(1, maxReach(ctx, e));
    const ff = currentFF(e, ctx.state.round);
    const shooter = ['projectile', 'thrown'].includes(heldItem(e, 'main')?.def.kind ?? '');
    let f = 1;
    if (d <= reach) f = actions === 2 ? 0.35 : 0.1;
    // Close enough to move half and strike this round, or to run in now and strike in a later round.
    else if (d <= reach + Math.floor(ff / 2) + ff * roundsToRelease) f = actions === 2 ? 0.7 : 0.35;
    else if (shooter) f = actions === 2 ? 0.8 : 0.6;
    worst = Math.min(worst, f);
  }
  return worst;
}

function evaluate(ctx: Ctx, c: Combatant, def: SpellDef, e: number, cl: number, targets: SpellTargetOption[]): { value: number; target: SpellTarget } | null {
  let best: { value: number; target: SpellTarget } | null = null;
  for (const t of targets) {
    const v = targetValue(ctx, c, def, e, t);
    if (!best || v.value > best.value) best = v;
  }
  if (!best || best.value <= 0) return null;
  return { value: best.value * chance(cl), target: best.target };
}

function heroPointFor(c: Combatant, cl: number, value: number): boolean {
  return (c.hero?.points ?? 0) > 2 && cl < 14 && value >= 8;
}

/** The best spell to start (or release at once) – null when nothing is worth casting. */
export function planMagic(ctx: Ctx, c: Combatant, o: ActionOptions): MagicPlan | null {
  const m = o.magic;
  if (!m) return null;

  // A spell in progress: keep going, release it on the best target, or keep a prepared SKÖLD for the parry.
  if (m.casting) {
    const k = m.casting;
    if (k.reactionOnly) {
      if (threatened(ctx, c)) return { choice: { kind: 'hold' }, score: Infinity, why: 'keeps the SKÖLD ready.' };
      // Nobody can hurt us any more: let the shield go (1 PSY) if something better is on offer.
      const other = bestNewSpell(ctx, c, { ...m, casting: null });
      return other ?? { choice: { kind: 'hold' }, score: Infinity, why: 'keeps the SKÖLD ready.' };
    }
    if (!k.ready) return { choice: { kind: 'castContinue' }, score: Infinity, why: `keeps casting ${k.sv} (${k.done + 1}/${k.total}).` };
    const ev = evaluate(ctx, c, spellDef(k.spell), k.e, k.cl.cl, k.targets);
    if (!ev) return { choice: { kind: 'hold' }, score: Infinity, why: `holds the ${k.sv}, waiting for a target.` };
    return { choice: { kind: 'castRelease', target: ev.target, heroPoint: heroPointFor(c, k.cl.cl, ev.value) }, score: Infinity, why: `releases ${k.sv} E${k.e}.` };
  }
  if (m.blocked) return null;
  return bestNewSpell(ctx, c, m);
}

function bestNewSpell(ctx: Ctx, c: Combatant, m: NonNullable<ActionOptions['magic']>): MagicPlan | null {
  let best: (MagicPlan & { raw: number }) | null = null;
  for (const sp of m.spells) {
    const def = spellDef(sp.id);
    if (sp.reactionOnly) {
      const plan = shieldPlan(ctx, c, sp);
      if (plan && (!best || plan.score > best.score)) best = { ...plan, raw: plan.score };
      continue;
    }
    const tf = timeFactor(ctx, c, sp.actions);
    for (let e = 1; e <= sp.maxE; e++) {
      const cl = sp.cls[e - 1].cl;
      const ev = evaluate(ctx, c, def, e, cl, sp.targets);
      if (!ev) continue;
      // Per action spent, discounted for interruptions; a little thrift with PSY.
      const score = (ev.value * tf) / sp.actions - 0.05 * e;
      if (!best || score > best.score) {
        const choice: ActionChoice =
          sp.actions === 1
            ? { kind: 'cast', spell: sp.id, e, target: ev.target, heroPoint: heroPointFor(c, cl, ev.value) }
            : { kind: 'cast', spell: sp.id, e };
        best = { choice, score, raw: ev.value, why: `casts ${sp.sv} E${e} (CL ${cl}, ${sp.actions} action${sp.actions === 1 ? '' : 's'}).` };
      }
    }
  }
  return best && best.score > 0.3 ? best : null;
}

/** Prepare SKÖLD when an enemy is (about to be) in melee and there is nothing better to do with the action. */
function shieldPlan(ctx: Ctx, c: Combatant, sp: SpellOption): MagicPlan | null {
  if (!threatened(ctx, c)) return null;
  return { choice: { kind: 'cast', spell: sp.id, e: 1 }, score: 2.5, why: 'prepares SKÖLD against the coming blow.' };
}

/** An enemy next to us (or one step away) with a usable melee weapon, or one holding a missile weapon. */
function threatened(ctx: Ctx, c: Combatant): boolean {
  return enemiesOf(ctx, c).some((e) => {
    if (rangedWeapon(e)) return true;
    const weapons = meleeWeapons(ctx, e);
    return weapons.length > 0 && squares(c.pos, e.pos, ctx.state.grid) <= Math.max(...weapons.map((w) => w.reach)) + 1;
  });
}
