import { itemDef } from '../data/items';
import { armourAt, heldItem } from './character';
import { avgDice } from './dice';
import { resolveWeapon } from './cl';
import { weaponDamageDice } from './damage';
import { planMagic } from './aiMagic';
import { type ActionChoice, type AttackChoice, type AttackOption, type DecisionAnswer, type DecisionRequest, type Maneuver } from './requests';
import { byId, enemiesOf, log, squares, type Ctx } from './state';
import type { Combatant, Location, Pos } from './types';
import { LOCATION_NAMES } from './types';

/**
 * Default computer opponent (implementation-plan §3.4). Simple and transparent: every choice is
 * logged with a short reason so the rules stay visible.
 */
export function aiDecide(ctx: Ctx, req: DecisionRequest): DecisionAnswer {
  switch (req.kind) {
    case 'action':
      return decideAction(ctx, byId(ctx, req.actorId), req);
    case 'parry': {
      const best = req.options.map((o, i) => ({ o, i })).sort((a, b) => b.o.cl.cl - a.o.cl.cl)[0];
      if (!best) return null;
      if (best.o.cl.cl < 6 && !req.mustParry) return null;
      // Spend a hero point when a hit would hurt badly and the parry is shaky.
      const d = byId(ctx, req.actorId);
      if (req.heroPoints > 0 && best.o.cl.cl < 14 && d.kpTotal.cur <= d.kpTotal.max * 0.6) return { index: best.i, heroPoint: true };
      return best.i;
    }
    case 'powerStrike':
      return req.psy >= 6;
    case 'lastStand':
      return true;
    case 'rollWithBlow': {
      const d = byId(ctx, req.actorId);
      const remaining = d.sp[req.location].cur;
      return req.cl >= 10 && (req.spDamage >= remaining || req.spDamage >= d.spTotal.cur / 3);
    }
    case 'firstStrike':
      return bestAttack(ctx, byId(ctx, req.actorId), req.options)?.choice ?? null;
  }
}

const LOCATION_WEIGHT: Record<Location, number> = {
  head: 1.4,
  chest: 1.2,
  abdomen: 1.2,
  rightArm: 1.0,
  leftArm: 0.9,
  rightLeg: 0.9,
  leftLeg: 0.9,
};

function bestAttack(ctx: Ctx, a: Combatant, options: AttackOption[]): { score: number; choice: AttackChoice } | null {
  let best: { score: number; choice: AttackChoice } | null = null;
  for (const opt of options) {
    const target = byId(ctx, opt.targetId);
    const w = resolveWeapon(a, opt.weapon);
    if (!w) continue;
    const dice = weaponDamageDice(w);
    const sb = avgDice(a.derived.sb);
    // Hero manoeuvres: N attacks from FV/N, or a lightning attack at −10 that cripples the parry.
    const plans: { maneuver?: Maneuver; strikes: number; clShift: number; bonus: number }[] = [{ strikes: 1, clShift: 0, bonus: 1 }];
    for (const m of opt.maneuvers) {
      if (m.id === 'double') plans.push({ maneuver: 'double', strikes: 2, clShift: Math.floor(w.fv / 2) - w.fv, bonus: 1 });
      if (m.id === 'triple') plans.push({ maneuver: 'triple', strikes: 3, clShift: Math.floor(w.fv / 3) - w.fv, bonus: 1 });
      if (m.id === 'lightning') plans.push({ maneuver: 'lightning', strikes: 1, clShift: -10, bonus: 1.4 });
    }
    for (const plan of plans) {
      for (const lo of opt.locations) {
        const arm = armourAt(target, lo.location);
        const p = Math.max(0.05, Math.min(0.95, (lo.cl.cl + plan.clShift) / 20));
        const kp = Math.max(0.3, avgDice(dice.kp) + sb - arm.absKP);
        const sp = Math.max(0, avgDice(dice.sp) + sb - arm.absSP) * 0.6;
        const score = plan.strikes * p * (kp + sp) * LOCATION_WEIGHT[lo.location] * plan.bonus;
        if (!best || score > best.score) {
          best = {
            score,
            choice: {
              kind: 'attack',
              targetId: opt.targetId,
              weapon: opt.weapon,
              location: lo.location,
              techniques: opt.techniques.map((t) => t.id),
              maneuver: plan.maneuver,
              // Spend a hero point to finish off a weakened opponent.
              heroPoint: (a.hero?.points ?? 0) > 0 && target.kpTotal.cur <= target.kpTotal.max * 0.4,
            },
          };
        }
      }
    }
  }
  return best;
}

function decideAction(ctx: Ctx, c: Combatant, req: Extract<DecisionRequest, { kind: 'action' }>): ActionChoice {
  const o = req.options;
  const say = (text: string) => log(ctx, `(AI) ${text}`, 'ai', 2, c.id);

  // Spells: a spell in progress always goes on; a new one only if it beats a melee attack.
  const magic = planMagic(ctx, c, o);
  const attack = o.attacks.length ? bestAttack(ctx, c, o.attacks) : null;
  if (magic && (!attack || magic.score > attack.score)) {
    say(magic.why);
    return magic.choice;
  }

  // Melee if anyone is in reach.
  if (attack) {
    const choice = attack.choice;
    say(`attacks the ${choice.location === 'wild' ? 'body' : LOCATION_NAMES[choice.location].toLowerCase()} – best expected damage after armour.`);
    return choice;
  }

  const enemies = enemiesOf(ctx, c);
  if (!enemies.length) return { kind: 'hold' };
  const nearest = enemies.sort((x, y) => squares(c.pos, x.pos) - squares(c.pos, y.pos))[0];
  const dist = squares(c.pos, nearest.pos);

  // A hero stares the opponent down while they are still closing in.
  if (o.canIntimidate && dist > 6) {
    say('lets the opponent approach and stares them down.');
    return { kind: 'intimidate' };
  }
  const main = heldItem(c, 'main');
  const holdingRanged = main && (main.def.kind === 'projectile' || main.def.kind === 'thrown');

  // Ranged: aim with spare actions, shoot with the last one this round.
  if (holdingRanged && dist >= 2) {
    const shot = o.shots.find((s) => s.targetId === nearest.id);
    const slotsLeft = c.slots.filter((s) => !s.used && !s.lost).length;
    const willCloseIn = dist <= 3;
    if (shot) {
      if (o.canAim && slotsLeft > 1 && !willCloseIn) {
        say('aims before shooting.');
        return { kind: 'aim' };
      }
      say(`shoots (CL ${shot.random.cl}).`);
      return { kind: 'shoot', targetId: nearest.id, location: null };
    }
    if (o.canReload) {
      say('reloads.');
      return { kind: 'reload' };
    }
  }

  // Switch from a ranged weapon to a melee loadout when the enemy is close or shooting isn't possible.
  if (holdingRanged && (dist <= 2 || (!o.shots.length && !o.canReload))) {
    const melee = o.loadouts.find((lo) => {
      const l = c.sheet.equipment.loadouts[lo.index];
      return [l.main, l.off].some((k) => k && ['melee', 'shield'].includes(itemKind(c, k)));
    });
    if (melee) {
      say(`draws a melee weapon (${melee.name}).`);
      return { kind: 'ready', loadout: melee.index };
    }
  }
  if (!main && !c.hands.off && o.loadouts.length && !c.sheet.skills.martialArt) {
    say(`readies ${o.loadouts[0].name}.`);
    return { kind: 'ready', loadout: o.loadouts[0].index };
  }

  // Close in.
  if (o.move) {
    const reach = Math.max(1, ...meleeReaches(c));
    const dest = approach(c.pos, nearest.pos, o.move.squares, reach);
    if (dest) {
      say(`moves towards ${nearest.sheet.name}.`);
      return { kind: 'move', to: dest };
    }
  }
  if (o.canDefensive && c.kpTotal.cur < c.kpTotal.max / 3) {
    say('fights defensively.');
    return { kind: 'defensive' };
  }
  return { kind: 'hold' };
}

function itemKind(c: Combatant, key: string): string {
  const it = c.items[key];
  return it ? itemDef(it.def).kind : '';
}

function meleeReaches(c: Combatant): number[] {
  const out: number[] = [];
  for (const hand of ['main', 'off'] as const) {
    const h = heldItem(c, hand);
    if (h && h.def.kind === 'melee') out.push(h.def.length + 1);
  }
  if (!out.length) out.push(1);
  return out;
}

/** Pick the reachable square closest to the target, preferring squares within weapon reach. */
function approach(from: Pos, target: Pos, options: Pos[], reach: number): Pos | null {
  let best: { p: Pos; score: number } | null = null;
  for (const p of options) {
    const d = squares(p, target);
    if (d === 0) continue;
    const inReach = d <= reach;
    const score = (inReach ? 1000 : 0) - d * 10 - squares(from, p) * (inReach ? 1 : 0) - Math.abs(p.y - target.y) * 0.1;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best) return null;
  return squares(best.p, target) < squares(from, target) ? best.p : null;
}

