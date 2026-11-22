import { armourDef } from '../data/armour';
import { ITEMS, itemDef, UNARMED } from '../data/items';
import { armourWeightFactor, bodyPoints, damageBonus, loadPenalty, movement, RACE_MOVEMENT } from '../data/tables';
import { parseDice } from './dice';
import type { CharacterSheet, Combatant, Derived, HeroAbility, ItemDef, ItemState, Location, Pool, Slot, SlotWeapon } from './types';
import { LOCATIONS } from './types';

/** Derived values for a character sheet (combat-rules §2, §4.3, §15.4, §17.3). */
export function deriveStats(sheet: CharacterSheet): Derived {
  const a = sheet.attributes;
  const barbarian = sheet.profession === 'barbarian';
  const abilities = sheet.abilities ?? [];

  let kpTotal = Math.ceil(((a.FYS + (barbarian ? 3 : 0)) + (a.STO + (barbarian ? 3 : 0))) / 2);
  if (abilities.includes('tough')) kpTotal = Math.floor(kpTotal * 1.5);
  let spTotal = (a.FYS + (barbarian ? 7 : 0)) * 2;
  if (abilities.includes('painTolerant')) spTotal = Math.floor(spTotal * 1.5);

  const sbText = damageBonus(a.STY + a.STO);
  const ffBase = movement(a.STO + a.FYS + a.SMI) + (RACE_MOVEMENT[sheet.race] ?? 0);

  const armourWeight = sheet.equipment.armour.reduce((sum, id) => sum + armourDef(id).weight, 0);
  const armourWeightAdjusted = round1(armourWeight * armourWeightFactor(a.STO + a.STY + a.FYS));
  const itemWeight = Object.values(sheet.equipment.items).reduce((sum, it) => sum + itemDef(it.def).weight * (it.count ?? 1), 0);
  // Worn armour counts at half its weight (III 3372).
  const load = round1(armourWeightAdjusted / 2 + itemWeight);

  return {
    kpMax: bodyPoints(kpTotal),
    kpTotalMax: kpTotal,
    spMax: bodyPoints(spTotal),
    spTotalMax: spTotal,
    sb: parseDice(sbText),
    sbText,
    ffBase,
    armourWeight: round1(armourWeight),
    armourWeightAdjusted,
    load,
    loadPenalty: loadPenalty(load, a.STY),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function pools(max: Record<Location, number>): Record<Location, Pool> {
  return Object.fromEntries(LOCATIONS.map((l) => [l, { max: max[l], cur: max[l] }])) as Record<Location, Pool>;
}

export function createCombatant(sheet: CharacterSheet, id: string, team: number, controller: 'human' | 'ai', pos: { x: number; y: number }): Combatant {
  const derived = deriveStats(sheet);
  const items: Record<string, ItemState> = {};
  for (const [key, it] of Object.entries(sheet.equipment.items)) {
    const def = itemDef(it.def);
    items[key] = { def: it.def, bv: def.bv, count: it.count ?? 1, status: 'carried', loaded: !def.reload };
  }
  const armour = Object.fromEntries(LOCATIONS.map((l) => [l, [] as string[]])) as Record<Location, string[]>;
  for (const pid of sheet.equipment.armour) for (const l of armourDef(pid).covers) armour[l].push(pid);
  const lo = sheet.equipment.loadouts[0];
  return {
    id,
    sheet,
    team,
    controller,
    pos: { ...pos },
    facing: { x: team === 0 ? 1 : -1, y: 0 },
    derived,
    kp: pools(derived.kpMax),
    kpTotal: { max: derived.kpTotalMax, cur: derived.kpTotalMax },
    sp: pools(derived.spMax),
    spTotal: { max: derived.spTotalMax, cur: derived.spTotalMax },
    items,
    hands: { main: lo?.main ?? null, off: lo?.off ?? null },
    loadoutIndex: 0,
    ammo: { ...(sheet.equipment.ammo ?? {}) },
    armour,
    psy: sheet.attributes.PSY,
    psyMax: sheet.attributes.PSY,
    staffPsy: sheet.magic?.staffPsy ? { max: sheet.magic.staffPsy, cur: sheet.magic.staffPsy } : null,
    casting: null,
    activeSpells: [],
    burns: [],
    magicLost: null,
    forgottenSpells: [],
    status: 'active',
    conditions: [],
    bleeds: [],
    criticalLocations: [],
    limbChecks: [],
    hidden: false,
    hideDiff: 0,
    spottedBy: [],
    sneak: null,
    tookCover: null,
    darkFightingRound: -1,
    initiative: 0,
    slots: [],
    turnDone: {},
    movedThisRound: 0,
    attackedThisRound: false,
    shotThisRound: false,
    running: false,
    stance: 'normal',
    fightingSide: sheet.handedness === 'left' ? 'left' : 'right',
    blotta: {},
    opponentFumbled: false,
    techniquesUsed: [],
    noCounterOpp: null,
    aimBonus: 0,
    reloadLeft: 0,
    pendingLostActions: 0,
    hero: sheet.hero
      ? { points: sheet.hero.heroPoints, powerStrikesLeft: 4, lastStandUsed: false, lastStandUntil: null, psyching: false, psyched: [], steeledChecks: [], steeledOk: [], multiStrikeUsed: false }
      : null,
  };
}

/** Hero ability check (also accepts the matching ordinary special ability, e.g. Snabbslående). */
export function hasHero(c: Combatant, ability: HeroAbility): boolean {
  if (c.sheet.hero?.abilities.includes(ability)) return true;
  if (ability === 'quickStriker') return (c.sheet.abilities ?? []).includes('quickStriker');
  if (ability === 'quickDraw') return (c.sheet.skills.drawWeapon ?? 0) >= 21; // Dra vapen FV 21+ (HH 696)
  return false;
}

// ---------------------------------------------------------------------------
// Hands, items and skills
// ---------------------------------------------------------------------------

/** The arm holding the main (sword) hand item. */
export function mainArm(c: Combatant): Location {
  return c.fightingSide === 'left' ? 'leftArm' : 'rightArm';
}
export function offArm(c: Combatant): Location {
  return c.fightingSide === 'left' ? 'rightArm' : 'leftArm';
}
export function armOfHand(c: Combatant, hand: 'main' | 'off'): Location {
  return hand === 'main' ? mainArm(c) : offArm(c);
}

export function heldItem(c: Combatant, hand: 'main' | 'off'): { key: string; state: ItemState; def: ItemDef } | null {
  const key = c.hands[hand];
  if (!key) return null;
  const state = c.items[key];
  if (!state || state.status !== 'carried' || state.count <= 0) return null;
  return { key, state, def: itemDef(state.def) };
}

/** True when the main-hand weapon is wielded with both hands (2H weapon, or 1H weapon with the off hand free). */
export function twoHandedGrip(c: Combatant): boolean {
  const main = heldItem(c, 'main');
  if (!main || main.def.kind === 'shield') return false;
  if (needsTwoHands(c, main.def)) return true;
  return !c.hands.off && !main.def.oneHandedOnly && main.def.kind === 'melee';
}

/** III 2690–2715: two hands if marked two-handed or the STY requirement exceeds STY. */
export function needsTwoHands(c: Combatant, def: ItemDef): boolean {
  return !!def.twoHandedOnly || def.sty > c.sheet.attributes.STY;
}

/** III 2699: unusable if the requirement exceeds 2 × STY (shields: exceeds STY → can't parry). */
export function canWield(c: Combatant, def: ItemDef): boolean {
  if (def.kind === 'shield') return def.sty <= c.sheet.attributes.STY;
  if (def.oneHandedOnly) return def.sty <= c.sheet.attributes.STY;
  return def.sty <= 2 * c.sheet.attributes.STY;
}

/** Weapon skill FV, with the weapon-group rule (half the best FV in the group) as fallback (§2.7). */
export function weaponFV(sheet: CharacterSheet, defId: string): number {
  const direct = sheet.skills[defId];
  if (direct !== undefined) return direct;
  const group = itemDef(defId).group;
  let best = 0;
  for (const [k, v] of Object.entries(sheet.skills)) {
    const d = ITEMS[k];
    if (d && d.group === group) best = Math.max(best, v);
  }
  return Math.floor(best / 2);
}

export function hasMartialTechnique(sheet: CharacterSheet, technique: string): boolean {
  return (sheet.martialArtTechniques ?? []).includes(technique) && (sheet.skills.martialArt ?? 0) > 0;
}

/** Unarmed fighting is impossible in armour heavier than leather unless the art has Rustad strid (§16, §12.1). */
export function unarmedAllowed(c: Combatant): boolean {
  const pieces = new Set(Object.values(c.armour).flat());
  const defs = [...pieces].map(armourDef);
  if (!defs.some((d) => d.heavierThanLeather)) return true;
  if (!hasMartialTechnique(c.sheet, 'armouredFighting')) return false;
  return !defs.some((d) => d.forbidsMartialArts);
}

/** FV for an unarmed attack: martial art if it includes the attack (punch/kick always included), else brawling. */
export function unarmedFV(sheet: CharacterSheet, attackId: string): number {
  const ua = UNARMED[attackId];
  const brawling = sheet.skills.brawling ?? 0;
  const art = sheet.skills.martialArt ?? 0;
  if (ua.technique) return hasMartialTechnique(sheet, ua.technique) ? art : 0;
  return Math.max(brawling, art);
}

/** A hand is free for punching when it holds nothing and isn't helping with a two-handed grip. */
export function hasFreeHand(c: Combatant): boolean {
  const main = heldItem(c, 'main');
  const off = heldItem(c, 'off');
  if (!main) return true;
  return !off && !twoHandedGrip(c) && !needsTwoHands(c, main.def);
}

// ---------------------------------------------------------------------------
// Armour on a location
// ---------------------------------------------------------------------------

export interface LocationArmour {
  absKP: number;
  absSP: number;
  glance: 'metal' | 'lamellar' | 'chain' | null;
  names: string[];
}

const GLANCE_RANK = { metal: 3, lamellar: 2, chain: 1 } as const;

/** KH layering (§8.2): abs KP adds up, abs SP is the highest single layer. */
export function armourAt(c: Combatant, loc: Location): LocationArmour {
  let absKP = 0;
  let absSP = 0;
  let glance: LocationArmour['glance'] = null;
  const names: string[] = [];
  for (const pid of c.armour[loc]) {
    const d = armourDef(pid);
    absKP += d.absKP;
    absSP = Math.max(absSP, d.absSP);
    if (d.glance && (!glance || GLANCE_RANK[d.glance] > GLANCE_RANK[glance])) glance = d.glance;
    names.push(d.name);
  }
  return { absKP, absSP, glance, names };
}

// ---------------------------------------------------------------------------
// Actions per round (§4.3)
// ---------------------------------------------------------------------------

export interface ActionCount {
  total: number;
  parts: { label: string; value: number }[];
  /** Extra actions from a very high weapon FV, usable only with that weapon (HH 803–810). */
  restricted: { weapon: SlotWeapon; n: number } | null;
}

/** The held weapon (or unarmed art) with the highest FV, if it is above 20. */
export function heroicWeapon(c: Combatant): { weapon: SlotWeapon; fv: number; extra: number } | null {
  const candidates: { weapon: SlotWeapon; fv: number }[] = [];
  for (const hand of ['main', 'off'] as const) {
    const h = heldItem(c, hand);
    if (h && h.def.kind !== 'shield') candidates.push({ weapon: hand, fv: weaponFV(c.sheet, h.state.def) });
  }
  if (!heldItem(c, 'main') && !heldItem(c, 'off')) candidates.push({ weapon: 'unarmed', fv: Math.max(c.sheet.skills.martialArt ?? 0, c.sheet.skills.brawling ?? 0) });
  const best = candidates.sort((a, b) => b.fv - a.fv)[0];
  if (!best || best.fv <= 20) return null;
  return { ...best, extra: Math.floor((best.fv - 1) / 20) };
}

export function effectiveSMI(c: Combatant): number {
  return Math.max(1, c.sheet.attributes.SMI + c.derived.loadPenalty);
}

export function countActions(c: Combatant, bloodDrawn = false): ActionCount {
  const parts: { label: string; value: number }[] = [];
  const smi = effectiveSMI(c);
  parts.push({ label: smi >= 19 ? 'SMI 19+' : 'base (SMI ≤ 18)', value: smi >= 19 ? 3 : 2 });

  // Eastern armour never reduces the number of actions (KH 7354–7364).
  const pieces = [...new Set(Object.values(c.armour).flat())].map(armourDef).filter((p) => !p.eastern);
  const hb = Math.min(0, ...pieces.map((p) => p.hb ?? 0));
  const w = round1(pieces.reduce((s, p) => s + p.weight, 0) * armourWeightFactor(c.sheet.attributes.STO + c.sheet.attributes.STY + c.sheet.attributes.FYS));
  const weightPenalty = w >= 60 ? -2 : w >= 30 ? -1 : 0;
  const armourPenalty = Math.min(hb, weightPenalty);
  if (armourPenalty < 0) parts.push({ label: `heavy armour (${w} kg)`, value: armourPenalty });

  const layered = (loc: Location) => {
    const defs = c.armour[loc].map(armourDef);
    return defs.length > 1 && defs.some((d) => d.type === 3);
  };
  if (layered('chest') || layered('leftArm') || layered('rightArm')) parts.push({ label: 'type III armour layered', value: -1 });

  const main = heldItem(c, 'main');
  const off = heldItem(c, 'off');
  if (main && off && off.def.kind === 'shield') parts.push({ label: 'shield + weapon', value: 1 });
  else if (main && off) parts.push({ label: 'weapon in each hand', value: 1 });
  else if (!main && !off && unarmedAllowed(c) && ((c.sheet.skills.brawling ?? 0) > 0 || (c.sheet.skills.martialArt ?? 0) > 0)) {
    parts.push({ label: 'two fists', value: 1 });
  }

  const light = [main, off].some((h) => h && h.def.kind !== 'shield' && c.sheet.attributes.STY >= h.def.sty + 10);
  if (light) parts.push({ label: 'light weapon (STY ≥ req + 10)', value: 1 });
  if ((c.sheet.abilities ?? []).includes('extremelyFast')) parts.push({ label: 'Extremely fast', value: 1 });
  if (bloodDrawn && hasHero(c, 'wildBeast')) parts.push({ label: 'Wild beast', value: 1 });

  const base = Math.max(1, Math.min(6, parts.reduce((s, p) => s + p.value, 0)));
  const hw = heroicWeapon(c);
  if (!hw) return { total: base, parts, restricted: null };
  const total = Math.min(6, base + hw.extra);
  if (total > base) parts.push({ label: `FV ${hw.fv} (only for that weapon)`, value: total - base });
  return { total, parts, restricted: total > base ? { weapon: hw.weapon, n: total - base } : null };
}

/** Action slots for a round: 1/1/1 first, extras into opp 1, 2, 3; the last `restricted.n` created are weapon-only. */
export function buildSlots(n: number, restricted: ActionCount['restricted']): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const opp = (i < 3 ? i + 1 : ((i - 3) % 3) + 1) as 1 | 2 | 3;
    const weapon = restricted && i >= n - restricted.n ? restricted.weapon : undefined;
    out.push({ opp, used: false, lost: false, ...(weapon ? { weapon } : {}) });
  }
  return out.sort((a, b) => a.opp - b.opp || (a.weapon ? 1 : 0) - (b.weapon ? 1 : 0));
}

/** Distribute N actions over the 3 opportunities: 1/1/1, extras into opp 1, 2, 3 (max 2 each). */
export function slotPlan(n: number): (1 | 2 | 3)[] {
  const plan: (1 | 2 | 3)[] = [];
  for (let i = 0; i < Math.min(n, 3); i++) plan.push((i + 1) as 1 | 2 | 3);
  for (let i = 3; i < n; i++) plan.push(((i - 3) % 3) + 1 as 1 | 2 | 3);
  return plan.sort((a, b) => a - b);
}
