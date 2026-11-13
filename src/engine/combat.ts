import { FUMBLE_TABLES, FUMBLE_TABLE_NAMES, type FumbleTable } from '../data/fumbles';
import { lookup, RANDOM_MELEE, RANDOM_RANGED } from '../data/tables';
import { buildSlots, countActions, effectiveSMI, hasHero, heldItem, hasMartialTechnique, offArm } from './character';
import { attackCL, checkRanged, describeCl, rangedCL, rangedWeapon, resolveWeapon, type ClResult, type Mod, type ParryContext, type ResolvedWeapon } from './cl';
import { activeConditions, applyEffects, dropHand, FOREVER, freeSlots, pruneConditions, rollTable, slotFor, slotWeaponOf, useCondition } from './conditions';
import { applyHit, checkThresholds, rollDamage, setOut, type DamageOptions } from './damage';
import { attackDirection, backstabWeapon, faceTowards, sneakFV, spotDangerCL } from './facing';
import { spellDef } from '../data/spells';
import { spellSkill } from './cl';
import { castActions, castShieldParry, releaseSpell, tickBurns, whirlwindDeflects } from './magic';
import { breakConcentration } from './psy';
import { pruneSpells } from './spellEffects';
import {
  blottaFor,
  buildActionOptions,
  canAct,
  canAttackNow,
  hasAnyOption,
  maxReach,
  meleeAttackOptions,
  meleeParryOptions,
  pairKey,
  parrySlotWeapon,
  rangedParryOptions,
  techniqueFV,
  TECHNIQUES,
  type ActionChoice,
  type AttackChoice,
  type AttackSummary,
  type DecisionRequest,
  type ParryAnswer,
  type ParryOption,
} from './requests';
import { isSuccess, outcomeLabel, raiseOutcome, rollResistance, rollSkill, SG, type SkillRoll } from './skill';
import { active, byId, enemiesOf, inBounds, log, occupied, SQUARE_M, squares, type Ctx } from './state';
import type { Combatant, Location, Pos, SlotWeapon } from './types';
import { LOCATION_NAMES, mirror } from './types';

export type Yielded = { type: 'decision'; request: DecisionRequest } | { type: 'pause' };
export type CombatGenerator = Generator<Yielded, void, any>;

// ---------------------------------------------------------------------------
// Main loop (§4.2)
// ---------------------------------------------------------------------------

export function* runCombat(ctx: Ctx): CombatGenerator {
  const s = ctx.state;
  const teams = [...new Set(s.combatants.map((c) => c.team))].map((t) => s.combatants.filter((c) => c.team === t).map((c) => c.sheet.name).join(', '));
  const gap = Math.min(...s.combatants.flatMap((a) => s.combatants.filter((b) => b.team !== a.team).map((b) => squares(a.pos, b.pos))));
  log(ctx, `The fight begins. ${teams.join(' vs ')} – about ${Math.round(gap * SQUARE_M)} m apart.`, 'heading', 0);
  while (!s.over) {
    s.round += 1;
    s.opp = 0;
    startRound(ctx);
    for (let opp = 1 as 1 | 2 | 3; opp <= 3 && !s.over; opp = (opp + 1) as 1 | 2 | 3) {
      if (!s.combatants.some((c) => active(c) && c.slots.some((sl) => sl.opp === opp))) continue;
      s.opp = opp;
      log(ctx, `Opportunity ${opp}`, 'heading', 0);
      for (const c of turnOrder(ctx)) {
        yield* takeTurn(ctx, c, opp);
        if (s.over) break;
      }
    }
    if (!s.over) {
      yield* endRound(ctx);
      checkEnd(ctx);
      yield { type: 'pause' };
    }
  }
}

function startRound(ctx: Ctx): void {
  const s = ctx.state;
  log(ctx, `Round ${s.round}`, 'heading', 0);
  for (const c of s.combatants) {
    if (!active(c)) continue;
    pruneConditions(c, s.round);
    pruneSpells(c, s.round);
    if (c.sheet.handedness === 'dubbelhant' || c.sheet.handedness === 'ambidextrous') c.fightingSide = ctx.dice.d(2) === 1 ? 'right' : 'left';
    c.movedThisRound = 0;
    c.attackedThisRound = false;
    c.shotThisRound = false;
    c.running = false;
    c.turnDone = {};
    c.blotta = {};
    c.opponentFumbled = false;
    c.techniquesUsed = [];
    c.noCounterOpp = null;
    c.stance = 'normal';
    if (c.hero) c.hero.psyching = false;

    const count = countActions(c, s.bloodDrawn);
    const penalty = activeConditions(c, s.round, 'actionPenalty').reduce((sum, x) => sum + (x.value ?? 0), 0);
    const n = Math.max(0, count.total - penalty);
    const restricted = count.restricted ? { ...count.restricted, n: Math.min(count.restricted.n, n) } : null;
    c.slots = buildSlots(n, restricted);
    if (activeConditions(c, s.round, 'cannotAct').length) {
      for (const sl of c.slots) sl.lost = true;
      log(ctx, `${c.sheet.name} can do nothing this round.`, 'status', 1, c.id);
    }
    let lost = c.pendingLostActions;
    for (const sl of c.slots) {
      if (lost <= 0) break;
      if (!sl.lost) {
        sl.lost = true;
        lost--;
      }
    }
    if (c.pendingLostActions - lost > 0) log(ctx, `${c.sheet.name} loses ${c.pendingLostActions - lost} action(s) this round.`, 'status', 1, c.id);
    c.pendingLostActions = Math.max(0, lost);
  }

  // Initiative: 1T10 + SMI + modifiers (§5). Ties re-roll to settle the order.
  const rolled: { c: Combatant; total: number; tie: number; text: string }[] = [];
  for (const c of s.combatants.filter(active)) {
    const d = ctx.dice.d(10);
    const smi = effectiveSMI(c);
    const parts = [`1T10 [${d}]`, `SMI ${smi}`];
    let total = d + smi;
    const bonus = (label: string, v: number) => {
      total += v;
      parts.push(`${label} +${v}`);
    };
    if (c.sheet.profession === 'warrior') bonus('warrior', 5);
    if ((c.sheet.abilities ?? []).includes('lightningReflexes')) bonus('reflexes', 3);
    if (hasMartialTechnique(c.sheet, 'initiativeBonus')) bonus('initiative bonus', 5);
    if (hasHero(c, 'heroicReflexes')) bonus('heroic reflexes', 5);
    rolled.push({ c, total, tie: 0, text: parts.join(' + ') });
  }
  for (const r of rolled) if (rolled.some((o) => o !== r && o.total === r.total)) r.tie = ctx.dice.d(10);
  rolled.sort((a, b) => key(b) - key(a));
  rolled.forEach((r, i) => (r.c.initiative = 1000 - i + (hasHero(r.c, 'quickStriker') ? 1000 : 0)));
  log(
    ctx,
    `Initiative: ${rolled
      .map((r) => `${r.c.sheet.name} ${hasHero(r.c, 'quickStriker') ? 'always first' : r.total} (${r.text}${r.tie ? `, tie roll ${r.tie}` : ''}) – ${r.c.slots.filter((x) => !x.lost).length} action(s)`)
      .join('; ')}`,
    'roll',
    1,
  );

  // Everyone already in melee rolls for blotta at the start of the round (§6.2).
  for (const a of s.combatants.filter(active)) {
    for (const d of enemiesOf(ctx, a)) {
      if (squares(a.pos, d.pos) <= Math.max(maxReach(ctx, a), maxReach(ctx, d))) blottaFor(ctx, d, a);
    }
  }
}

function key(r: { c: Combatant; total: number; tie: number }): number {
  return (hasHero(r.c, 'quickStriker') ? 10000 : 0) + r.total * 100 + r.tie;
}

/** Initiative order; defensive fighters lose initiative before every opportunity (§4.6). */
function turnOrder(ctx: Ctx): Combatant[] {
  return ctx.state.combatants
    .filter(active)
    .sort((a, b) => (a.stance === 'defensive' ? 0 : 1) * 1e6 + a.initiative > (b.stance === 'defensive' ? 0 : 1) * 1e6 + b.initiative ? -1 : 1);
}

function* takeTurn(ctx: Ctx, c: Combatant, opp: number): CombatGenerator {
  while (!ctx.state.over && active(c) && !c.turnDone[opp] && freeSlots(c, opp).length > 0) {
    if (!canAct(ctx, c)) return;
    const options = buildActionOptions(ctx, c);
    if (!hasAnyOption(options)) {
      log(ctx, `${c.sheet.name} waits${options.restrictions.length ? ` (${options.restrictions.join(' ')})` : ''}.`, 'info', 1, c.id);
      c.turnDone[opp] = true;
      return;
    }
    const choice: ActionChoice = yield { type: 'decision', request: { kind: 'action', actorId: c.id, round: ctx.state.round, opp, options } };
    if (choice.kind === 'hold') {
      log(ctx, `${c.sheet.name} waits, ready to parry.`, 'info', 1, c.id);
      c.turnDone[opp] = true;
      return;
    }
    yield* performAction(ctx, c, choice);
    checkEnd(ctx);
    yield { type: 'pause' };
  }
}

/** Spend an action slot. `weapon` lets a weapon-only (FV 21+) slot be used first. */
function useSlot(ctx: Ctx, c: Combatant, weapon: SlotWeapon | null = null, earliestFrom?: number): void {
  const s = slotFor(c, earliestFrom === undefined ? ctx.state.opp : { from: earliestFrom }, weapon);
  if (s) s.used = true;
}

/** Choices that keep a spell in progress going; anything else uses the action for something else (🔧 SIM-19). */
const KEEPS_SPELL = new Set<ActionChoice['kind']>(['castContinue', 'castRelease', 'hold', 'defensive']);

/** Actions that give a hidden fighter away (melee attacks reveal it themselves, after the Smyga check). */
const REVEALS = new Set<ActionChoice['kind']>(['cast', 'castRelease', 'shoot', 'throwSword']);

/** A hidden fighter has been seen: from now on it can't steal up behind anyone (combat-rules §7.5). */
function reveal(ctx: Ctx, c: Combatant): void {
  if (!c.hidden) return;
  c.hidden = false;
  log(ctx, `${c.sheet.name} is no longer hidden.`, 'info', 1, c.id);
}

function* performAction(ctx: Ctx, c: Combatant, choice: ActionChoice): CombatGenerator {
  if (c.casting && !KEEPS_SPELL.has(choice.kind)) breakConcentration(ctx, c, 'turned to something else');
  if (REVEALS.has(choice.kind)) reveal(ctx, c);
  // Whoever is attacked has been seen.
  if ('targetId' in choice) {
    const t = ctx.state.combatants.find((x) => x.id === choice.targetId);
    if (t) reveal(ctx, t);
  }
  switch (choice.kind) {
    case 'cast': {
      useSlot(ctx, c);
      const def = spellDef(choice.spell);
      const total = castActions(def, spellSkill(c, def.id));
      const req = { spell: def.id, e: choice.e, suicide: !!choice.suicide };
      if (total === 1) {
        const affected = releaseSpell(ctx, c, req, choice.target ?? {}, choice.heroPoint ? (r) => spendHeroPoint(ctx, c, r) : undefined);
        for (const x of affected) yield* lastStand(ctx, x);
        return;
      }
      c.casting = { ...req, done: 1, total };
      const then = def.kind === 'shield' ? 'then held ready to parry' : total === 2 ? 'released with the next action' : `${total - 1} more actions`;
      log(
        ctx,
        `${c.sheet.name} begins ${choice.suicide ? 'a SUICIDE SPELL – ' : ''}${def.sv} E${choice.e}: gestures and words of power (action 1/${total}; ${then}).`,
        'info',
        1,
        c.id,
      );
      return;
    }
    case 'castContinue': {
      const k = c.casting;
      if (!k || k.done >= k.total - 1) return;
      useSlot(ctx, c);
      k.done += 1;
      const ready = k.done >= k.total - 1;
      const sv = spellDef(k.spell).sv;
      log(ctx, `${c.sheet.name} ${k.done <= k.total / 2 ? 'prepares' : 'casts'} ${sv} E${k.e} (action ${k.done}/${k.total})${ready ? (k.spell === 'shield' ? ' – the shield is ready' : ' – ready to release') : ''}.`, 'info', 1, c.id);
      return;
    }
    case 'castRelease': {
      const k = c.casting;
      if (!k) return;
      useSlot(ctx, c);
      const affected = releaseSpell(ctx, c, k, choice.target, choice.heroPoint ? (r) => spendHeroPoint(ctx, c, r) : undefined);
      for (const x of affected) yield* lastStand(ctx, x);
      return;
    }
    case 'attack':
      useSlot(ctx, c, slotWeaponOf(choice.weapon));
      yield* meleeAttack(ctx, c, choice, {});
      return;
    case 'shoot':
      useSlot(ctx, c, 'main');
      yield* rangedAttack(ctx, c, choice.targetId, choice.location);
      return;
    case 'throwSword':
      useSlot(ctx, c, slotWeaponOf(choice.weapon));
      yield* throwSword(ctx, c, choice.targetId, choice.weapon as 'main' | 'off');
      return;
    case 'move':
      useSlot(ctx, c);
      c.aimBonus = 0;
      yield* doMove(ctx, c, choice.to, false);
      return;
    case 'run':
      for (const sl of c.slots) if (!sl.lost) sl.used = true;
      c.running = true;
      c.aimBonus = 0;
      yield* doMove(ctx, c, choice.to, true);
      return;
    case 'aim': {
      useSlot(ctx, c);
      c.aimBonus = Math.min(3, c.aimBonus + 1);
      log(ctx, `${c.sheet.name} takes aim (+${c.aimBonus}).`, 'info', 1, c.id);
      return;
    }
    case 'reload': {
      useSlot(ctx, c);
      const held = heldItem(c, 'main');
      if (!held || !held.def.reload) return;
      if (!c.reloadLeft) c.reloadLeft = held.def.reload * Math.max(1, c.slots.length);
      c.reloadLeft -= 1;
      if (c.reloadLeft <= 0) {
        held.state.loaded = true;
        log(ctx, `${c.sheet.name} has loaded the ${held.def.name}.`, 'info', 1, c.id);
      } else log(ctx, `${c.sheet.name} reloads (${c.reloadLeft} actions left).`, 'info', 1, c.id);
      return;
    }
    case 'ready': {
      // Snabbdragning: drawing costs no action (HH 349).
      const quick = hasHero(c, 'quickDraw');
      if (!quick) useSlot(ctx, c);
      const lo = c.sheet.equipment.loadouts[choice.loadout];
      c.hands = { main: lo.main, off: lo.off };
      c.loadoutIndex = choice.loadout;
      c.aimBonus = 0;
      log(ctx, `${c.sheet.name} switches to ${lo.name}${quick ? ' in a flash (Quick draw – no action)' : ''}.`, 'info', 1, c.id);
      return;
    }
    case 'defensive': {
      c.stance = 'defensive';
      for (const e of enemiesOf(ctx, c)) delete c.blotta[e.id];
      log(ctx, `${c.sheet.name} fights defensively this round: acts last, must parry, leaves no exposed area.`, 'info', 1, c.id);
      return;
    }
    case 'intimidate': {
      for (const sl of c.slots) if (!sl.lost) sl.used = true;
      if (c.hero) c.hero.psyching = true;
      log(ctx, `${c.sheet.name} spends the round sizing up the opposition, staring them down…`, 'info', 1, c.id);
      return;
    }
    case 'hold':
      return;
  }
}

// ---------------------------------------------------------------------------
// Movement (§15.1) and the longer weapon striking first (GAP-12, §10.3)
// ---------------------------------------------------------------------------

function* doMove(ctx: Ctx, c: Combatant, to: Pos, run: boolean): CombatGenerator {
  if (!inBounds(ctx, to) || occupied(ctx, to, c)) return;
  const dist = squares(c.pos, to);
  const enemies = enemiesOf(ctx, c);
  const inReachBefore = new Map(enemies.map((e) => [e.id, squares(c.pos, e.pos) <= maxReach(ctx, e)]));
  const from = c.pos;
  c.pos = { ...to };
  c.movedThisRound += dist;
  // Turn to the nearest enemy close by, else the way you went.
  const near = enemies.filter((e) => squares(c.pos, e.pos) <= 3).sort((x, y) => squares(c.pos, x.pos) - squares(c.pos, y.pos))[0];
  faceTowards(c, near ? near.pos : { x: 2 * to.x - from.x, y: 2 * to.y - from.y });
  log(ctx, `${c.sheet.name} ${run ? 'runs' : 'moves'} ${dist} square${dist === 1 ? '' : 's'} (${(dist * 1.5).toFixed(1)} m).`, 'info', 1, c.id);

  if (!ctx.rules.longerWeaponStrikesFirst) return;
  const moverReach = maxReach(ctx, c);
  for (const e of enemies) {
    if (!active(e) || !active(c)) continue;
    const eReach = maxReach(ctx, e);
    if (inReachBefore.get(e.id) || squares(c.pos, e.pos) > eReach || eReach <= moverReach) continue;
    if (!canAct(ctx, e) || canAttackNow(ctx, e) || !e.slots.some((s) => !s.used && !s.lost && s.opp >= ctx.state.opp)) continue;
    const options = meleeAttackOptions(ctx, e, c).filter((o) => o.reach > moverReach);
    if (!options.length) continue;
    const spearSet =
      ctx.state.round === 1 &&
      dist >= 2 &&
      options.some((o) => {
        const w = resolveWeapon(e, o.weapon);
        return w?.kind === 'item' && w.def.group === 'spear';
      });
    const choice: AttackChoice | null = yield { type: 'decision', request: { kind: 'firstStrike', actorId: e.id, targetId: c.id, options, spearSet } };
    if (!choice) continue;
    log(ctx, `${e.sheet.name}'s longer weapon strikes first as ${c.sheet.name} closes in${spearSet ? ' – the spear is set against the charge' : ''}!`, 'info', 1, e.id);
    useSlot(ctx, e, slotWeaponOf(choice.weapon), ctx.state.opp);
    yield* meleeAttack(ctx, e, choice, { spearAgainstCharge: spearSet });
  }
}

// ---------------------------------------------------------------------------
// Rolls with hero points
// ---------------------------------------------------------------------------

/** Apply "Höja CL" (HH 2972): one step up, refund on a natural perfect. */
function spendHeroPoint(ctx: Ctx, c: Combatant, roll: SkillRoll): void {
  if (!c.hero || c.hero.points <= 0) return;
  const before = roll.outcome;
  const r = raiseOutcome(roll.outcome);
  roll.outcome = r.outcome;
  c.hero.points -= r.refund ? 0 : 1;
  log(ctx, `${c.sheet.name} spends a hero point: ${outcomeLabel(before)} → ${outcomeLabel(r.outcome)}${r.refund ? ' (point refunded)' : ''} (${c.hero.points} left).`, 'roll', 2, c.id);
}

function parseParry(answer: ParryAnswer): { index: number | null; heroPoint: boolean } {
  if (answer === null || answer === undefined) return { index: null, heroPoint: false };
  if (typeof answer === 'number') return { index: answer, heroPoint: false };
  return { index: answer.index, heroPoint: answer.heroPoint };
}

// ---------------------------------------------------------------------------
// Melee attack (§7) and hero manoeuvres (§21.3)
// ---------------------------------------------------------------------------

interface AttackExtras {
  spearAgainstCharge?: boolean;
}

function rollAttack(ctx: Ctx, w: ResolvedWeapon, cl: ClResult): SkillRoll {
  const chain = w.kind === 'item' && !!w.def.chain;
  const roll = rollSkill(ctx.dice, cl.fv, cl.cl, ctx.rules.heroicFumble);
  // Chain weapons and whips: 18–20 is an automatic miss with fumble risk (§10.2).
  if (chain && roll.rolls[0] >= 18 && roll.outcome !== 'fumble' && roll.outcome !== 'perfect') {
    const check = roll.rolls[0] === 20 ? 20 : ctx.dice.d(20);
    roll.rolls.push(check);
    roll.outcome = check === 20 || check > cl.fv ? 'fumble' : 'failure';
  }
  return roll;
}

function autoOutcome(ctx: Ctx, a: Combatant, d: Combatant): { outcome: 'failure' | 'success' | null; noParry: boolean; why: string } {
  const r = ctx.state.round;
  const fail = activeConditions(a, r, 'autoFail')[0] ?? activeConditions(a, r, 'missNext')[0];
  if (fail) {
    useCondition(fail);
    return { outcome: 'failure', noParry: false, why: fail.text };
  }
  const hit = activeConditions(d, r, 'autoHitAgainst')[0];
  if (hit) {
    useCondition(hit);
    return { outcome: 'success', noParry: !!hit.noParry, why: hit.text };
  }
  return { outcome: null, noParry: false, why: '' };
}

const withMod = (cl: ClResult, mod: Mod): ClResult => ({ ...cl, mods: [...cl.mods, mod], cl: cl.cl + mod.value });

const MANEUVER_FV = { double: 21, triple: 31, lightning: 24, heroPainStrike: 23, breakWeapon: 21 } as const;

function* meleeAttack(ctx: Ctx, a: Combatant, choice: AttackChoice, extras: AttackExtras): CombatGenerator {
  const d = byId(ctx, choice.targetId);
  const w = resolveWeapon(a, choice.weapon);
  if (!w || !active(d) || squares(a.pos, d.pos) > w.reach) {
    log(ctx, `${a.sheet.name}'s attack is no longer possible.`, 'info', 1, a.id);
    return;
  }
  a.attackedThisRound = true;
  a.aimBonus = 0;
  // Coming from behind: does the defender notice the attacker? Then the attacker turns to strike.
  const unaware = ctx.rules.flanking && attackDirection(d, a.pos) === 'rear' ? sneakCheck(ctx, a, d) : false;
  reveal(ctx, a);
  reveal(ctx, d);
  faceTowards(a, d.pos);
  const loc = choice.location;
  const exposed = loc !== 'wild' && d.stance !== 'defensive' && d.blotta[a.id] === loc;
  const m = choice.maneuver;
  if (m && w.fv < MANEUVER_FV[m]) {
    log(ctx, `${a.sheet.name} lacks the skill for that manoeuvre.`, 'info', 1, a.id);
    return;
  }

  // Techniques are rolled first; a failed technique just gives no benefit (§12).
  const techs: string[] = [];
  let clBonus = 0;
  const techNotes: string[] = [];
  for (const id of choice.techniques ?? []) {
    const def = TECHNIQUES[id];
    const fv = techniqueFV(a, id);
    if (!def || fv <= 0 || a.techniquesUsed.includes(id) || !def.allowed(w)) continue;
    a.techniquesUsed.push(id);
    if (id === 'painStrike') clBonus -= 3; // the penalty applies whether or not the technique succeeds
    const roll = rollSkill(ctx.dice, fv, fv, ctx.rules.heroicFumble);
    const ok = isSuccess(roll.outcome);
    techNotes.push(`${def.name} ${fv}: ${roll.roll} ${ok ? '✔' : '✘'}`);
    if (!ok) continue;
    techs.push(id);
    if (id === 'thrust') clBonus += 3;
    if (id === 'lunge') clBonus += 2;
    if (id === 'predictOpening' && exposed) clBonus += 5;
    if (id === 'bindBlade' && (loc === 'leftArm' || loc === 'rightArm')) clBonus += 5;
  }

  if (m === 'breakWeapon') {
    yield* breakWeapon(ctx, a, d, w);
    return;
  }

  const strikes = m === 'triple' ? 3 : m === 'double' ? 2 : 1;
  if (strikes > 1) {
    a.techniquesUsed.push('multiStrike');
    log(ctx, `${a.sheet.name} unleashes a ${strikes === 3 ? 'triple' : 'double'} strike!`, 'info', 1, a.id);
  }
  // Double/triple strike: each attack starts from FV/2 or FV/3 (HH 819–864).
  const sw: ResolvedWeapon = strikes > 1 ? { ...w, fv: Math.floor(w.fv / strikes) } : w;
  for (let i = 0; i < strikes; i++) {
    if (!active(a) || !active(d)) break;
    yield* strike(ctx, a, d, sw, choice, extras, {
      clBonus: i === 0 ? clBonus : 0,
      techs: i === 0 ? techs : [],
      techNotes: i === 0 ? techNotes : [],
      exposed,
      heroPoint: i === 0 && !!choice.heroPoint,
      unaware,
    });
  }
}

interface StrikeOpts {
  clBonus: number;
  techs: string[];
  techNotes: string[];
  exposed: boolean;
  heroPoint: boolean;
  /** Attacked from behind by someone the defender hasn't noticed: no parry, backstabs apply. */
  unaware: boolean;
}

/**
 * Anfall bakifrån (II 1738–1756): the attacker rolls Smyga; on a success the defender rolls Upptäcka fara at
 * −(the attacker's differensvärde). Failing that, the defender hasn't noticed the attacker and can't parry.
 * 🔧 SIM-28: only a fighter that has been hidden since the start can sneak – once the enemy has seen it
 * (it has attacked, shot, cast or been attacked), it can't choose to steal up behind anyone.
 */
function sneakCheck(ctx: Ctx, a: Combatant, d: Combatant): boolean {
  if (!a.hidden) return false;
  const sn = sneakFV(a);
  if (sn.fv <= 0) return false;
  const sneak = rollSkill(ctx.dice, sn.fv, sn.fv, ctx.rules.heroicFumble);
  const diff = Math.max(0, sn.fv - sneak.roll);
  if (!isSuccess(sneak.outcome)) {
    log(ctx, `${a.sheet.name} tries to steal up behind ${d.sheet.name}: Smyga ${sn.fv}${sn.note}, rolled ${sneak.rolls.join('→')} – ${outcomeLabel(sneak.outcome)}; ${d.sheet.name} hears it coming.`, 'roll', 1, a.id);
    return false;
  }
  const sd = spotDangerCL(d);
  const cl = Math.max(sd.floor, sd.fv - diff);
  const spot = rollSkill(ctx.dice, sd.fv, cl, ctx.rules.heroicFumble);
  const unaware = !isSuccess(spot.outcome);
  log(
    ctx,
    `${a.sheet.name} steals up behind ${d.sheet.name}: Smyga ${sn.fv}${sn.note}, rolled ${sneak.rolls.join('→')} (difference ${diff}); ${d.sheet.name}'s Upptäcka fara CL ${cl}${sd.floor && cl === sd.floor ? ' (bounty hunter)' : ''}, rolled ${spot.rolls.join('→')} – ${unaware ? 'unaware, no parry!' : 'spots the danger.'}`,
    unaware ? 'hit' : 'roll',
    1,
    a.id,
  );
  return unaware;
}

function* strike(ctx: Ctx, a: Combatant, d: Combatant, w: ResolvedWeapon, choice: AttackChoice, extras: AttackExtras, o: StrikeOpts): CombatGenerator {
  const s = ctx.state;
  const loc = choice.location;
  const m = choice.maneuver;
  let cl = attackCL(ctx, a, d, w, loc);
  if (o.clBonus) cl = withMod(cl, { label: 'techniques', value: o.clBonus });
  if (m === 'lightning') cl = withMod(cl, { label: 'lightning attack', value: -10 });
  if (m === 'heroPainStrike') cl = withMod(cl, { label: 'heroic pain strike', value: -7 });
  for (const cond of cl.consumes) useCondition(cond);
  const pk = pairKey(a, d);
  if (!s.engaged.includes(pk)) s.engaged.push(pk);

  const target = loc === 'wild' ? 'a wild swing' : `the ${LOCATION_NAMES[loc].toLowerCase()}${o.exposed ? ' (exposed)' : ''}`;
  const auto = autoOutcome(ctx, a, d);
  let roll: SkillRoll;
  if (auto.outcome) {
    roll = { fv: cl.fv, cl: cl.cl, rolls: [], roll: 0, outcome: auto.outcome };
    log(ctx, `${a.sheet.name} attacks ${d.sheet.name} with ${w.name} at ${target}: automatic ${auto.outcome} (${auto.why}).`, auto.outcome === 'success' ? 'roll' : 'miss', 1, a.id);
  } else {
    roll = rollAttack(ctx, w, cl);
    log(
      ctx,
      `${a.sheet.name} attacks ${d.sheet.name} with ${w.name} at ${target}: ${describeCl(cl)}${o.techNotes.length ? ` [${o.techNotes.join('; ')}]` : ''}; rolled ${roll.rolls.join('→')} – ${outcomeLabel(roll.outcome)}.`,
      roll.outcome === 'fumble' ? 'fumble' : isSuccess(roll.outcome) ? 'roll' : 'miss',
      1,
      a.id,
    );
    if (o.heroPoint) spendHeroPoint(ctx, a, roll);
  }

  if (roll.outcome === 'fumble') {
    d.opponentFumbled = true;
    fumble(ctx, a, w.kind === 'unarmed' ? 'unarmed' : 'melee');
    return;
  }
  // The assassin's backstab: even a failed attack roll hits, for normal damage without SB (I 940–947).
  const assassin = o.unaware && a.sheet.profession === 'assassin' && w.kind !== 'unarmed';
  const stabbed = assassin && roll.outcome === 'failure';
  if (stabbed) log(ctx, `The blow lands anyway – ${a.sheet.name} strikes an unsuspecting back.`, 'hit', 2, a.id);
  if (roll.outcome === 'failure' && !stabbed) return; // (The rule that a parried miss can wear the attacker's weapon is not modelled.)

  const perfect = roll.outcome === 'perfect';
  const margin = Math.max(0, cl.cl - roll.roll);
  const pc: ParryContext = {
    wild: loc === 'wild',
    chain: w.kind === 'item' && !!w.def.chain,
    feint: o.techs.includes('feint'),
    kneeStrike: o.techs.includes('kneeStrike'),
    attackerActions: a.slots.length,
    penalty: m === 'lightning' && margin > 0 ? { label: 'vs lightning attack', value: -margin } : undefined,
  };
  const summary: AttackSummary = { attackerName: a.sheet.name, weaponName: w.name, location: loc, cl: cl.cl, roll: roll.roll, outcome: roll.outcome, ranged: false };

  let parryRoll: SkillRoll | null = null;
  let parryOpt: ParryOption | null = null;
  const parryAllowed = !auto.noParry && !o.unaware && (!perfect || ctx.rules.perfectAttackParry === 'perfectParry');
  if (parryAllowed) {
    const options = meleeParryOptions(ctx, d, a, w, pc);
    if (options.length) {
      const answer: ParryAnswer = yield {
        type: 'decision',
        request: { kind: 'parry', actorId: d.id, attackerId: a.id, attack: summary, options, mustParry: d.stance === 'defensive', heroPoints: d.hero?.points ?? 0 },
      };
      const pa = parseParry(answer);
      if (pa.index !== null && options[pa.index]?.source.kind === 'spell') {
        // SKÖLD: the casting roll is the parry; success parries automatically (§22.6).
        const src = options[pa.index].source as Extract<ParryOption['source'], { kind: 'spell' }>;
        useSlot(ctx, d, null);
        const stopped = castShieldParry(ctx, d, src.e, src.prepared, pa.heroPoint ? (r) => spendHeroPoint(ctx, d, r) : undefined, perfect);
        if (stopped) return;
        if (!active(d)) return;
      } else if (pa.index !== null && options[pa.index]) {
        parryOpt = options[pa.index];
        breakConcentration(ctx, d, 'parried instead');
        useSlot(ctx, d, parrySlotWeapon(parryOpt.source));
        for (const cond of parryOpt.cl.consumes) useCondition(cond);
        const autoFailParry = activeConditions(d, s.round, 'autoFail')[0];
        if (autoFailParry) {
          useCondition(autoFailParry);
          parryRoll = { fv: parryOpt.cl.fv, cl: parryOpt.cl.cl, rolls: [], roll: 0, outcome: 'failure' };
          log(ctx, `${d.sheet.name} tries to parry with ${parryOpt.name}: automatic failure (${autoFailParry.text}).`, 'miss', 1, d.id);
        } else {
          parryRoll = rollSkill(ctx.dice, parryOpt.cl.fv, parryOpt.cl.cl, ctx.rules.heroicFumble);
          log(
            ctx,
            `${d.sheet.name} parries with ${parryOpt.name}: ${describeCl(parryOpt.cl)}; rolled ${parryRoll.rolls.join('→')} – ${outcomeLabel(parryRoll.outcome)}.`,
            parryRoll.outcome === 'fumble' ? 'fumble' : isSuccess(parryRoll.outcome) ? 'roll' : 'miss',
            1,
            d.id,
          );
          if (pa.heroPoint) spendHeroPoint(ctx, d, parryRoll);
        }
      }
    }
  }

  const location: Location = loc === 'wild' ? randomLocation(ctx, d, RANDOM_MELEE) : loc;
  const dmgOptions: DamageOptions & { extraKp: number } = {
    melee: true,
    max: perfect || o.techs.includes('killingBlow'),
    maxSpOnly: o.techs.includes('painStrike'),
    extraKp: (o.techs.includes('strike') ? 2 : 0) + (o.techs.includes('lunge') ? 1 : 0),
    extraSp: (o.techs.includes('strike') ? 2 : 0) + (o.techs.includes('lunge') ? 1 : 0),
    bonusDice: extras.spearAgainstCharge && (d.derived.sb.count || d.derived.sb.mod) ? { label: "charger's SB", expr: d.derived.sb } : undefined,
  };
  const weaponDef = w.kind === 'item' ? w.def : null;
  if (o.unaware) {
    // Anfall bakifrån (KH 1128–1145): its FV is added to the damage of a small blade.
    const backstab = a.sheet.skills.backstab ?? 0;
    if (backstab > 0 && weaponDef && backstabWeapon(weaponDef.id, weaponDef.group)) dmgOptions.extraKp += backstab;
    if (assassin) Object.assign(dmgOptions, { noSB: true, weaponMultiplier: stabbed ? 1 : perfect ? 4 : 2 });
  }

  if (parryRoll && parryOpt) {
    if (perfect && parryRoll.outcome !== 'perfect') {
      log(ctx, 'Only a perfect parry can stop a perfect attack.', 'info', 2);
    } else if (parryRoll.outcome === 'perfect') {
      log(ctx, `${d.sheet.name}'s perfect parry stops the attack cleanly.`, 'miss', 2, d.id);
      return;
    } else if (parryRoll.outcome === 'success') {
      // Results table: roll damage for the BV check (§7.3).
      const dmg = rollDamage(ctx, a, w, dmgOptions);
      const src = parryOpt.source;
      if (src.kind !== 'item') {
        log(ctx, 'The attack is parried.', 'miss', 2, d.id);
        return;
      }
      const item = heldItem(d, src.hand)!;
      if (weaponDef?.noBvDamage || item.state.bv === null) {
        log(ctx, `Parried. (${w.name} can't damage a parrying weapon.)`, 'miss', 2, d.id);
        return;
      }
      if (dmg.kp > item.state.bv) {
        item.state.bv -= 1;
        log(ctx, `Parried, but the blow (${dmg.kp} KP) exceeds the ${item.def.name}'s BV – BV now ${item.state.bv}.`, 'status', 2, d.id);
        if (item.state.bv <= 0) {
          dropHand(ctx, d, src.hand, 'broken');
          log(ctx, `The blow goes through, one point weaker.`, 'hit', 2, d.id);
          yield* applyHit(ctx, {
            attacker: a,
            defender: d,
            location,
            dmg: { kp: Math.max(0, dmg.kp - 1), sp: Math.max(0, dmg.sp - 1), text: `${dmg.text}, −1` },
            perfect: false,
            exactRoll: false,
            weaponDef,
            interactive: true,
          });
          yield* afterHit(ctx, a, d, o.techs, m);
        }
      } else log(ctx, `Parried (blow ${dmg.kp} KP ≤ BV ${item.state.bv}).`, 'miss', 2, d.id);
      return;
    } else if (parryRoll.outcome === 'fumble') {
      fumble(ctx, d, parryOpt.source.kind === 'item' && heldItem(d, parryOpt.source.hand)?.def.kind === 'shield' ? 'shield' : parryOpt.source.kind === 'item' ? 'melee' : 'unarmed');
      if (!active(d)) return;
    }
  }

  // The attack hits. Kraftslag may turn it into maximum damage (HH 357).
  const power = !dmgOptions.max ? yield* offerPowerStrike(ctx, a, d) : false;
  const dmg = rollDamage(ctx, a, w, { ...dmgOptions, max: dmgOptions.max || power });
  if (perfect) log(ctx, `PERFECT HIT – maximum damage, armour doesn't absorb.`, 'critical', 2, a.id);
  yield* applyHit(ctx, { attacker: a, defender: d, location, dmg, perfect, exactRoll: roll.roll === cl.cl && roll.rolls.length === 1, weaponDef, interactive: true });
  yield* afterHit(ctx, a, d, o.techs, m);
}

function* offerPowerStrike(ctx: Ctx, a: Combatant, d: Combatant): Generator<Yielded, boolean, any> {
  if (!a.hero || !hasHero(a, 'powerStrike') || a.hero.powerStrikesLeft <= 0 || a.psy <= 0) return false;
  const yes: boolean = yield { type: 'decision', request: { kind: 'powerStrike', actorId: a.id, targetId: d.id, psy: a.psy, usesLeft: a.hero.powerStrikesLeft } };
  if (!yes) return false;
  const cost = ctx.dice.d(6);
  a.hero.powerStrikesLeft -= 1;
  if (cost > a.psy) {
    a.psy = 0;
    log(ctx, `${a.sheet.name} tries a power strike but lacks the strength of will (1T6 → ${cost} PSY).`, 'roll', 2, a.id);
    return false;
  }
  a.psy -= cost;
  log(ctx, `${a.sheet.name} puts everything into the blow – POWER STRIKE (1T6 → ${cost} PSY spent, ${a.psy} left): maximum damage.`, 'critical', 2, a.id);
  return true;
}

function* afterHit(ctx: Ctx, a: Combatant, d: Combatant, techs: string[], m?: string): CombatGenerator {
  if (techs.includes('lunge') && active(d)) d.noCounterOpp = ctx.state.opp;
  // Heroic pain strike: hard FYS roll or fall helpless this round and the next (HH 852).
  if (m === 'heroPainStrike' && active(d)) {
    const r = rollResistance(ctx.dice, d.sheet.attributes.FYS, SG.hard);
    if (r.success) log(ctx, `${d.sheet.name} withstands the pain (hard FYS roll ${r.roll ?? '–'} ≤ ${r.target}).`, 'roll', 2, d.id);
    else {
      log(ctx, `${d.sheet.name} collapses, whimpering (hard FYS roll ${r.roll ?? '–'} vs ${r.target}).`, 'status', 1, d.id);
      applyEffects(ctx, d, [{ t: 'prone', through: 1 }, { t: 'cannotAct', from: 0, through: 1 }], { source: 'heroic pain strike' });
    }
  }
  yield* lastStand(ctx, d);
  yield* lastStand(ctx, a);
}

/** Break weapon / hack through a shaft (HH 835–846): STY + (FV−6) vs BV + wielder's FV. */
function* breakWeapon(ctx: Ctx, a: Combatant, d: Combatant, w: ResolvedWeapon): CombatGenerator {
  const target = heldItem(d, 'main');
  if (!target) return;
  const cl = attackCL(ctx, a, d, w, 'wild', { label: 'break weapon', value: -6 });
  for (const cond of cl.consumes) useCondition(cond);
  const roll = rollAttack(ctx, w, cl);
  log(ctx, `${a.sheet.name} tries to hack through ${d.sheet.name}'s ${target.def.name}: ${describeCl(cl)}; rolled ${roll.rolls.join('→')} – ${outcomeLabel(roll.outcome)}.`, isSuccess(roll.outcome) ? 'roll' : 'miss', 1, a.id);
  const pk = pairKey(a, d);
  if (!ctx.state.engaged.includes(pk)) ctx.state.engaged.push(pk);
  if (roll.outcome === 'fumble') return fumble(ctx, a, 'melee');
  if (!isSuccess(roll.outcome)) return;
  const value = a.sheet.attributes.STY + w.fv - 6;
  const sg = (target.state.bv ?? 0) + (d.sheet.skills[target.state.def] ?? 0);
  const res = rollResistance(ctx.dice, value, sg);
  log(ctx, `STY + FV−6 = ${value} vs BV + FV = ${sg}: needs ${res.target}, rolled ${res.roll ?? '–'} – ${res.success ? 'the shaft splinters!' : 'it holds.'}`, res.success ? 'hit' : 'miss', 2, a.id);
  if (res.success) dropHand(ctx, d, 'main', 'broken');
}

/** Throw the sword (HH 848): up to 3 squares, −6 CL, normal damage, random location. */
function* throwSword(ctx: Ctx, a: Combatant, targetId: string, hand: 'main' | 'off'): CombatGenerator {
  const d = byId(ctx, targetId);
  faceTowards(a, d.pos);
  const w = resolveWeapon(a, hand);
  if (!w || w.kind !== 'item' || !active(d) || squares(a.pos, d.pos) > 3) return;
  a.attackedThisRound = true;
  const cl = attackCL(ctx, a, d, w, 'wild', { label: 'throw sword', value: -6 }, true);
  for (const cond of cl.consumes) useCondition(cond);
  a.items[w.key].status = 'thrown';
  a.hands[hand] = null;
  const roll = rollAttack(ctx, w, cl);
  log(ctx, `${a.sheet.name} hurls the ${w.def.name} at ${d.sheet.name}: ${describeCl(cl)}; rolled ${roll.rolls.join('→')} – ${outcomeLabel(roll.outcome)}.`, isSuccess(roll.outcome) ? 'roll' : 'miss', 1, a.id);
  if (roll.outcome === 'fumble') return fumble(ctx, a, 'ranged');
  if (!isSuccess(roll.outcome)) return;
  const perfect = roll.outcome === 'perfect';
  if (whirlwindDeflects(ctx, d, w.def)) return;
  const location = randomLocation(ctx, d, RANDOM_RANGED);
  const options = rangedParryOptions(ctx, d, a, true);
  if (!perfect && options.length) {
    const summary: AttackSummary = { attackerName: a.sheet.name, weaponName: w.def.name, location, cl: cl.cl, roll: roll.roll, outcome: roll.outcome, ranged: true };
    const answer: ParryAnswer = yield { type: 'decision', request: { kind: 'parry', actorId: d.id, attackerId: a.id, attack: summary, options, mustParry: false, heroPoints: d.hero?.points ?? 0 } };
    if (yield* missileParry(ctx, d, answer, options)) return;
    if (!active(d)) return;
  }
  const dmg = rollDamage(ctx, a, w, { melee: false, max: perfect });
  yield* applyHit(ctx, { attacker: a, defender: d, location, dmg, perfect, exactRoll: false, weaponDef: w.def, interactive: true });
  yield* lastStand(ctx, d);
}

function randomLocation(ctx: Ctx, d: Combatant, table: typeof RANDOM_MELEE): Location {
  const loc = lookup(table, ctx.dice.d(20));
  return d.fightingSide === 'left' ? mirror(loc) : loc;
}

// ---------------------------------------------------------------------------
// Ranged attack (§15.2)
// ---------------------------------------------------------------------------

function* rangedAttack(ctx: Ctx, a: Combatant, targetId: string, aimedAt: Location | null): CombatGenerator {
  const d = byId(ctx, targetId);
  faceTowards(a, d.pos);
  const w = rangedWeapon(a);
  const check = checkRanged(ctx, a, d);
  if (!w || !check.ok || !active(d)) {
    log(ctx, `${a.sheet.name} can't shoot: ${check.reason ?? 'no target'}.`, 'info', 1, a.id);
    return;
  }
  const cl = rangedCL(ctx, a, d, aimedAt);
  for (const cond of cl.consumes) useCondition(cond);
  a.shotThisRound = true;
  a.aimBonus = 0;
  const thrown = w.def.kind === 'thrown';
  if (w.def.ammo) a.ammo[w.def.ammo] -= 1;
  if (w.def.reload) {
    a.items[w.key].loaded = false;
    a.reloadLeft = 0;
  }
  if (thrown) {
    const st = a.items[w.key];
    st.count -= 1;
    if (st.count <= 0) {
      st.status = 'thrown';
      a.hands.main = null;
    }
  }

  const verb = thrown ? 'throws' : 'shoots';
  const target = aimedAt ? `the ${LOCATION_NAMES[aimedAt].toLowerCase()}` : 'the body';
  const auto = autoOutcome(ctx, a, d);
  let roll: SkillRoll;
  if (auto.outcome) {
    roll = { fv: cl.fv, cl: cl.cl, rolls: [], roll: 0, outcome: auto.outcome };
    log(ctx, `${a.sheet.name} ${verb} the ${w.def.name} at ${d.sheet.name}: automatic ${auto.outcome} (${auto.why}).`, 'roll', 1, a.id);
  } else {
    roll = rollSkill(ctx.dice, cl.fv, cl.cl, ctx.rules.heroicFumble);
    log(
      ctx,
      `${a.sheet.name} ${verb} the ${w.def.name} at ${d.sheet.name} (${target}, ${check.distanceM} m): ${describeCl(cl)}; rolled ${roll.rolls.join('→')} – ${outcomeLabel(roll.outcome)}.`,
      roll.outcome === 'fumble' ? 'fumble' : isSuccess(roll.outcome) ? 'roll' : 'miss',
      1,
      a.id,
    );
  }
  if (roll.outcome === 'fumble') return fumble(ctx, a, 'ranged');
  if (roll.outcome === 'failure') return;

  const perfect = roll.outcome === 'perfect';
  if (whirlwindDeflects(ctx, d, w.def)) return;
  const location = aimedAt ?? randomLocation(ctx, d, RANDOM_RANGED);
  const dmg = rollDamage(ctx, a, { kind: 'ranged', def: w.def }, { melee: false, max: perfect });

  // A shield facing the shooter catches projectiles aimed at the parts it covers (§16, SIM-9).
  const shield = heldItem(d, 'off');
  const shieldFacing = !ctx.rules.flanking || attackDirection(d, a.pos) !== 'rear';
  if (!perfect && shieldFacing && shield && shield.def.kind === 'shield' && shield.def.sty <= d.sheet.attributes.STY && coversLocation(d, shield.def.covers ?? [], location)) {
    log(ctx, `The ${w.def.name} strikes ${d.sheet.name}'s ${shield.def.name}, which covers the ${LOCATION_NAMES[location].toLowerCase()}.`, 'miss', 2, d.id);
    if (shield.state.bv !== null && dmg.kp > shield.state.bv) {
      shield.state.bv -= 1;
      log(ctx, `The ${shield.def.name}'s BV drops to ${shield.state.bv}.`, 'status', 2, d.id);
      if (shield.state.bv <= 0) dropHand(ctx, d, 'off', 'broken');
    }
    return;
  }

  if (!perfect) {
    const options = rangedParryOptions(ctx, d, a, thrown);
    if (options.length) {
      const summary: AttackSummary = { attackerName: a.sheet.name, weaponName: w.def.name, location, cl: cl.cl, roll: roll.roll, outcome: roll.outcome, ranged: true };
      const answer: ParryAnswer = yield { type: 'decision', request: { kind: 'parry', actorId: d.id, attackerId: a.id, attack: summary, options, mustParry: false, heroPoints: d.hero?.points ?? 0 } };
      if (yield* missileParry(ctx, d, answer, options, w.def.name)) return;
    }
  }
  if (!active(d)) return;
  if (perfect) log(ctx, `PERFECT HIT – maximum damage, armour doesn't absorb.`, 'critical', 2, a.id);
  yield* applyHit(ctx, { attacker: a, defender: d, location, dmg, perfect, exactRoll: roll.roll === cl.cl && roll.rolls.length === 1, weaponDef: w.def, pv: w.def.pv, interactive: true });
  yield* lastStand(ctx, d);
}

/** Parrying a thrown or shot missile (shared by throws and shots). Returns true when it is stopped. */
function* missileParry(ctx: Ctx, d: Combatant, answer: ParryAnswer, options: ParryOption[], missile?: string): Generator<Yielded, boolean, any> {
  const pa = parseParry(answer);
  const opt = pa.index !== null ? options[pa.index] : undefined;
  if (!opt) return false;
  const onRoll = pa.heroPoint ? (r: SkillRoll) => spendHeroPoint(ctx, d, r) : undefined;
  useSlot(ctx, d, parrySlotWeapon(opt.source));
  if (opt.source.kind === 'spell') return castShieldParry(ctx, d, opt.source.e, opt.source.prepared, onRoll);
  breakConcentration(ctx, d, 'parried instead');
  const pr = rollSkill(ctx.dice, opt.cl.fv, opt.cl.cl, ctx.rules.heroicFumble);
  log(ctx, `${d.sheet.name} tries to stop it with ${opt.name}: ${describeCl(opt.cl)}; rolled ${pr.rolls.join('→')} – ${outcomeLabel(pr.outcome)}.`, isSuccess(pr.outcome) ? 'roll' : 'miss', 1, d.id);
  onRoll?.(pr);
  if (isSuccess(pr.outcome)) {
    if (missile) log(ctx, `The ${missile} is ${opt.source.kind === 'projectileParry' ? 'deflected' : 'parried'}.`, 'miss', 2, d.id);
    return true;
  }
  if (pr.outcome === 'fumble') fumble(ctx, d, opt.source.kind === 'item' ? (heldItem(d, opt.source.hand)?.def.kind === 'shield' ? 'shield' : 'melee') : 'unarmed');
  return false;
}

function coversLocation(d: Combatant, covers: string[], loc: Location): boolean {
  const shieldArm = offArm(d);
  const shieldLeg: Location = shieldArm === 'leftArm' ? 'leftLeg' : 'rightLeg';
  return covers.some((c) => (c === 'shieldArm' && loc === shieldArm) || (c === 'shieldLeg' && loc === shieldLeg) || c === loc);
}

// ---------------------------------------------------------------------------
// Fumbles (§10.1)
// ---------------------------------------------------------------------------

function fumble(ctx: Ctx, c: Combatant, table: FumbleTable): void {
  for (const e of rollTable(ctx, FUMBLE_TABLES[table], 20)) {
    log(ctx, `Fumble (${FUMBLE_TABLE_NAMES[table]} table, 1T20 → ${e.roll}): ${e.text}`, 'fumble', 1, c.id);
    applyEffects(ctx, c, e.effects, { source: `fumble: ${e.text}` });
  }
}

// ---------------------------------------------------------------------------
// Heroes: suicide attack and psyching out (§21.4, §21.5)
// ---------------------------------------------------------------------------

/** HH 904–917: a fallen hero may rise for FYS/2 rounds with full KP, ignoring all but perfect hits, then die. */
function* lastStand(ctx: Ctx, c: Combatant): CombatGenerator {
  if (!c.hero || c.hero.lastStandUsed || c.status !== 'out' || c.outKind === 'dead' || c.noLastStand) return;
  const rounds = Math.max(1, Math.floor(c.sheet.attributes.FYS / 2));
  const yes: boolean = yield { type: 'decision', request: { kind: 'lastStand', actorId: c.id, reason: c.outReason ?? '', rounds } };
  c.hero.lastStandUsed = true;
  if (!yes) return;
  c.status = 'active';
  c.outKind = undefined;
  c.outReason = undefined;
  for (const l of Object.keys(c.kp) as Location[]) {
    c.kp[l].cur = c.kp[l].max;
    c.sp[l].cur = c.sp[l].max;
  }
  c.kpTotal.cur = c.kpTotal.max;
  c.spTotal.cur = c.spTotal.max;
  // Ordinary skill values again: wound effects are gone, except limbs that are physically ruined.
  c.conditions = c.conditions.filter((x) => x.kind === 'limbUnusable' && c.criticalLocations.includes(x.location!));
  c.bleeds = [];
  c.pendingLostActions = 0;
  for (const s of c.slots) if (!s.used && s.opp >= ctx.state.opp) s.lost = false;
  c.hero.lastStandUntil = ctx.state.round + rounds - 1;
  log(ctx, `${c.sheet.name} RISES AGAIN for a last stand – full strength for ${rounds} round${rounds === 1 ? '' : 's'}, ignoring all but perfect hits – then falls, never to rise again.`, 'critical', 1, c.id);
}

const PSYCH_SG: Record<number, number> = { 1: SG.easy, 2: SG.normal, 3: SG.hard, 4: SG.hard, 5: SG.veryHard };
const PSYCH_PENALTY: Record<number, number> = { 1: -2, 2: -3, 3: -4, 4: -5, 5: -7 };

/** HH 866–902: resolved at the end of a round spent psyching. */
function resolvePsyching(ctx: Ctx, hero: Combatant): void {
  if (!hero.hero || !active(hero)) return;
  const myStatus = hero.sheet.hero!.status + (hero.sheet.hero!.dark ? 1 : 0);
  for (const e of enemiesOf(ctx, hero)) {
    if (hero.hero.psyched.includes(e.id)) continue;
    hero.hero.psyched.push(e.id);
    if (hasHero(e, 'fearless')) {
      log(ctx, `${e.sheet.name} is fearless and unimpressed.`, 'info', 1, e.id);
      continue;
    }
    // Two heroes: only the difference in status counts.
    const theirs = e.sheet.hero ? e.sheet.hero.status + (e.sheet.hero.dark ? 1 : 0) : 0;
    const status = Math.min(5, myStatus - theirs);
    if (status <= 0) {
      log(ctx, status === 0 ? `${e.sheet.name} meets ${hero.sheet.name}'s stare as an equal.` : `${e.sheet.name} is not impressed – ${hero.sheet.name} is the lesser legend.`, 'info', 1, e.id);
      continue;
    }
    const sg = PSYCH_SG[status];
    const target = e.sheet.attributes.PSY - sg + 10;
    const roll = rollSkill(ctx.dice, Math.max(0, target), target, ctx.rules.heroicFumble);
    const text = `${e.sheet.name} faces ${hero.sheet.name}'s reputation (status ${status}): PSY ${e.sheet.attributes.PSY} vs SG ${sg} → CL ${target}, rolled ${roll.rolls.join('→')}`;
    if (roll.outcome === 'fumble') {
      e.noLastStand = true;
      log(ctx, `${text} – FUMBLE.`, 'fumble', 1, e.id);
      setOut(ctx, e, 'incapacitated', `throws down the weapon and flees from ${hero.sheet.name}`);
      continue;
    }
    let penalty = 0;
    if (!isSuccess(roll.outcome)) penalty = status === 4 && roll.roll - target > 5 ? -7 : PSYCH_PENALTY[status];
    else if (roll.roll === target && status === 4) penalty = -1;
    else if (roll.roll === target && status === 5) penalty = -3;
    if (penalty) {
      e.conditions.push({ kind: 'clMod', value: penalty, scope: 'all', fromRound: ctx.state.round, throughRound: FOREVER, text: `psyched out by ${hero.sheet.name}` });
      log(ctx, `${text} – shaken: ${penalty} CL for the rest of the fight.`, 'status', 1, e.id);
    } else log(ctx, `${text} – holds firm.`, 'roll', 1, e.id);
  }
}

// ---------------------------------------------------------------------------
// End of round and end of combat
// ---------------------------------------------------------------------------

function* endRound(ctx: Ctx): CombatGenerator {
  for (const c of ctx.state.combatants) if (c.hero?.psyching) resolvePsyching(ctx, c);
  for (const c of ctx.state.combatants) {
    if (c.status === 'out' && c.outKind === 'dead') continue;
    tickBurns(ctx, c);
    for (const b of c.bleeds) {
      b.counter += 1;
      if (b.counter % b.every === 0) {
        c.kpTotal.cur -= b.kp;
        log(ctx, `${c.sheet.name} bleeds ${b.kp} KP (total KP ${c.kpTotal.cur}).`, 'status', 1, c.id);
        breakConcentration(ctx, c, 'bleeding');
        if (c.status === 'active') checkThresholds(ctx, c);
        else if (c.kpTotal.cur <= -c.sheet.attributes.FYS) checkThresholds(ctx, c);
      }
    }
    yield* lastStand(ctx, c);
    if (c.hero?.lastStandUntil != null && ctx.state.round >= c.hero.lastStandUntil && c.status === 'active') {
      setOut(ctx, c, 'dead', 'the last strength is spent – collapses and dies');
    }
  }
  if (ctx.state.round >= ctx.rules.maxRounds && !ctx.state.over) {
    ctx.state.over = true;
    ctx.state.winner = null;
    log(ctx, `The fight is called off after ${ctx.state.round} rounds.`, 'heading', 0);
  }
}

export function checkEnd(ctx: Ctx): void {
  const s = ctx.state;
  if (s.over) return;
  const teams = new Set(s.combatants.filter(active).map((c) => c.team));
  if (teams.size <= 1) {
    s.over = true;
    s.winner = teams.size === 1 ? [...teams][0] : null;
    const winners = s.combatants.filter((c) => c.team === s.winner && active(c)).map((c) => c.sheet.name);
    log(ctx, winners.length ? `${winners.join(' and ')} win${winners.length === 1 ? 's' : ''} after ${s.round} round${s.round === 1 ? '' : 's'}.` : 'Nobody is left standing.', 'heading', 0);
  }
}
