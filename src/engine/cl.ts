import { attackDirection, DIRECTION_BONUS } from './facing';
import { itemDef, UNARMED, type UnarmedAttackDef, GROUP_ATTRIBUTE } from '../data/items';
import { AIM_PENALTY, rangeModifier } from '../data/tables';
import { armOfHand, hasFreeHand, hasHero, heldItem, unarmedAllowed, unarmedFV, weaponFV, mainArm, offArm, canWield } from './character';
import { activeConditions, hasCondition, limbUsable, scopesFor } from './conditions';
import { weaponSpellMod } from './spellEffects';
import { metres, squares, SQUARE_M, type Ctx } from './state';
import type { Combatant, Condition, ItemDef, Location } from './types';
import { LOCATION_NAMES, mirror } from './types';

export interface Mod {
  label: string;
  value: number;
}

export interface ClResult {
  fv: number;
  mods: Mod[];
  cl: number;
  /** Notes like "CL halved (total KP ≤ 2)". */
  notes: string[];
  /** Use-counted conditions consumed if the roll is made. */
  consumes: Condition[];
}

export const fmtMods = (mods: Mod[]) => mods.filter((m) => m.value !== 0).map((m) => `${m.label} ${m.value > 0 ? '+' : '−'}${Math.abs(m.value)}`).join(', ');

export function describeCl(r: ClResult): string {
  const mods = fmtMods(r.mods);
  return `FV ${r.fv}${mods ? `, ${mods}` : ''}${r.notes.length ? ` (${r.notes.join('; ')})` : ''} → CL ${r.cl}`;
}

// ---------------------------------------------------------------------------
// Weapon references
// ---------------------------------------------------------------------------

export type WeaponRef = 'main' | 'off' | `unarmed:${string}`;

export type ResolvedWeapon =
  | { kind: 'item'; ref: WeaponRef; hand: 'main' | 'off'; key: string; def: ItemDef; fv: number; offHandPenalty: number; name: string; reach: number }
  | { kind: 'unarmed'; ref: WeaponRef; ua: UnarmedAttackDef; fv: number; name: string; reach: number };

export function resolveWeapon(c: Combatant, ref: WeaponRef): ResolvedWeapon | null {
  if (ref.startsWith('unarmed:')) {
    const ua = UNARMED[ref.slice(8)];
    if (!ua) return null;
    return { kind: 'unarmed', ref, ua, fv: unarmedFV(c.sheet, ua.id), name: ua.name, reach: ua.length + 1 };
  }
  const hand = ref as 'main' | 'off';
  const held = heldItem(c, hand);
  if (!held) return null;
  let fv = weaponFV(c.sheet, held.state.def);
  let offHandPenalty = 0;
  if (hand === 'off' && held.def.kind !== 'shield' && c.sheet.handedness !== 'ambidextrous') {
    const tw = c.sheet.skills.twoWeapons;
    if (tw !== undefined) fv = Math.min(fv, tw);
    else offHandPenalty = -10;
  }
  return { kind: 'item', ref, hand, key: held.key, def: held.def, fv, offHandPenalty, name: held.def.name, reach: held.def.length + 1 };
}

/** Melee weapons/attacks the combatant can attack with right now. */
export function meleeWeapons(ctx: Ctx, c: Combatant): ResolvedWeapon[] {
  const r = ctx.state.round;
  const out: ResolvedWeapon[] = [];
  for (const hand of ['main', 'off'] as const) {
    const w = resolveWeapon(c, hand);
    if (!w || w.kind !== 'item' || w.def.kind !== 'melee') continue;
    if (!canWield(c, w.def)) continue;
    if (!limbUsable(c, armOfHand(c, hand), r)) continue;
    out.push(w);
  }
  // Unarmed attacks are offered only when no melee weapon is usable (keeps the menu short).
  if (out.length === 0 && unarmedAllowed(c)) {
    for (const ua of Object.values(UNARMED)) {
      const fv = unarmedFV(c.sheet, ua.id);
      if (fv <= 0) continue;
      if (ua.needsFreeHand && !hasFreeHand(c)) continue;
      const w = resolveWeapon(c, `unarmed:${ua.id}`);
      if (w) out.push(w);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wounds and pain (§11.2, §11.4)
// ---------------------------------------------------------------------------

export function locationPenalty(c: Combatant, loc: Location): number {
  const kp = c.kp[loc];
  const kpLost = Math.min(kp.max, Math.max(0, kp.max - kp.cur));
  const sp = c.sp[loc];
  const spLostFrac = sp.max > 0 ? (sp.max - sp.cur) / sp.max : 0;
  const spPen = spLostFrac >= 0.75 ? 4 : spLostFrac >= 0.5 ? 2 : 0;
  return Math.max(2 * kpLost, spPen);
}

/** SIM-6: head/chest/abdomen affect everything; arms affect what that arm holds. */
function woundMods(c: Combatant, arms: Location[]): Mod[] {
  if (hasHero(c, 'steeled')) return []; // Stålsättning: ignores wounds like a berserker (HH 398)
  const locs: Location[] = ['head', 'chest', 'abdomen', ...arms];
  const mods: Mod[] = [];
  for (const l of locs) {
    const p = locationPenalty(c, l);
    if (p > 0) mods.push({ label: `wounds (${LOCATION_NAMES[l].toLowerCase()})`, value: -p });
  }
  return mods;
}

function halvingNote(c: Combatant): string | null {
  if (hasHero(c, 'steeled')) return null;
  if (c.kpTotal.cur <= 2) return 'CL halved: total KP ≤ 2';
  if (c.spTotal.cur <= 5) return 'CL halved: total SP ≤ 5';
  return null;
}

function conditionMods(c: Combatant, round: number, kind: 'attack' | 'parry' | 'ranged' | 'spell', usesMainHand: boolean, arm: Location | null) {
  const filter = scopesFor(kind, usesMainHand, arm);
  const mods: Mod[] = [];
  const consumes: Condition[] = [];
  for (const cond of activeConditions(c, round, 'clMod')) {
    if (!filter(cond)) continue;
    mods.push({ label: cond.text.split(':')[0] || 'condition', value: cond.value ?? 0 });
    if (cond.uses !== undefined) consumes.push(cond);
  }
  return { mods, consumes };
}

function opponentBonusMods(target: Combatant, round: number) {
  const mods: Mod[] = [];
  const consumes: Condition[] = [];
  for (const cond of activeConditions(target, round, 'opponentBonus')) {
    mods.push({ label: 'opening', value: cond.value ?? 0 });
    if (cond.uses !== undefined) consumes.push(cond);
  }
  return { mods, consumes };
}

function finish(fv: number, mods: Mod[], notes: string[], consumes: Condition[], halve: string | null): ClResult {
  let cl = fv + mods.reduce((s, m) => s + m.value, 0);
  if (halve) {
    cl = Math.floor(cl / 2);
    notes.push(halve);
  }
  return { fv, mods, cl, notes, consumes };
}

// ---------------------------------------------------------------------------
// Melee attack CL
// ---------------------------------------------------------------------------

/** Aim penalty for a location against this defender (table is for right-handed opponents). */
export function aimPenalty(defender: Combatant, loc: Location): number {
  return AIM_PENALTY[defender.fightingSide === 'left' ? mirror(loc) : loc];
}

/** `locationMod` replaces the aim/wild modifier (used for special attacks such as throwing the sword). */
/** `thrown`: a thrown sword uses the melee table but isn't a melee attack, so facing doesn't count. */
export function attackCL(ctx: Ctx, a: Combatant, d: Combatant, w: ResolvedWeapon, location: Location | 'wild', locationMod?: Mod, thrown = false): ClResult {
  const r = ctx.state.round;
  const mods: Mod[] = [];
  const notes: string[] = [];
  const exposed = d.stance === 'defensive' ? null : d.blotta[a.id] ?? null;

  if (locationMod) mods.push(locationMod);
  else if (location === 'wild') mods.push({ label: 'wild swing', value: -5 });
  else if (location === exposed) mods.push({ label: 'exposed area', value: 0 });
  else mods.push({ label: `aim ${LOCATION_NAMES[location].toLowerCase()}`, value: aimPenalty(d, location) });

  if (d.fightingSide === 'left' && a.sheet.handedness !== 'dubbelhant' && a.sheet.handedness !== 'ambidextrous') {
    mods.push({ label: 'left-handed opponent', value: -2 });
  }
  if (w.kind === 'item' && w.offHandPenalty) mods.push({ label: 'shield hand', value: w.offHandPenalty });
  if (hasCondition(d, r, 'prone')) mods.push({ label: 'target on the ground', value: 5 });
  if (ctx.rules.flanking && !thrown) {
    const dir = attackDirection(d, a.pos);
    if (dir !== 'front') mods.push({ label: dir === 'side' ? 'from the side' : 'from behind', value: DIRECTION_BONUS[dir] });
  }
  if ((a.sheet.abilities ?? []).includes('precision')) mods.push({ label: 'Precision', value: 1 });
  mods.push(...heroMods(ctx, a, w.kind === 'item'));
  if (w.kind === 'item') mods.push(...weaponSpellMods(a, w.key, r));

  const group = w.kind === 'item' ? w.def.group : 'unarmed';
  if (GROUP_ATTRIBUTE[group] === 'SMI' && a.derived.loadPenalty) mods.push({ label: 'load', value: a.derived.loadPenalty });

  const arms = w.kind === 'item' ? (w.def.twoHandedOnly || !a.hands.off ? [mainArm(a), offArm(a)] : [armOfHand(a, w.hand)]) : [];
  mods.push(...woundMods(a, arms));
  const cm = conditionMods(a, r, 'attack', w.kind === 'item' && w.hand === 'main', arms[0] ?? null);
  mods.push(...cm.mods);
  const ob = opponentBonusMods(d, r);
  mods.push(...ob.mods);
  return finish(w.fv, mods, notes, [...cm.consumes, ...ob.consumes], halvingNote(a));
}

// ---------------------------------------------------------------------------
// Parry CL
// ---------------------------------------------------------------------------

export type ParrySource =
  | { kind: 'item'; hand: 'main' | 'off' }
  | { kind: 'unarmed' } // martial art: obeväpnad parering (or vs unarmed attacks: brawling)
  | { kind: 'projectileParry' }
  | { kind: 'spell'; e: number; prepared: boolean }; // SKÖLD (§22.6)

export interface ParryContext {
  /** Lightning attack: the attacker's differensvärde is subtracted from the parry (HH 827). */
  penalty?: Mod;
  wild: boolean;
  chain: boolean;
  feint: boolean;
  kneeStrike: boolean;
  attackerActions: number;
}

export function parryFV(c: Combatant, src: ParrySource): { fv: number; name: string; offHandPenalty: number; arm: Location | null; bonus: number } {
  if (src.kind === 'projectileParry') return { fv: c.sheet.skills.martialArt ?? 0, name: 'Projectile parry', offHandPenalty: 0, arm: null, bonus: 0 };
  if (src.kind === 'spell') return { fv: spellSkill(c, 'shield'), name: 'SKÖLD', offHandPenalty: 0, arm: null, bonus: 0 };
  if (src.kind === 'unarmed') {
    const art = c.sheet.skills.martialArt ?? 0;
    return { fv: Math.max(art, c.sheet.skills.brawling ?? 0), name: 'Unarmed parry', offHandPenalty: 0, arm: null, bonus: 0 };
  }
  const held = heldItem(c, src.hand)!;
  let fv = weaponFV(c.sheet, held.state.def);
  let offHandPenalty = 0;
  if (src.hand === 'off' && held.def.kind !== 'shield' && c.sheet.handedness !== 'ambidextrous') {
    const tw = c.sheet.skills.twoWeapons;
    if (tw !== undefined) fv = Math.min(fv, tw);
    else offHandPenalty = -10;
  }
  return { fv, name: held.def.name, offHandPenalty, arm: armOfHand(c, src.hand), bonus: held.def.parryBonus ?? 0 };
}

export function parryCL(ctx: Ctx, d: Combatant, _attacker: Combatant, src: ParrySource, pc: ParryContext): ClResult {
  const r = ctx.state.round;
  const info = parryFV(d, src);
  const mods: Mod[] = [];
  const notes: string[] = [];
  if (info.offHandPenalty) mods.push({ label: 'off hand', value: info.offHandPenalty });
  if (info.bonus) mods.push({ label: 'main gauche', value: info.bonus });
  if (pc.wild) mods.push({ label: 'vs wild swing', value: -3 });
  if (pc.penalty) mods.push(pc.penalty);
  mods.push(...heroMods(ctx, d, src.kind === 'item'));
  if (pc.kneeStrike) mods.push({ label: 'vs knee strike', value: -5 });
  if ((d.sheet.abilities ?? []).includes('quickPerception') && src.kind === 'item') mods.push({ label: 'Quick perception', value: 5 });
  if (d.stance === 'defensive') {
    const extra = d.slots.length - pc.attackerActions;
    if (extra > 0) mods.push({ label: 'defensive stance', value: 2 * extra });
  }
  if (src.kind === 'item') {
    const held = heldItem(d, src.hand)!;
    mods.push(...weaponSpellMods(d, held.key, r));
    if (GROUP_ATTRIBUTE[held.def.group] === 'SMI' && d.derived.loadPenalty) mods.push({ label: 'load', value: d.derived.loadPenalty });
  } else if (d.derived.loadPenalty) mods.push({ label: 'load', value: d.derived.loadPenalty });
  mods.push(...woundMods(d, info.arm ? [info.arm] : []));
  const cm = conditionMods(d, r, 'parry', src.kind === 'item' && src.hand === 'main', info.arm);
  mods.push(...cm.mods);
  let result = finish(info.fv, mods, notes, cm.consumes, halvingNote(d));
  if (pc.chain) result = { ...result, cl: Math.floor(result.cl / 2), notes: [...result.notes, 'halved: chain weapon/whip'] };
  if (pc.feint) result = { ...result, cl: Math.floor(result.cl / 2), notes: [...result.notes, 'halved: feint'] };
  return result;
}

// ---------------------------------------------------------------------------
// Ranged attack CL (§7.1, §15.2)
// ---------------------------------------------------------------------------

export interface RangedCheck {
  ok: boolean;
  reason?: string;
  rangeMod?: number;
  distanceM: number;
  maxRangeM: number;
}

export function rangedWeapon(c: Combatant): { key: string; def: ItemDef; fv: number } | null {
  const held = heldItem(c, 'main');
  if (!held || (held.def.kind !== 'projectile' && held.def.kind !== 'thrown')) return null;
  if (!canWield(c, held.def)) return null;
  return { key: held.key, def: held.def, fv: weaponFV(c.sheet, held.state.def) };
}

export function maxRangeM(c: Combatant, def: ItemDef): number {
  if (def.rangeIsSty) return c.sheet.attributes.STY * SQUARE_M;
  return def.range ?? 0;
}

export function checkRanged(_ctx: Ctx, a: Combatant, d: Combatant): RangedCheck {
  const w = rangedWeapon(a);
  const distanceM = metres(a.pos, d.pos);
  if (!w) return { ok: false, reason: 'no ranged weapon in hand', distanceM, maxRangeM: 0 };
  const max = maxRangeM(a, w.def);
  if (a.shotThisRound) return { ok: false, reason: 'already shot this round', distanceM, maxRangeM: max };
  if (squares(a.pos, d.pos) < 2) return { ok: false, reason: 'too close (needs a square between)', distanceM, maxRangeM: max };
  if (w.def.ammo && (a.ammo[w.def.ammo] ?? 0) <= 0) return { ok: false, reason: 'out of ammunition', distanceM, maxRangeM: max };
  if (w.def.reload && !a.items[w.key].loaded) return { ok: false, reason: 'not loaded', distanceM, maxRangeM: max };
  const rm = rangeModifier(distanceM, max);
  if (rm === null) return { ok: false, reason: 'out of range', distanceM, maxRangeM: max };
  return { ok: true, rangeMod: rm, distanceM, maxRangeM: max };
}

export function rangedCL(ctx: Ctx, a: Combatant, d: Combatant, aimedAt: Location | null): ClResult {
  const r = ctx.state.round;
  const w = rangedWeapon(a)!;
  const check = checkRanged(ctx, a, d);
  const mods: Mod[] = [];
  const notes: string[] = [];
  let fv = w.fv;
  if (d.running) {
    fv = Math.ceil(fv / 2);
    notes.push('FV halved: moving target');
  }
  if (check.rangeMod) mods.push({ label: `range ${check.distanceM} m`, value: check.rangeMod });
  if (a.aimBonus) mods.push({ label: 'aiming', value: a.aimBonus });
  if (aimedAt) mods.push({ label: `aim ${LOCATION_NAMES[aimedAt].toLowerCase()}`, value: -5 });
  if (hasCondition(d, r, 'prone')) mods.push({ label: 'target on the ground', value: -squares(a.pos, d.pos) + 1 });
  if (ctx.rules.windMs) mods.push({ label: 'wind', value: -ctx.rules.windMs });
  if ((a.sheet.abilities ?? []).includes('precision')) mods.push({ label: 'Precision', value: 1 });
  mods.push(...heroMods(ctx, a, true));
  mods.push(...weaponSpellMods(a, w.key, r));
  if (GROUP_ATTRIBUTE[w.def.group] === 'SMI' && a.derived.loadPenalty) mods.push({ label: 'load', value: a.derived.loadPenalty });
  mods.push(...woundMods(a, w.def.twoHandedOnly ? [mainArm(a), offArm(a)] : [mainArm(a)]));
  const cm = conditionMods(a, r, 'ranged', true, mainArm(a));
  mods.push(...cm.mods);
  const ob = opponentBonusMods(d, r);
  mods.push(...ob.mods);
  return finish(fv, mods, notes, [...cm.consumes, ...ob.consumes], halvingNote(a));
}

function weaponSpellMods(c: Combatant, key: string, round: number): Mod[] {
  const v = weaponSpellMod(c, key, round);
  return v ? [{ label: v > 0 ? 'enchanted' : 'cursed', value: v }] : [];
}

// ---------------------------------------------------------------------------
// Casting CL (§22.2)
// ---------------------------------------------------------------------------

/** The caster's S in a spell (0 if unknown or forgotten). */
export function spellSkill(c: Combatant, spellId: string): number {
  if (c.forgottenSpells.includes(spellId)) return 0;
  return c.sheet.magic?.spells[spellId] ?? 0;
}

/**
 * CL for casting: S − 2 per effect grade above the first (III 103–108, 175–190), with the general wound and pain
 * penalties (head, chest, abdomen – SIM-6) and conditions that affect everything. A suicide spell uses the
 * unmodified S whatever the effect grade (III 241).
 */
export function castingCL(ctx: Ctx, c: Combatant, spellId: string, e: number, suicide = false): ClResult {
  const s = spellSkill(c, spellId);
  if (suicide) return { fv: s, mods: [], cl: s, notes: ['suicide spell: unmodified S'], consumes: [] };
  const mods: Mod[] = [];
  if (e > 1) mods.push({ label: `E${e}`, value: -2 * (e - 1) });
  mods.push(...woundMods(c, []));
  const cm = conditionMods(c, ctx.state.round, 'spell', false, null);
  mods.push(...cm.mods);
  return finish(s, mods, [], cm.consumes, halvingNote(c));
}

/** Hero ability modifiers: Weapon master +5 with any weapon, Wild beast +3 once blood is drawn (HH 435, 441). */
function heroMods(ctx: Ctx, c: Combatant, withWeapon: boolean): Mod[] {
  const mods: Mod[] = [];
  if (withWeapon && hasHero(c, 'weaponMaster')) mods.push({ label: 'Weapon master', value: 5 });
  if (ctx.state.bloodDrawn && hasHero(c, 'wildBeast')) mods.push({ label: 'Wild beast', value: 3 });
  return mods;
}

export function itemName(id: string): string {
  return itemDef(id).name;
}
