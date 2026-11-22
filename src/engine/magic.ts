import { armourDef } from '../data/armour';
import { cellWord } from './grid';
import { isIron, itemDef } from '../data/items';
import { PROJECTILE_RESISTANCE, spellDef, type SpellDef } from '../data/spells';
import { lookup, RANDOM_RANGED } from '../data/tables';
import { armourAt, heldItem } from './character';
import { castingCL, describeCl, spellSkill, type ClResult } from './cl';
import { applyEffects, dropHand, useCondition } from './conditions';
import { applyHit, applyTotalDamage, runSilently, setOut } from './damage';
import { parseDice, rollDice } from './dice';
import { availablePsy, spendPsy } from './psy';
import { isSuccess, outcomeLabel, rollResistance, rollSkill, SG, type SkillRoll } from './skill';
import { activeSpell } from './spellEffects';
import { active, byId, log, metres, SQUARE_M, squares, visibleEnemiesOf, type Ctx } from './state';
import { canSee } from './terrain';
import type { Combatant, ItemDef, Location, MagicSchool } from './types';
import { LOCATION_NAMES, mirror } from './types';

/** Magic in the detailed combat system – combat-rules §22. */

/** 1 minute = 12 rounds of 5 seconds (II 1145). */
const ROUNDS_PER_MINUTE = 12;

// ---------------------------------------------------------------------------
// Who can cast what, how fast and how far (§22.1–22.3)
// ---------------------------------------------------------------------------

/** Why the combatant can't cast right now, or null (iron III 505–520, misfires, PSY). */
export function castBlock(c: Combatant): string | null {
  if (!c.sheet.magic) return 'knows no magic';
  if (c.magicLost) return c.magicLost;
  const ironWorn = [...new Set(Object.values(c.armour).flat())].map(armourDef).filter((p) => p.iron);
  if (ironWorn.length) return `wears iron (${ironWorn.map((p) => p.name).join(', ')})`;
  for (const hand of ['main', 'off'] as const) {
    const h = heldItem(c, hand);
    if (h && isIron(h.def)) return `holds iron (${h.def.name})`;
  }
  const carried = Object.values(c.items)
    .filter((it) => it.status === 'carried' && isIron(itemDef(it.def)))
    .reduce((sum, it) => sum + itemDef(it.def).weight * it.count, 0);
  if (carried > 0.5) return `carries ${carried} kg of iron (max 0.5 kg)`;
  if (availablePsy(c) <= 0) return 'no PSY left';
  return null;
}

/** Spells the combatant knows (S ≥ 1), in the order of the sheet. */
export function knownSpells(c: Combatant): SpellDef[] {
  return Object.keys(c.sheet.magic?.spells ?? {})
    .filter((id) => spellSkill(c, id) > 0)
    .map(spellDef);
}

/** Highest effect grade: the FV in the spell's school (III 98). */
export function maxEffect(c: Combatant, def: SpellDef): number {
  const schools = c.sheet.magic?.schools ?? {};
  return schools[def.school as MagicSchool] ?? 0;
}

/**
 * Actions to cast (MH 1893–1903): a normal spell takes 4 (2 to prepare, 2 to cast), a quick spell 2 (1 + 1).
 * With S above 30 a normal spell counts as quick, and a quick spell takes a single action.
 */
export function castActions(def: SpellDef, s: number): number {
  if (def.quick && s > 30) return 1;
  return def.quick || s > 30 ? 2 : 4;
}

/** Range in squares (III 380–400; 1 square = 1.5 m). */
export function rangeSquares(def: SpellDef, s: number): number {
  switch (def.range) {
    case 'personal':
      return 0;
    case 'touch':
      return 1;
    case 'short':
      return Math.floor(s / 2);
    case 'sx2':
      return s * 2;
    case 'long':
      return s * 10;
    case 'sx10m':
      return Math.floor((s * 10) / SQUARE_M);
  }
}

function durationRounds(ctx: Ctx, def: SpellDef, s: number): number {
  switch (def.duration) {
    case 'sxSR':
      return s;
    case 'sxMin':
      return s * ROUNDS_PER_MINUTE;
    case '1T3min':
      return ctx.dice.d(3) * ROUNDS_PER_MINUTE;
    default:
      return 1;
  }
}

/** PSY spent (III 192–212): E on a success, half (in the caster's favour, min 1) on a perfect, 1 on a failure, E on a fumble. */
export function psyCost(outcome: SkillRoll['outcome'], e: number): number {
  if (outcome === 'perfect') return Math.max(1, Math.floor(e / 2));
  if (outcome === 'failure') return 1;
  return e;
}

/** Max E for a suicide spell: remaining PSY plus half the normal PSY (III 225–240). Needs PSY left. */
export function suicideMaxE(c: Combatant): number {
  if (c.psy <= 0) return 0;
  return availablePsy(c) + Math.floor(c.psyMax / 2);
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export interface SpellTarget {
  targetId?: string;
  /** Aimed spells ("magikern kan rikta"): the location chosen; default the head. */
  location?: Location;
  /** Item spells: the hand holding the item. */
  item?: 'main' | 'off';
}

export interface SpellTargetOption {
  target: SpellTarget;
  label: string;
}

const isAimable = (def: SpellDef) => def.damage?.mode === 'aimed';

/** Item a spell can work on: weapons and shields (KNÄCKA needs a BV; bows count as BV 10). */
function itemTargetable(def: SpellDef, it: ItemDef): boolean {
  if (def.kind === 'shatter') return it.bv !== null || it.kind === 'projectile';
  return it.kind !== 'projectile' || def.kind === 'weapon';
}

export function spellTargets(ctx: Ctx, c: Combatant, def: SpellDef): SpellTargetOption[] {
  const range = rangeSquares(def, spellSkill(c, def.id));
  const out: SpellTargetOption[] = [];
  switch (def.targeting) {
    case 'self':
      return [{ target: {}, label: 'yourself' }];
    case 'enemy':
      for (const e of visibleEnemiesOf(ctx, c)) {
        if (squares(c.pos, e.pos, ctx.state.grid) <= range && canSee(ctx.state.map, ctx.state.grid, c.pos, e.pos)) out.push({ target: { targetId: e.id }, label: `${e.sheet.name} (${metres(c.pos, e.pos, ctx.state.grid)} m)` });
      }
      return out;
    case 'enemyItem':
      for (const e of visibleEnemiesOf(ctx, c)) {
        if (squares(c.pos, e.pos, ctx.state.grid) > range || !canSee(ctx.state.map, ctx.state.grid, c.pos, e.pos)) continue;
        for (const hand of ['main', 'off'] as const) {
          const h = heldItem(e, hand);
          if (h && itemTargetable(def, h.def)) out.push({ target: { targetId: e.id, item: hand }, label: `${e.sheet.name}'s ${h.def.name}${h.state.bv !== null ? ` (BV ${h.state.bv})` : ''}` });
        }
      }
      return out;
    case 'ownItem':
      for (const hand of ['main', 'off'] as const) {
        const h = heldItem(c, hand);
        if (h && itemTargetable(def, h.def)) out.push({ target: { item: hand }, label: `your ${h.def.name}` });
      }
      return out;
  }
}

function describeTarget(ctx: Ctx, c: Combatant, def: SpellDef, t: SpellTarget): string {
  if (def.targeting === 'self') return '';
  if (def.targeting === 'ownItem') return ` on the ${heldItem(c, t.item ?? 'main')?.def.name ?? 'weapon'}`;
  const who = t.targetId ? byId(ctx, t.targetId) : null;
  if (!who) return '';
  if (def.targeting === 'enemyItem') return ` at ${who.sheet.name}'s ${heldItem(who, t.item ?? 'main')?.def.name ?? 'weapon'}`;
  const loc = isAimable(def) ? ` (${LOCATION_NAMES[t.location ?? 'head'].toLowerCase()})` : '';
  return ` at ${who.sheet.name}${loc}`;
}

// ---------------------------------------------------------------------------
// Options offered to the human and the AI
// ---------------------------------------------------------------------------

export interface SpellOption {
  id: string;
  name: string;
  sv: string;
  description: string;
  s: number;
  /** Actions the whole casting takes. */
  actions: number;
  /** Highest E allowed now (school FV and PSY). */
  maxE: number;
  /** Highest E for a suicide spell (0 = not possible). */
  suicideMaxE: number;
  /** Casting CL for E = 1 … max(maxE, suicideMaxE) (index E − 1). */
  cls: ClResult[];
  /** Valid targets right now (chosen when the spell is released). */
  targets: SpellTargetOption[];
  aimable: boolean;
  /** SKÖLD: prepared on your turn, released only as a parry. */
  reactionOnly: boolean;
  physical: boolean;
}

export interface CastingInfo {
  spell: string;
  name: string;
  sv: string;
  e: number;
  done: number;
  total: number;
  suicide: boolean;
  /** Only the releasing action is left. */
  ready: boolean;
  reactionOnly: boolean;
  targets: SpellTargetOption[];
  aimable: boolean;
  cl: ClResult;
}

export interface MagicOptions {
  /** Why no new spell can be started (iron, no PSY, …). */
  blocked: string | null;
  spells: SpellOption[];
  casting: CastingInfo | null;
  psy: number;
  staffPsy: number | null;
}

export function castingInfo(ctx: Ctx, c: Combatant): CastingInfo | null {
  const k = c.casting;
  if (!k) return null;
  const def = spellDef(k.spell);
  return {
    spell: def.id,
    name: def.name,
    sv: def.sv,
    e: k.e,
    done: k.done,
    total: k.total,
    suicide: k.suicide,
    ready: k.done >= k.total - 1,
    reactionOnly: def.kind === 'shield',
    targets: spellTargets(ctx, c, def),
    aimable: isAimable(def),
    cl: castingCL(ctx, c, def.id, k.e, k.suicide),
  };
}

export function magicOptions(ctx: Ctx, c: Combatant): MagicOptions | null {
  if (!c.sheet.magic) return null;
  const blocked = castBlock(c);
  const spells: SpellOption[] = [];
  if (!blocked) {
    for (const def of knownSpells(c)) {
      const s = spellSkill(c, def.id);
      const actions = castActions(def, s);
      // An instant SKÖLD is only ever cast as a parry.
      if (def.kind === 'shield' && actions === 1) continue;
      const cap = maxEffect(c, def);
      const maxE = Math.min(cap, availablePsy(c));
      const sMax = def.kind === 'shield' ? 0 : Math.min(cap, suicideMaxE(c));
      if (maxE < 1) continue;
      const cls = Array.from({ length: Math.max(maxE, sMax) }, (_, i) => castingCL(ctx, c, def.id, i + 1));
      spells.push({
        id: def.id,
        name: def.name,
        sv: def.sv,
        description: def.description,
        s,
        actions,
        maxE,
        suicideMaxE: sMax > maxE ? sMax : 0,
        cls,
        targets: spellTargets(ctx, c, def),
        aimable: isAimable(def),
        reactionOnly: def.kind === 'shield',
        physical: def.physical,
      });
    }
  }
  return { blocked, spells, casting: castingInfo(ctx, c), psy: c.psy, staffPsy: c.staffPsy?.cur ?? null };
}

/** SKÖLD as a parry: a prepared shield, or an instant one with S above 30 (E1). */
export function shieldParry(ctx: Ctx, d: Combatant): { e: number; cl: ClResult; prepared: boolean } | null {
  const k = d.casting;
  if (k) {
    if (k.spell !== 'shield' || k.done < k.total - 1) return null;
    return { e: k.e, cl: castingCL(ctx, d, 'shield', k.e, k.suicide), prepared: true };
  }
  const s = spellSkill(d, 'shield');
  if (s <= 0 || castBlock(d) || castActions(spellDef('shield'), s) !== 1) return null;
  return { e: 1, cl: castingCL(ctx, d, 'shield', 1), prepared: false };
}

export const shieldBV = (e: number) => 4 + 2 * (e - 1);

// ---------------------------------------------------------------------------
// Casting (§22.2–22.4)
// ---------------------------------------------------------------------------

export interface CastRequest {
  spell: string;
  e: number;
  suicide: boolean;
}

/** Roll the casting, pay PSY and log it. `onRoll` may raise the outcome with a hero point. */
function castRoll(ctx: Ctx, c: Combatant, req: CastRequest, what: string, onRoll?: (r: SkillRoll) => void): SkillRoll {
  const def = spellDef(req.spell);
  const cl = castingCL(ctx, c, def.id, req.e, req.suicide);
  for (const cond of cl.consumes) useCondition(cond);
  const roll = rollSkill(ctx.dice, cl.fv, cl.cl, ctx.rules.heroicFumble);
  log(
    ctx,
    `${c.sheet.name} ${what} ${def.sv} E${req.e}: ${describeCl(cl)}; rolled ${roll.rolls.join('→')} – ${outcomeLabel(roll.outcome)}.`,
    roll.outcome === 'fumble' ? 'fumble' : isSuccess(roll.outcome) ? 'roll' : 'miss',
    1,
    c.id,
  );
  onRoll?.(roll);
  const cost = psyCost(roll.outcome, req.e);
  const why = roll.outcome === 'perfect' ? 'perfect – half cost' : roll.outcome === 'failure' ? 'a failed spell still costs 1' : roll.outcome === 'fumble' ? 'fumbled – full cost' : `E${req.e}`;
  const paid = spendPsy(c, cost);
  log(ctx, `PSY spent: ${paid} (${why}) – ${c.psy} PSY left${c.staffPsy ? `, staff ${c.staffPsy.cur}` : ''}.`, 'info', 2, c.id);
  return roll;
}

/** PSY below zero kills the caster (III 225). */
function checkBurnout(ctx: Ctx, c: Combatant): void {
  if (c.psy < 0 && !(c.status === 'out' && c.outKind === 'dead')) setOut(ctx, c, 'dead', `the soul burns out (PSY ${c.psy})`);
}

/**
 * The releasing action: roll, pay PSY and apply the effect. Returns everyone affected (for suicide attacks and
 * the end-of-fight check).
 */
export function releaseSpell(ctx: Ctx, c: Combatant, req: CastRequest, target: SpellTarget, onRoll?: (r: SkillRoll) => void): Combatant[] {
  const def = spellDef(req.spell);
  c.casting = null;
  const roll = castRoll(ctx, c, req, `releases`, onRoll);
  let affected: Combatant[] = [];
  if (isSuccess(roll.outcome)) {
    log(ctx, `${def.sv}${describeTarget(ctx, c, def, target)}:`, 'info', 2, c.id);
    affected = applySpell(ctx, c, def, req.e, target, {});
  } else if (roll.outcome === 'fumble') affected = misfire(ctx, c, def, req.e, target);
  else log(ctx, 'The magic fizzles.', 'miss', 2, c.id);
  checkBurnout(ctx, c);
  return [...new Set([c, ...affected])];
}

/** SKÖLD released as a parry (III 1370): success parries automatically. Returns whether the attack is stopped. */
export function castShieldParry(ctx: Ctx, d: Combatant, e: number, prepared: boolean, onRoll?: (r: SkillRoll) => void, againstPerfect = false): boolean {
  const suicide = prepared && !!d.casting?.suicide;
  d.casting = null;
  const roll = castRoll(ctx, d, { spell: 'shield', e, suicide }, prepared ? 'releases the prepared' : 'snaps up', onRoll);
  checkBurnout(ctx, d);
  if (againstPerfect && roll.outcome !== 'perfect' && isSuccess(roll.outcome)) {
    log(ctx, 'Only a perfect parry can stop a perfect attack – the blow smashes through the shield.', 'info', 2, d.id);
    return false;
  }
  if (isSuccess(roll.outcome)) {
    log(ctx, `The air hardens into a shield (BV ${shieldBV(e)}) and turns the blow aside.`, 'miss', 2, d.id);
    return true;
  }
  if (roll.outcome === 'fumble') misfire(ctx, d, spellDef('shield'), e, {});
  return false;
}

// ---------------------------------------------------------------------------
// Spell effects (§22.5–22.6)
// ---------------------------------------------------------------------------

interface ApplyOpts {
  /** Misfire 12–15: the caster is bewitched without any resistance. */
  noResist?: boolean;
}

function randomLocation(ctx: Ctx, d: Combatant): Location {
  const loc = lookup(RANDOM_RANGED, ctx.dice.d(20));
  return d.fightingSide === 'left' ? mirror(loc) : loc;
}

/** PSY against PSY for spells that work on the mind (III 246–260): the caster's PSY after paying vs the target's. */
function resisted(ctx: Ctx, c: Combatant, d: Combatant, def: SpellDef, o: ApplyOpts): boolean {
  if (def.physical || o.noResist || c === d) return false;
  const r = rollResistance(ctx.dice, Math.max(0, c.psy), Math.max(0, d.psy));
  const text = `PSY ${Math.max(0, c.psy)} vs ${d.sheet.name}'s PSY ${Math.max(0, d.psy)}: needs ${r.target}, rolled ${r.roll ?? '–'}`;
  if (r.success) log(ctx, `${text} – the spell takes hold.`, 'roll', 2, c.id);
  else log(ctx, `${text} – ${d.sheet.name} resists.`, 'miss', 2, d.id);
  return !r.success;
}

function areaVictims(ctx: Ctx, centre: Combatant, radiusSq: number): Combatant[] {
  // Walls shelter whoever is behind them.
  return ctx.state.combatants.filter(
    (x) => active(x) && squares(x.pos, centre.pos, ctx.state.grid) <= radiusSq && (x === centre || canSee(ctx.state.map, ctx.state.grid, centre.pos, x.pos)),
  );
}

function rollSpellDice(ctx: Ctx, e: number, sides: number): { total: number; text: string } {
  const r = rollDice(ctx.dice, { count: e, sides, mod: 0 });
  return { total: r.total, text: `${e}T${sides} [${r.rolls.join(',')}] = ${r.total}` };
}

export function applySpell(ctx: Ctx, c: Combatant, def: SpellDef, e: number, target: SpellTarget, o: ApplyOpts): Combatant[] {
  const r = ctx.state.round;
  const s = spellSkill(c, def.id);
  const victim = target.targetId ? byId(ctx, target.targetId) : c;
  switch (def.kind) {
    case 'damage':
    case 'explosion':
      return spellDamage(ctx, c, def, e, victim, target.location ?? 'head', o);

    case 'shield':
      // Only released as a parry; reaching here means a misfire turned it into nothing.
      return [];

    case 'flamingHand': {
      const rounds = durationRounds(ctx, def, s);
      c.activeSpells.push({ kind: 'flamingHand', value: e, throughRound: r + rounds - 1, name: `${def.sv} E${e}` });
      log(ctx, `${c.sheet.name}'s hand bursts into flame: +${e}T3 KP and SP on blows for ${rounds} rounds.`, 'info', 2, c.id);
      return [];
    }

    case 'whirlwind': {
      const rounds = durationRounds(ctx, def, s);
      c.activeSpells.push({ kind: 'whirlwind', value: e, throughRound: r + rounds - 1, name: `${def.sv} E${e}` });
      log(ctx, `A howling whirlwind wraps around ${c.sheet.name} for ${rounds} rounds – projectiles must beat E${e}.`, 'info', 2, c.id);
      return [];
    }

    case 'coldHand': {
      if (resisted(ctx, c, victim, def, o)) return [];
      const fys = rollResistance(ctx.dice, victim.sheet.attributes.FYS, SG.hard);
      const text = `hard FYS roll ${fys.roll ?? '–'} vs ${fys.target}`;
      if (fys.success) {
        log(ctx, `${victim.sheet.name} shudders with cold (${text}): −4 CL on everything this round.`, 'status', 2, victim.id);
        applyEffects(ctx, victim, [{ t: 'clMod', value: -4, scope: 'all', span: { from: 0, through: 0 } }], { source: `${def.sv}: chilled` });
      } else {
        log(ctx, `${victim.sheet.name} is racked by cold shivers (${text}) and can do nothing more this round.`, 'status', 1, victim.id);
        applyEffects(ctx, victim, [{ t: 'cannotAct', from: 0, through: 0 }], { source: `${def.sv}: frozen stiff` });
      }
      return [victim];
    }

    case 'weapon': {
      const owner = def.targeting === 'ownItem' ? c : victim;
      const hand = target.item ?? 'main';
      const held = heldItem(owner, hand);
      if (!held) {
        log(ctx, 'There is no weapon there for the spell to take hold of.', 'miss', 2, c.id);
        return [];
      }
      const rounds = durationRounds(ctx, def, s);
      const value = def.targeting === 'ownItem' ? e : -e;
      owner.activeSpells.push({ kind: 'weapon', value, itemKey: held.key, throughRound: r + rounds - 1, name: `${def.sv} E${e}` });
      log(ctx, `${owner.sheet.name}'s ${held.def.name} is ${value > 0 ? 'enchanted' : 'cursed'}: ${value > 0 ? '+' : '−'}${e} CL and damage for ${rounds} rounds.`, value > 0 ? 'info' : 'status', 2, owner.id);
      return owner === c ? [] : [owner];
    }

    case 'shatter': {
      const hand = target.item ?? 'main';
      const held = heldItem(victim, hand);
      if (!held) {
        log(ctx, 'There is no weapon there to shatter.', 'miss', 2, c.id);
        return [];
      }
      const before = held.state.bv ?? 10; // projectile weapons count as BV 10 (III 1507)
      const loss = 10 + 2 * (e - 1);
      held.state.bv = before - loss;
      log(ctx, `${victim.sheet.name}'s ${held.def.name} cracks: BV ${before} − ${loss} = ${held.state.bv}.`, 'status', 2, victim.id);
      if (held.state.bv <= 0) dropHand(ctx, victim, hand, 'broken');
      return [victim];
    }

    case 'breathless': {
      if (resisted(ctx, c, victim, def, o)) return [];
      const how = def.id === 'drown' ? 'its lungs fill with water' : 'the air is torn from its lungs';
      setOut(ctx, victim, 'incapacitated', `${def.sv}: ${how} – helpless, it will pass out within two minutes`);
      return [victim];
    }
  }
}

function spellDamage(ctx: Ctx, c: Combatant, def: SpellDef, e: number, centre: Combatant, aimedAt: Location, o: ApplyOpts): Combatant[] {
  const spec = def.damage!;
  const radius = spec.area ? Math.floor(e / SQUARE_M) : 0;
  // EXPLOSION hurts everybody on the field, one point less per square beyond the blast radius.
  const victims = def.kind === 'explosion' ? ctx.state.combatants.filter(active) : spec.area ? areaVictims(ctx, centre, radius) : [centre];
  if (spec.area && def.kind !== 'explosion') log(ctx, `It strikes everything within ${e} m (${radius} ${cellWord(ctx.state.grid, radius)}) of ${centre.sheet.name}.`, 'info', 2, c.id);
  const hit: Combatant[] = [];
  for (const v of victims) {
    if (!active(v)) continue;
    if (resisted(ctx, c, v, def, o)) continue;
    hit.push(v);
    if (spec.flatPerE) {
      const beyond = Math.max(0, squares(v.pos, centre.pos, ctx.state.grid) - radius);
      const dmg = Math.max(0, spec.flatPerE * e - beyond);
      if (dmg <= 0) continue;
      applyTotalDamage(ctx, v, dmg, dmg, `${def.sv} ${spec.flatPerE}×E${e}${beyond ? ` − ${beyond} for distance` : ''} = ${dmg}`);
      continue;
    }
    const kp = rollSpellDice(ctx, e, spec.sides);
    const sp = rollSpellDice(ctx, e, spec.sides);
    const text = `${def.sv}: KP ${kp.text}, SP ${sp.text}`;
    if (spec.mode === 'total') {
      applyTotalDamage(ctx, v, kp.total, sp.total, text, spec.armour ? armourAt(v, 'chest') : undefined);
    } else {
      const loc = spec.mode === 'aimed' ? aimedAt : randomLocation(ctx, v);
      runSilently(applyHit(ctx, { attacker: c, defender: v, location: loc, dmg: { kp: kp.total, sp: sp.total, text }, perfect: false, exactRoll: false, weaponDef: null, interactive: false, magic: true }));
    }
    if (spec.burn && active(v)) {
      const rounds = rollDice(ctx.dice, parseDice(spec.burn.rounds)).total;
      v.burns.push({ dice: spec.burn.dice, fromRound: ctx.state.round + 1, throughRound: ctx.state.round + rounds, source: def.sv });
      log(ctx, `${v.sheet.name} is burning: ${spec.burn.dice} a round for ${rounds} round${rounds === 1 ? '' : 's'}.`, 'status', 2, v.id);
    }
  }
  if (def.kind === 'explosion') {
    // Everyone who sees the flash is blinded next round; the caster knows to look away (🔧 SIM-25).
    for (const v of ctx.state.combatants.filter((x) => active(x) && x !== c)) {
      applyEffects(ctx, v, [{ t: 'clMod', value: -15, scope: 'all', span: { from: 1, through: 1 } }], { source: 'blinded by the explosion' });
    }
    log(ctx, 'The flash blinds everyone who saw it: −15 CL next round (as in darkness).', 'status', 2, c.id);
  }
  return hit;
}

/** End of round: fire keeps burning (ELDKLOT, INRE ELD) – total KP and SP, no armour (🔧 SIM-24). */
export function tickBurns(ctx: Ctx, c: Combatant): void {
  const r = ctx.state.round;
  for (const b of c.burns) {
    if (b.fromRound > r || b.throughRound < r || c.status === 'out') continue;
    const kp = rollDice(ctx.dice, parseDice(b.dice));
    const sp = rollDice(ctx.dice, parseDice(b.dice));
    applyTotalDamage(ctx, c, kp.total, sp.total, `burning (${b.source}): KP ${b.dice} [${kp.rolls.join(',')}], SP ${b.dice} [${sp.rolls.join(',')}]`);
  }
  c.burns = c.burns.filter((b) => b.throughRound > r);
}

// ---------------------------------------------------------------------------
// Misfires – Snedtändningstabellen (III 556–570)
// ---------------------------------------------------------------------------

export function misfire(ctx: Ctx, c: Combatant, def: SpellDef, e: number, target: SpellTarget): Combatant[] {
  const d = ctx.dice.d(20);
  const r = d + e;
  const head = `MISFIRE (1T20 ${d} + E${e} = ${r})`;
  if (r <= 5) {
    const half = Math.ceil(e / 2);
    log(ctx, `${head}: the spell goes off at half strength (E${half}).`, 'fumble', 1, c.id);
    return applySpell(ctx, c, def, half, target, {});
  }
  if (r <= 11) {
    log(ctx, `${head}: the magic surges back through the caster.`, 'fumble', 1, c.id);
    applyTotalDamage(ctx, c, e, 0, `misfire: ${e} KP`);
    setOut(ctx, c, 'unconscious', 'knocked senseless by misfiring magic (1T8 minutes)');
    return [];
  }
  if (r <= 15) {
    if (def.harmful) {
      log(ctx, `${head}: the spell turns on the caster with full force!`, 'fumble', 1, c.id);
      const self: SpellTarget = { targetId: c.id, location: target.location, item: heldItem(c, 'main') ? 'main' : 'off' };
      return applySpell(ctx, c, def, e, self, { noResist: true });
    }
    log(ctx, `${head}: the energy tears through the caster, who collapses blinded.`, 'fumble', 1, c.id);
    applyTotalDamage(ctx, c, e, 0, `misfire: ${e} KP`);
    setOut(ctx, c, 'unconscious', 'struck down and blinded by misfiring magic');
    return [];
  }
  if (r <= 17) {
    c.magicLost = 'struck dumb by a misfire (1T8 days)';
    log(ctx, `${head}: ${c.sheet.name} is struck dumb and can cast no more spells.`, 'fumble', 1, c.id);
    return [];
  }
  if (r === 18) {
    log(ctx, `${head}: paralysis.`, 'fumble', 1, c.id);
    setOut(ctx, c, 'incapacitated', 'paralysed by a misfire (1T8 days)');
    return [];
  }
  if (r === 19) {
    const n = ctx.dice.d(4);
    const known = knownSpells(c).map((x) => x.id);
    const lost: string[] = [];
    for (let i = 0; i < n && known.length; i++) lost.push(known.splice(ctx.dice.d(known.length) - 1, 1)[0]);
    c.forgottenSpells.push(...lost);
    log(ctx, `${head}: brain damage – INT −${n} and ${lost.length ? `the spells ${lost.map((x) => spellDef(x).sv).join(', ')} are` : 'nothing more is'} forgotten.`, 'fumble', 1, c.id);
    return [];
  }
  log(ctx, `${head}: total loss of memory.`, 'fumble', 1, c.id);
  setOut(ctx, c, 'incapacitated', 'total loss of memory from a misfire – babbles like an idiot');
  return [];
}

// ---------------------------------------------------------------------------
// VIRVELSKÖLD against projectiles (III 1546–1584)
// ---------------------------------------------------------------------------

export function whirlwindDeflects(ctx: Ctx, d: Combatant, projectile: ItemDef): boolean {
  const w = activeSpell(d, 'whirlwind', ctx.state.round);
  if (!w) return false;
  const value = (projectile.ammo ? PROJECTILE_RESISTANCE[projectile.ammo] : PROJECTILE_RESISTANCE[projectile.id]) ?? 5;
  const r = rollResistance(ctx.dice, w.value, value);
  const text = `${d.sheet.name}'s whirlwind (E${w.value}) vs ${projectile.name} (${value}): needs ${r.target}, rolled ${r.roll ?? '–'}`;
  log(ctx, r.success ? `${text} – blown aside!` : `${text} – it gets through.`, r.success ? 'miss' : 'roll', 2, d.id);
  return r.success;
}
