import { CRIT_ABDOMEN, CRIT_ARMS, CRIT_CHEST, CRIT_HEAD, CRIT_LEGS, CRIT_LIMB_DOUBLE } from '../data/criticals';
import { GLANCE_ON, lookup, RANDOM_MELEE } from '../data/tables';
import { armourAt, effectiveSMI, hasHero, needsTwoHands, twoHandedGrip } from './character';
import { applyEffects, FOREVER, loseActions, makeLimbUnusable, rollTable } from './conditions';
import { describeRoll, maxDice, parseDice, rollDice, type DiceExpr } from './dice';
import { meleeWeapons, type ResolvedWeapon } from './cl';
import type { Yielded } from './combat';
import { breakConcentration } from './psy';
import { activeSpell, weaponSpellMod } from './spellEffects';
import { rollResistance, rollSkill, SG, isSuccess } from './skill';
import { log, type Ctx } from './state';
import type { Combatant, ItemDef, Location, OutKind, TableEntry } from './types';
import { isArm, isLeg, isLimb, LOCATION_NAMES } from './types';

// ---------------------------------------------------------------------------
// Rolling damage (§8.1)
// ---------------------------------------------------------------------------

export interface DamageRoll {
  kp: number;
  sp: number;
  text: string;
}

export interface DamageOptions {
  max?: boolean;
  /** Melee attacks add SB (thrown and projectile weapons don't). */
  melee: boolean;
  extraKp?: number;
  extraSp?: number;
  /** Extra damage dice from the situation, e.g. a spear set against a charge adds the target's SB. */
  bonusDice?: { label: string; expr: DiceExpr };
  doubleSB?: boolean;
  maxSpOnly?: boolean;
  /** Item key of a ranged weapon (for weapon spells); melee items are known from the weapon. */
  weaponKey?: string;
}

function part(ctx: Ctx, label: string, expr: DiceExpr, max: boolean): { total: number; text: string } {
  if (expr.count === 0 && expr.mod === 0) return { total: 0, text: '' };
  if (max) return { total: maxDice(expr), text: `${label} max ${maxDice(expr)}` };
  const r = rollDice(ctx.dice, expr);
  return { total: r.total, text: `${label} ${describeRoll(r)}` };
}

export function weaponDamageDice(w: ResolvedWeapon | { kind: 'ranged'; def: ItemDef }): { kp: DiceExpr; sp: DiceExpr } {
  if (w.kind === 'unarmed') return { kp: parseDice(w.ua.kp), sp: parseDice(w.ua.sp) };
  return { kp: parseDice(w.def.kp), sp: parseDice(w.def.sp) };
}

export function rollDamage(ctx: Ctx, a: Combatant, w: ResolvedWeapon | { kind: 'ranged'; def: ItemDef }, o: DamageOptions): DamageRoll {
  // Wielding a one-handed weapon with both hands: +1T2 (III 2709), or the weapon's own two-handed row (katana).
  const twoHandGrip = o.melee && w.kind === 'item' && w.hand === 'main' && twoHandedGrip(a) && !needsTwoHands(a, w.def);
  const ownTwoHanded = twoHandGrip && w.kind === 'item' && w.def.twoHandedDamage;
  const dice = ownTwoHanded ? { kp: parseDice(ownTwoHanded.kp), sp: parseDice(ownTwoHanded.sp) } : weaponDamageDice(w);
  const kpParts: string[] = [];
  const spParts: string[] = [];
  // Järnnäve: unarmed blows always do maximum damage including SB (HH 331).
  const max = !!o.max || (w.kind === 'unarmed' && hasHero(a, 'ironFist'));

  const k = part(ctx, ownTwoHanded ? 'weapon (two hands)' : 'weapon', dice.kp, max);
  const s = part(ctx, 'weapon', dice.sp, max || !!o.maxSpOnly);
  let kp = k.total;
  let sp = s.total;
  if (k.text) kpParts.push(k.text);
  if (s.text) spParts.push(s.text);

  if (o.melee && (a.derived.sb.count > 0 || a.derived.sb.mod !== 0)) {
    const sb = part(ctx, o.doubleSB ? 'SB×2' : 'SB', a.derived.sb, max);
    const v = sb.total * (o.doubleSB ? 2 : 1);
    kp += v;
    kpParts.push(sb.text + (o.doubleSB ? ' ×2' : ''));
    if (ctx.rules.sbOnSp) {
      sp += v;
      spParts.push(`SB ${v}`);
    }
  }
  // Vilddjuret: once blood has been drawn, SB +1T6 (HH 441).
  if (o.melee && ctx.state.bloodDrawn && hasHero(a, 'wildBeast')) {
    const wb = part(ctx, 'Wild beast', parseDice('1T6'), max);
    kp += wb.total;
    kpParts.push(wb.text);
    if (ctx.rules.sbOnSp) {
      sp += wb.total;
      spParts.push(`Wild beast ${wb.total}`);
    }
  }
  // FLAMMANDE HAND: +1T3 per E on blows, as both KP and SP (III 1381, MH 1905).
  const flame = o.melee ? activeSpell(a, 'flamingHand', ctx.state.round) : undefined;
  if (flame) {
    const expr: DiceExpr = { count: flame.value, sides: 3, mod: 0 };
    const fk = part(ctx, 'flaming hand', expr, max);
    const fs = part(ctx, 'flaming hand', expr, max);
    kp += fk.total;
    sp += fs.total;
    kpParts.push(fk.text);
    spParts.push(fs.text);
  }
  // FÖRTROLLA / FÖRBANNA VAPEN: ±1 damage per E (III 1476–1500).
  const ws = weaponSpellMod(a, w.kind === 'item' ? w.key : o.weaponKey, ctx.state.round);
  if (ws) {
    kp += ws;
    sp += ws;
    kpParts.push(`${ws > 0 ? 'enchanted' : 'cursed'} ${ws > 0 ? '+' : '−'}${Math.abs(ws)}`);
    spParts.push(`${ws > 0 ? 'enchanted' : 'cursed'} ${ws > 0 ? '+' : '−'}${Math.abs(ws)}`);
  }
  if (twoHandGrip && !ownTwoHanded) {
    const g = part(ctx, 'two-handed grip', parseDice('1T2'), max);
    kp += g.total;
    kpParts.push(g.text);
  }
  if (o.bonusDice) {
    const b = part(ctx, o.bonusDice.label, o.bonusDice.expr, max);
    kp += b.total;
    sp += b.total;
    kpParts.push(b.text);
    spParts.push(`${o.bonusDice.label} ${b.total}`);
  }
  if (o.extraKp) {
    kp += o.extraKp;
    kpParts.push(`+${o.extraKp}`);
  }
  if (o.extraSp) {
    sp += o.extraSp;
    spParts.push(`+${o.extraSp}`);
  }
  kp = Math.max(0, kp);
  sp = Math.max(0, sp);
  return { kp, sp, text: `KP ${kp} (${kpParts.join(' + ') || '0'}), SP ${sp} (${spParts.join(' + ') || '0'})` };
}

// ---------------------------------------------------------------------------
// Applying a hit (§8.2–8.6, §9, §10)
// ---------------------------------------------------------------------------

export interface HitSpec {
  attacker: Combatant;
  defender: Combatant;
  location: Location;
  dmg: DamageRoll;
  perfect: boolean;
  /** Attack roll equalled CL exactly (glancing-hit check, §8.5). */
  exactRoll: boolean;
  weaponDef: ItemDef | null;
  pv?: { kp: number; sp: number };
  /** Allow the defender to roll with the blow (not for self-inflicted or friendly hits). */
  interactive: boolean;
  /** Spell damage: hurts a hero in a last stand (🔧 SIM-23). */
  magic?: boolean;
}

export function* applyHit(ctx: Ctx, h: HitSpec): Generator<Yielded, void, any> {
  const { defender: d, location: loc } = h;
  // A hero's suicide attack ignores all damage except perfect hits (HH 904–917).
  if (d.hero?.lastStandUntil != null && !h.perfect && !h.magic) {
    log(ctx, `${d.sheet.name} ignores the blow – nothing but a perfect hit can stop the last stand.`, 'status', 2, d.id);
    return;
  }
  let kp = h.dmg.kp;
  let sp = h.dmg.sp;
  const notes: string[] = [];

  // Glancing hit against metal, lamellar or chainmail.
  const arm = armourAt(d, loc);
  if (h.exactRoll && !h.perfect && h.weaponDef && h.weaponDef.damageKind !== 'blunt' && arm.glance) {
    const r = ctx.dice.d(6);
    if (r <= GLANCE_ON[arm.glance]) {
      kp = Math.floor(kp / 2);
      sp = Math.floor(sp / 2);
      notes.push(`glancing hit on ${arm.glance} (1T6 ${r}) – half damage`);
    } else notes.push(`no glance (1T6 ${r})`);
  }

  let absKP = arm.absKP;
  let absSP = arm.absSP;
  if (h.perfect) {
    absKP = 0;
    absSP = 0;
    if (arm.absKP || arm.absSP) notes.push('perfect – armour ignored');
  } else {
    if (h.pv) {
      absKP = Math.max(0, absKP - h.pv.kp);
      absSP = Math.max(0, absSP - h.pv.sp);
      if (h.pv.kp || h.pv.sp) notes.push(`penetration ${h.pv.kp}/${h.pv.sp}`);
    }
    if ((h.attacker.sheet.abilities ?? []).includes('findOpening') && absKP > 0) {
      absKP = Math.max(0, absKP - 3);
      notes.push('Find opening −3 abs');
    }
  }
  const kpD = Math.max(0, kp - absKP);
  let spD = Math.max(0, sp - absSP);
  const armourText = absKP || absSP ? `armour ${absKP}/${absSP}` : 'no armour';

  // Roll with the blow (§10).
  if (h.interactive && spD >= ctx.rules.rollWithBlowThreshold && d.status === 'active') {
    const smi = effectiveSMI(d);
    const accept = yield { type: 'decision', request: { kind: 'rollWithBlow', actorId: d.id, spDamage: spD, cl: smi, location: loc } };
    if (accept === true) {
      const roll = rollSkill(ctx.dice, smi, smi, ctx.rules.heroicFumble);
      if (isSuccess(roll.outcome)) {
        spD = Math.floor(spD / 2);
        log(ctx, `${d.sheet.name} rolls with the blow: SMI ${smi}, rolled ${roll.roll} – SP halved to ${spD}.`, 'roll', 2, d.id);
      } else log(ctx, `${d.sheet.name} tries to roll with the blow: SMI ${smi}, rolled ${roll.roll} – fails.`, 'roll', 2, d.id);
      loseActions(ctx, d, 1);
    }
  }

  // SP first; overflow beyond what the location or total can take becomes KP (§8.6).
  const overflowLoc = Math.max(0, spD - d.sp[loc].cur);
  const overflowTot = Math.max(0, spD - d.spTotal.cur);
  d.sp[loc].cur = Math.max(0, d.sp[loc].cur - spD);
  d.spTotal.cur = Math.max(0, d.spTotal.cur - spD);
  const extraKp = Math.max(overflowLoc, overflowTot);
  const totalKp = kpD + extraKp;
  d.kp[loc].cur -= totalKp;
  d.kpTotal.cur -= totalKp;
  if (totalKp > 0) ctx.state.bloodDrawn = true;

  const where = LOCATION_NAMES[loc].toLowerCase();
  const extra = extraKp ? ` (+${extraKp} KP from pain overflow)` : '';
  log(
    ctx,
    `${d.sheet.name} takes ${totalKp} KP and ${spD} SP to the ${where}${extra}. [${h.dmg.text}; ${armourText}${notes.length ? '; ' + notes.join('; ') : ''}]`,
    totalKp + spD > 0 ? 'hit' : 'info',
    1,
    d.id,
  );
  if (totalKp + spD > 0) breakConcentration(ctx, d, 'hurt');

  // Lose balance: more SP than STO in one attack (§10).
  if (spD > d.sheet.attributes.STO && d.status === 'active') {
    const ft = d.sheet.skills.fallTechnique ?? 0;
    const roll = ft > 0 ? rollSkill(ctx.dice, ft, ft, ctx.rules.heroicFumble) : null;
    if (roll && isSuccess(roll.outcome)) log(ctx, `${d.sheet.name} is knocked back but keeps balance (Fall technique ${ft}, rolled ${roll.roll}).`, 'roll', 2, d.id);
    else {
      log(ctx, `${d.sheet.name} is knocked back and loses the next action${roll ? ` (Fall technique ${ft}, rolled ${roll.roll})` : ''}.`, 'status', 2, d.id);
      loseActions(ctx, d, 1);
    }
  }

  // KH critical hit table on a perfect attack that did KP damage (§9.1).
  if (h.perfect && totalKp > 0 && d.status === 'active') {
    const sides = h.weaponDef?.lightForCrits || !h.weaponDef ? 10 : 20;
    const entries = rollTable(ctx, critTable(loc), sides);
    for (const e of entries) {
      log(ctx, `CRITICAL (${where}, 1T${sides} → ${e.roll}): ${e.text}`, 'critical', 1, d.id);
      applyEffects(ctx, d, e.effects, { location: loc, source: `critical: ${e.text}` });
    }
  }

  checkThresholds(ctx, d, loc);
}

export function critTable(loc: Location): TableEntry[] {
  if (loc === 'head') return CRIT_HEAD;
  if (loc === 'chest') return CRIT_CHEST;
  if (loc === 'abdomen') return CRIT_ABDOMEN;
  if (isArm(loc)) return CRIT_ARMS;
  return CRIT_LEGS;
}

/** Run an interactive hit generator non-interactively (declining all offers). */
export function runSilently(gen: Generator<Yielded, void, any>): void {
  let r = gen.next();
  while (!r.done) r = gen.next(r.value.type === 'decision' ? false : undefined);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const OUT_RANK: Record<OutKind, number> = { incapacitated: 1, unconscious: 2, dying: 3, dead: 4 };

export function setOut(ctx: Ctx, c: Combatant, kind: OutKind, reason: string): void {
  if (c.hero?.lastStandUntil != null && kind !== 'dead') {
    kind = 'dead';
    reason = `${reason} – the last stand is over`;
  }
  if (c.status === 'out' && OUT_RANK[c.outKind!] >= OUT_RANK[kind]) return;
  const wasOut = c.status === 'out';
  c.status = 'out';
  c.outKind = kind;
  c.outReason = reason;
  c.casting = null;
  for (const s of c.slots) if (!s.used) s.lost = true;
  const label = { incapacitated: 'is out of the fight', unconscious: 'falls unconscious', dying: 'is dying', dead: 'is DEAD' }[kind];
  log(ctx, `${c.sheet.name} ${label} – ${reason}.`, 'status', wasOut ? 2 : 1, c.id);
}

export function applyDirectKp(ctx: Ctx, c: Combatant, loc: Location, kp: number, why: string): void {
  if (c.hero?.lastStandUntil != null) return;
  c.kp[loc].cur -= kp;
  c.kpTotal.cur -= kp;
  if (kp > 0) ctx.state.bloodDrawn = true;
  log(ctx, `${c.sheet.name} takes ${kp} KP to the ${LOCATION_NAMES[loc].toLowerCase()} (${why}).`, 'hit', 2, c.id);
  if (kp > 0) breakConcentration(ctx, c, 'hurt');
  checkThresholds(ctx, c, loc);
}

/**
 * Damage to total KP and SP only – spells such as ELD, FROST and BLIXT in the detailed system (III 1437, MH 1905).
 * SP beyond the total becomes KP (§8.6). `armour` is subtracted first (KP and SP absorption).
 */
export function applyTotalDamage(ctx: Ctx, c: Combatant, kp: number, sp: number, text: string, armour?: { absKP: number; absSP: number; names: string[] }): void {
  if (c.status === 'out' && c.outKind === 'dead') return;
  const kpD = Math.max(0, kp - (armour?.absKP ?? 0));
  const spD = Math.max(0, sp - (armour?.absSP ?? 0));
  const overflow = Math.max(0, spD - c.spTotal.cur);
  c.spTotal.cur = Math.max(0, c.spTotal.cur - spD);
  const totalKp = kpD + overflow;
  c.kpTotal.cur -= totalKp;
  if (totalKp > 0) ctx.state.bloodDrawn = true;
  const armourText = armour && (armour.absKP || armour.absSP) ? `; armour ${armour.absKP}/${armour.absSP} (${armour.names.join(' + ')})` : '';
  log(
    ctx,
    `${c.sheet.name} takes ${totalKp} KP and ${spD} SP to total KP/SP${overflow ? ` (+${overflow} KP from pain overflow)` : ''}. [${text}${armourText}]`,
    totalKp + spD > 0 ? 'hit' : 'info',
    1,
    c.id,
  );
  if (totalKp + spD > 0) breakConcentration(ctx, c, 'hurt');
  if (c.status === 'active' || c.kpTotal.cur <= -c.sheet.attributes.FYS) checkThresholds(ctx, c);
}

/** A fumble that hits the nearest friend: normal damage to a random location, no parry. */
export function hitFriend(ctx: Ctx, a: Combatant, friend: Combatant): void {
  const w = meleeWeapons(ctx, a)[0];
  if (!w) return;
  const loc = lookup(RANDOM_MELEE, ctx.dice.d(20));
  log(ctx, `${a.sheet.name} hits ${friend.sheet.name} by mistake!`, 'fumble', 2, a.id);
  const dmg = rollDamage(ctx, a, w, { melee: true });
  runSilently(applyHit(ctx, { attacker: a, defender: friend, location: loc, dmg, perfect: false, exactRoll: false, weaponDef: w.kind === 'item' ? w.def : null, interactive: false }));
}

/**
 * Stålsättning (HH 398): the hero takes damage like a berserker. When a location reaches 0 he rolls PSY
 * (once per location); success = he ignores it and fights on with the body part (SIM-13).
 */
function steelShrugs(ctx: Ctx, c: Combatant, l: Location): boolean {
  if (!c.hero || !hasHero(c, 'steeled') || c.criticalLocations.includes(l)) return false;
  if (c.hero.steeledChecks.includes(l)) return c.hero.steeledOk.includes(l);
  c.hero.steeledChecks.push(l);
  const r = ctx.dice.d(20);
  const ok = r <= c.sheet.attributes.PSY;
  if (ok) c.hero.steeledOk.push(l);
  log(ctx, `${c.sheet.name} steels against the ${LOCATION_NAMES[l].toLowerCase()} wound (PSY ${c.sheet.attributes.PSY}, rolled ${r}) – ${ok ? 'ignores it' : 'the pain wins'}.`, 'roll', 2, c.id);
  return ok;
}

/** KP/SP thresholds (§11.1, §11.3) and double-damage criticals (§9.2). */
export function checkThresholds(ctx: Ctx, c: Combatant, loc?: Location): void {
  if (c.status === 'out' && c.outKind === 'dead') return;
  const fys = c.sheet.attributes.FYS;
  const name = c.sheet.name;

  if (c.kpTotal.cur <= -fys) return setOut(ctx, c, 'dead', `total KP ${c.kpTotal.cur} (≤ −FYS)`);

  const locs = loc ? [loc] : (Object.keys(c.kp) as Location[]);
  for (const l of locs) {
    const pool = c.kp[l];
    // More than double the location's KP → critical injury.
    if (pool.cur <= -pool.max && !c.criticalLocations.includes(l)) {
      c.criticalLocations.push(l);
      if (l === 'head') return setOut(ctx, c, 'dead', 'head crushed (double damage)');
      if (l === 'chest' || l === 'abdomen') {
        setOut(ctx, c, 'dying', `${LOCATION_NAMES[l].toLowerCase()} critically injured – bleeds to death within ${fys} rounds`);
      } else {
        const r = ctx.dice.d(10);
        const entry = CRIT_LIMB_DOUBLE.find((e) => e.roll === r)!;
        log(ctx, `${name}'s ${LOCATION_NAMES[l].toLowerCase()} is critically injured (1T10 → ${r}): ${entry.text}`, 'critical', 1, c.id);
        makeLimbUnusable(ctx, c, l, FOREVER, 'critically injured');
      }
    }
    // Location at 0 KP: bleeding 1 KP every 6 SR (once per location).
    if (pool.cur <= 0 && !c.bleeds.some((b) => b.source === `wound:${l}`)) {
      c.bleeds.push({ kp: 1, every: 6, counter: 0, source: `wound:${l}` });
      log(ctx, `${name}'s ${LOCATION_NAMES[l].toLowerCase()} is bleeding (1 KP every 6 rounds).`, 'status', 2, c.id);
    }
  }

  if (c.kpTotal.cur <= 0 && hasHero(c, 'favouredByGods') && c.status === 'active') {
    const r = ctx.dice.d(100);
    if (r <= ctx.rules.favouredByGodsChance) {
      for (const l of Object.keys(c.kp) as Location[]) c.kp[l].cur = c.kp[l].max;
      c.kpTotal.cur = c.kpTotal.max;
      c.bleeds = c.bleeds.filter((b) => !b.source.startsWith('wound:'));
      log(ctx, `The gods intervene! ${name}'s KP are restored (1T100 → ${r} ≤ ${ctx.rules.favouredByGodsChance}).`, 'critical', 1, c.id);
      return;
    }
    log(ctx, `${name} calls on the gods, but they stay silent (1T100 → ${r}).`, 'roll', 2, c.id);
  }
  if (c.kpTotal.cur <= 0) return setOut(ctx, c, 'unconscious', 'total KP 0 – shock and blood loss');
  if (c.spTotal.cur <= 0) return setOut(ctx, c, 'unconscious', 'total SP 0 – overwhelmed by pain');
  if (c.kp.head.cur <= 0) return setOut(ctx, c, 'unconscious', 'head KP 0');
  if (c.sp.head.cur <= 0) return setOut(ctx, c, 'unconscious', 'head SP 0');
  for (const l of ['chest', 'abdomen'] as Location[]) {
    if ((c.kp[l].cur <= 0 || c.sp[l].cur <= 0) && steelShrugs(ctx, c, l)) continue;
    if (c.kp[l].cur <= 0) return setOut(ctx, c, 'incapacitated', `${LOCATION_NAMES[l].toLowerCase()} KP 0 – falls and can only crawl`);
    if (c.sp[l].cur <= 0) return setOut(ctx, c, 'incapacitated', `${LOCATION_NAMES[l].toLowerCase()} SP 0 – falls and can only crawl`);
  }
  if (c.kpTotal.cur <= 1) return setOut(ctx, c, 'incapacitated', 'total KP 1 – can no longer use any skills');
  if (c.spTotal.cur <= 1) return setOut(ctx, c, 'incapacitated', 'total SP 1 – can no longer use any skills');

  // Arm/leg at 0 KP or SP: limb useless; a hard PSY roll lets you fight on (§11.1).
  for (const l of Object.keys(c.kp) as Location[]) {
    if (!isLimb(l) || c.status !== 'active') continue;
    if ((c.kp[l].cur <= 0 || c.sp[l].cur <= 0) && !c.limbChecks.includes(l)) {
      if (steelShrugs(ctx, c, l)) continue;
      c.limbChecks.push(l);
      makeLimbUnusable(ctx, c, l, FOREVER, 'KP/SP 0');
      const psy = rollResistance(ctx.dice, c.sheet.attributes.PSY, SG.hard);
      if (psy.success) log(ctx, `${name} fights on despite the pain (hard PSY roll: ${psy.roll ?? '–'} ≤ ${psy.target}).${isLeg(l) ? ' Must kneel.' : ''}`, 'roll', 2, c.id);
      else setOut(ctx, c, 'incapacitated', `the pain in the ${LOCATION_NAMES[l].toLowerCase()} is too much (hard PSY roll ${psy.roll ?? '–'} vs ${psy.target})`);
    }
  }
}
