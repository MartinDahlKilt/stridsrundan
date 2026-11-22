import { itemDef } from '../data/items';
import { lookup, BLOTTA_TABLE } from '../data/tables';
import { armOfHand, canWield, effectiveSMI, hasHero, hasMartialTechnique, heldItem } from './character';
import { attackCL, checkRanged, COVERED_BY_LOW, meleeWeapons, parryCL, rangedCL, rangedWeapon, resolveWeapon, type ClResult, type Mod, type ParryContext, type ParrySource, type ResolvedWeapon, type WeaponRef } from './cl';
import { currentFF, freeSlots, generalSlots, hasCondition, limbUsable, slotFor, slotWeaponOf } from './conditions';
import { magicOptions, shieldBV, shieldParry, type MagicOptions, type SpellTarget } from './magic';
import { enemiesOf, hiddenFrom, occupied, squares, log, visibleEnemiesOf, type Ctx } from './state';
import { canSee, concealed, coverNear, decoAt, HIDE_IN_BUSHES, inMap, LIGHTS, lineOfFire, movementCosts, TERRAIN, terrainAt } from './terrain';
import { neighbours } from './grid';
import { findHiddenFV, hideFV, silentMover } from './facing';
import type { Combatant, Location, Pos, SlotWeapon } from './types';
import { LOCATIONS, LOCATION_NAMES, mirror } from './types';

// ---------------------------------------------------------------------------
// Decision requests (engine → controller) and choices (controller → engine)
// ---------------------------------------------------------------------------

export interface LocOption {
  location: Location;
  exposed: boolean;
  cl: ClResult;
}

export interface TechniqueOption {
  id: string;
  name: string;
  fv: number;
  description: string;
}

export interface AttackOption {
  targetId: string;
  targetName: string;
  weapon: WeaponRef;
  weaponName: string;
  /** Weapon FV (manoeuvres such as Double strike start from FV/2). */
  fv: number;
  reach: number;
  exposed: Location | null;
  locations: LocOption[];
  wild: ClResult;
  /** House rules: the "wild" attack is the standard attack (no penalty, random location); aiming costs −5. */
  standard: boolean;
  techniques: TechniqueOption[];
  /** Hero manoeuvres available with this weapon (HH 812–864). */
  maneuvers: ManeuverOption[];
}

export type Maneuver = 'double' | 'triple' | 'lightning' | 'heroPainStrike' | 'breakWeapon';

export interface ManeuverOption {
  id: Maneuver;
  name: string;
  description: string;
}

export interface SwordThrowOption {
  targetId: string;
  targetName: string;
  weapon: WeaponRef;
  weaponName: string;
  cl: ClResult;
}

export interface ShotOption {
  targetId: string;
  targetName: string;
  weaponName: string;
  distanceM: number;
  /** Maximum range in metres (the CL drops at ½ and ¾ of it). */
  maxRangeM: number;
  /** People standing in the line of fire (each 50% to take the missile, II 1296). */
  inTheWay: string[];
  /** …of whom on the shooter's side. */
  friendsInTheWay: string[];
  random: ClResult;
  aimed: LocOption[];
}

export interface MoveOption {
  maxSquares: number;
  squares: Pos[];
}

export interface ActionOptions {
  attacks: AttackOption[];
  shots: ShotOption[];
  blockedShots: { targetName: string; reason: string }[];
  move: MoveOption | null;
  run: MoveOption | null;
  canAim: boolean;
  canReload: boolean;
  reloadInfo: string | null;
  loadouts: { index: number; name: string }[];
  canDefensive: boolean;
  /** Throw the sword (FV 21+, up to 3 squares, HH 848). */
  swordThrows: SwordThrowOption[];
  /** Spend the whole round psyching out the opponents (hero status, HH 866–902). */
  canIntimidate: boolean;
  /**
   * Take cover against shots this round (II 1307): only as the first thing in the round, when an enemy who acts
   * later (lower initiative) can shoot at you. Uses every action. `behind`: something next to you to duck behind;
   * `shooters`: who you're taking cover from. Normal SMI roll.
   */
  takeCover: { behind: string | null; smi: number; shooters: string[] } | null;
  /** Search for hidden enemies (Finna dolda ting, one action): `fv` and how many are hidden from you. */
  search: { fv: number; hidden: number } | null;
  /** Hide: possible in bushes or out of sight of every enemy, with nobody in reach (null if not). */
  hide: HideCheck | null;
  /** Hero points left (spend one to raise a roll one step). */
  heroPoints: number;
  /** Spells (null for non-casters, or when no general action is left). */
  magic: MagicOptions | null;
  /** Why some options are missing (shown to the human). */
  restrictions: string[];
}

export interface ParryOption {
  source: ParrySource;
  name: string;
  cl: ClResult;
}

export interface AttackSummary {
  attackerName: string;
  weaponName: string;
  location: Location | 'wild';
  cl: number;
  roll: number;
  outcome: string;
  ranged: boolean;
}

export type DecisionRequest =
  | { kind: 'action'; actorId: string; round: number; opp: number; options: ActionOptions }
  | { kind: 'parry'; actorId: string; attackerId: string; attack: AttackSummary; options: ParryOption[]; mustParry: boolean; heroPoints: number }
  | { kind: 'rollWithBlow'; actorId: string; spDamage: number; cl: number; location: Location }
  | { kind: 'firstStrike'; actorId: string; targetId: string; options: AttackOption[]; spearSet: boolean }
  | { kind: 'powerStrike'; actorId: string; targetId: string; psy: number; usesLeft: number }
  | { kind: 'lastStand'; actorId: string; reason: string; rounds: number };

export interface AttackChoice {
  kind: 'attack';
  targetId: string;
  weapon: WeaponRef;
  location: Location | 'wild';
  techniques: string[];
  maneuver?: Maneuver;
  /** Spend a hero point on the attack roll ("Höja CL", HH 2972). */
  heroPoint?: boolean;
}

/** Parry answer: option index, optionally spending a hero point on the parry roll. */
export type ParryAnswer = number | null | { index: number; heroPoint: boolean };

export type ActionChoice =
  | AttackChoice
  | { kind: 'shoot'; targetId: string; location: Location | null }
  | { kind: 'move'; to: Pos }
  | { kind: 'run'; to: Pos }
  | { kind: 'aim' }
  | { kind: 'reload' }
  | { kind: 'ready'; loadout: number }
  | { kind: 'defensive' }
  | { kind: 'throwSword'; targetId: string; weapon: WeaponRef }
  | { kind: 'intimidate' }
  /** Try to hide (Gömma sig): in bushes, or out of every enemy's sight. */
  | { kind: 'hide' }
  /** Att söka skydd (II 1307): at the start of the round, duck behind something or throw yourself down. */
  | { kind: 'takeCover'; how: 'cover' | 'drop' }
  /** Finna dolda ting: look for enemies hidden from you (one action). */
  | { kind: 'search' }
  /** Start a spell (and release it at once if it takes a single action – then `target` is needed). */
  | { kind: 'cast'; spell: string; e: number; suicide?: boolean; target?: SpellTarget; heroPoint?: boolean }
  /** Spend another action preparing/casting the spell in progress. */
  | { kind: 'castContinue' }
  /** The last action: release the spell in progress. */
  | { kind: 'castRelease'; target: SpellTarget; heroPoint?: boolean }
  | { kind: 'hold' };

/**
 * Answers: action → ActionChoice; parry → ParryAnswer; rollWithBlow / powerStrike / lastStand → boolean;
 * firstStrike → AttackChoice | null.
 */
export type DecisionAnswer = ActionChoice | ParryAnswer | boolean | AttackChoice;

// ---------------------------------------------------------------------------
// Hero manoeuvres (HH 812–864)
// ---------------------------------------------------------------------------

const SHAFTED_GROUPS = new Set(['spear', 'polearm', 'axe1h']);
const SHAFTED_TWO_HANDED = new Set(['beardedAxe', 'greatAxe', 'greatHammer', 'greatFlail', 'naginata']);
export const pairKey = (a: Combatant, b: Combatant) => [a.id, b.id].sort().join('|');

export function maneuverOptions(ctx: Ctx, c: Combatant, t: Combatant, w: ResolvedWeapon): ManeuverOption[] {
  const fv = w.fv;
  const out: ManeuverOption[] = [];
  if (fv < 21) return out;
  const multiUsed = c.techniquesUsed.includes('multiStrike');
  if (!multiUsed) out.push({ id: 'double', name: 'Double strike (Dubbelhugg)', description: `two attacks in one action, each from FV ${Math.floor(fv / 2)} (half FV); once per round` });
  if (!multiUsed && fv >= 31) out.push({ id: 'triple', name: 'Triple strike (Trippelhugg)', description: `three attacks in one action, each from FV ${Math.floor(fv / 3)}; once per round` });
  if (fv >= 24 && !ctx.state.engaged.includes(pairKey(c, t)))
    out.push({ id: 'lightning', name: 'Lightning attack (Blixtrande attack)', description: "−10 CL; if it succeeds, the opponent's parry is reduced by your margin of success. Only before any other attack between you" });
  if (fv >= 23) out.push({ id: 'heroPainStrike', name: 'Heroic pain strike (Smärtstöt)', description: '−7 CL; a hit forces a hard FYS roll or the target falls helpless this round and the next' });
  const tw = heldItem(t, 'main');
  const edged = w.kind === 'item' && (w.def.group === 'sword1h' || w.def.group === 'axe1h' || (w.def.group === 'twoHanded' && w.def.damageKind === 'cut'));
  if (edged && tw && (SHAFTED_GROUPS.has(tw.def.group) || SHAFTED_TWO_HANDED.has(tw.def.id)))
    out.push({ id: 'breakWeapon', name: 'Break weapon (Bryta vapen)', description: `−6 CL; hack through the wooden shaft of the ${tw.def.name} (STY + FV−6 vs its BV + the wielder's FV)` });
  return out;
}

function swordThrowOptions(ctx: Ctx, c: Combatant): SwordThrowOption[] {
  const out: SwordThrowOption[] = [];
  for (const hand of ['main', 'off'] as const) {
    const w = resolveWeapon(c, hand);
    if (!w || w.kind !== 'item' || w.fv < 21) continue;
    const isSword = w.def.group === 'sword1h' || ['greatSword', 'flamberge', 'bastardSword', 'nodachi'].includes(w.def.id);
    if (!isSword) continue;
    for (const t of visibleEnemiesOf(ctx, c)) {
      const d = squares(c.pos, t.pos, ctx.state.grid);
      if (d < 1 || d > 3 || !canSee(ctx.state.map, ctx.state.grid, c.pos, t.pos)) continue;
      out.push({ targetId: t.id, targetName: t.sheet.name, weapon: hand, weaponName: w.name, cl: attackCL(ctx, c, t, w, 'wild', { label: 'throw sword', value: -6 }, true) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weapon techniques (KH vapentekniker, §12) and martial-art add-ons
// ---------------------------------------------------------------------------

interface TechniqueDef {
  id: string;
  name: string;
  description: string;
  /** Which weapons it works with. */
  allowed: (w: ResolvedWeapon) => boolean;
  /** Martial-art technique (uses the martial-art FV) rather than a weapon technique. */
  martial?: boolean;
}

const anyMelee = () => true;
const swordOrDagger = (w: ResolvedWeapon) => w.kind === 'item' && (w.def.group === 'sword1h' || w.def.group === 'dagger');

export const TECHNIQUES: Record<string, TechniqueDef> = {
  strike: { id: 'strike', name: 'Strike (Hugg)', description: '+2 KP and SP damage', allowed: anyMelee },
  thrust: { id: 'thrust', name: 'Thrust (Stöt)', description: '+3 CL', allowed: anyMelee },
  predictOpening: { id: 'predictOpening', name: 'Predict opening (Förutse blotta)', description: '+5 CL against the exposed area', allowed: anyMelee },
  lunge: { id: 'lunge', name: 'Lunge (Lång stöt)', description: '+2 CL, +1 damage; target can only parry this opportunity', allowed: swordOrDagger },
  killingBlow: { id: 'killingBlow', name: 'Killing blow (Dödande anfall)', description: 'maximum damage', allowed: anyMelee },
  painStrike: { id: 'painStrike', name: 'Pain strike (Smärtstöt)', description: '−3 CL; maximum SP damage', allowed: anyMelee },
  kneeStrike: { id: 'kneeStrike', name: 'Knee strike (Knähugg)', description: 'opponent −5 to parry', allowed: anyMelee },
  bindBlade: { id: 'bindBlade', name: 'Bind blade (Vrida klinga)', description: '+5 CL against an arm', allowed: anyMelee },
  feint: { id: 'feint', name: 'Feint (Fint)', description: "halves the opponent's parry chance", allowed: anyMelee, martial: true },
};

export function techniqueFV(c: Combatant, id: string): number {
  const def = TECHNIQUES[id];
  if (!def) return 0;
  if (def.martial) return hasMartialTechnique(c.sheet, id) ? c.sheet.skills.martialArt ?? 0 : 0;
  return c.sheet.techniques?.[id] ?? 0;
}

function techniqueOptions(c: Combatant, w: ResolvedWeapon): TechniqueOption[] {
  const out: TechniqueOption[] = [];
  for (const def of Object.values(TECHNIQUES)) {
    const fv = techniqueFV(c, def.id);
    if (fv <= 0 || c.techniquesUsed.includes(def.id) || !def.allowed(w)) continue;
    out.push({ id: def.id, name: def.name, fv, description: def.description });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Blotta (§6.2)
// ---------------------------------------------------------------------------

/** The area `defender` exposes to `attacker` this round; rolled on first need. */
export function blottaFor(ctx: Ctx, defender: Combatant, attacker: Combatant): Location | null {
  if (defender.stance === 'defensive') return null;
  const existing = defender.blotta[attacker.id];
  if (existing) return existing;
  const roll = ctx.dice.d(20);
  let loc = lookup(BLOTTA_TABLE, roll);
  if (defender.fightingSide === 'left') loc = mirror(loc);
  defender.blotta[attacker.id] = loc;
  log(ctx, `${defender.sheet.name} exposes the ${LOCATION_NAMES[loc].toLowerCase()} to ${attacker.sheet.name} (1T20 → ${roll}).`, 'roll', 2, defender.id);
  return loc;
}

// ---------------------------------------------------------------------------
// Building the action menu
// ---------------------------------------------------------------------------

export function canAct(ctx: Ctx, c: Combatant): boolean {
  return c.status === 'active' && !hasCondition(c, ctx.state.round, 'cannotAct');
}

export function canAttackNow(ctx: Ctx, c: Combatant): string | null {
  const r = ctx.state.round;
  if (hasCondition(c, r, 'onlyParry')) return 'may only parry this round';
  if (hasCondition(c, r, 'noAttack')) return 'cannot attack';
  if (c.noCounterOpp === ctx.state.opp) return 'lunged at – can only parry this opportunity';
  if (c.stance === 'defensive' && !c.opponentFumbled) return 'fighting defensively';
  if (c.running) return 'running';
  const half = Math.floor(currentFF(c, r) / 2);
  if (c.movedThisRound > half) return 'moved too far to attack this round';
  return null;
}

export function meleeAttackOptions(ctx: Ctx, c: Combatant, onlyTarget?: Combatant): AttackOption[] {
  const out: AttackOption[] = [];
  const targets = onlyTarget ? [onlyTarget] : visibleEnemiesOf(ctx, c);
  const weapons = meleeWeapons(ctx, c);
  for (const t of targets) {
    // A long weapon can't reach round a corner or through a wall.
    if (!canSee(ctx.state.map, ctx.state.grid, c.pos, t.pos)) continue;
    for (const w of weapons) {
      if (squares(c.pos, t.pos, ctx.state.grid) > w.reach) continue;
      const exposed = ctx.rules.houseRules ? null : blottaFor(ctx, t, c);
      const locations = LOCATIONS.map((l) => ({ location: l, exposed: l === exposed, cl: attackCL(ctx, c, t, w, l) }));
      out.push({
        targetId: t.id,
        targetName: t.sheet.name,
        weapon: w.ref,
        weaponName: w.name,
        fv: w.fv,
        reach: w.reach,
        exposed,
        locations,
        wild: attackCL(ctx, c, t, w, 'wild'),
        standard: ctx.rules.houseRules,
        // No blotta under the house rules, so Förutse blotta has nothing to work on.
        techniques: techniqueOptions(c, w).filter((x) => !(ctx.rules.houseRules && x.id === 'predictOpening')),
        maneuvers: maneuverOptions(ctx, c, t, w),
      });
    }
  }
  return out;
}

/** Free cells a fighter can walk to with `max` movement: around walls and enemies, bushes and rubble costing 2. */
export function reachableSquares(ctx: Ctx, c: Combatant, max: number): Pos[] {
  return moveCosts(ctx, c, max).cells().filter((r) => r.cost > 0 && !occupied(ctx, r.p, c)).map((r) => r.p);
}

/** Movement cost to every cell within `max` – enemies can't be walked through, allies can (but not stopped on). */
export function moveCosts(ctx: Ctx, c: Combatant, max: number) {
  const s = ctx.state;
  const enemies = enemiesOf(ctx, c);
  return movementCosts(s.map, s.grid, c.pos, max, (p) => enemies.some((e) => e.pos.x === p.x && e.pos.y === p.y));
}

/** Movement allowance for one Move action (§15.1, SIM-7). */
export function moveAllowance(ctx: Ctx, c: Combatant): number {
  const ff = currentFF(c, ctx.state.round);
  const half = Math.floor(ff / 2);
  const budget = c.attackedThisRound || c.shotThisRound ? half : ff;
  // Sneaking (staying hidden) is at most half speed (I 2300) – unless Smyga is above 20 (HH 626).
  const cap = c.hidden && !silentMover(c) ? Math.min(half, Math.max(1, Math.floor(half / 2))) : half;
  return Math.max(0, Math.min(cap, budget - c.movedThisRound));
}

export function buildActionOptions(ctx: Ctx, c: Combatant): ActionOptions {
  const r = ctx.state.round;
  const restrictions: string[] = [];
  const attackBlock = canAttackNow(ctx, c);
  if (attackBlock) restrictions.push(`No attacks: ${attackBlock}.`);
  const onlyParry = hasCondition(c, r, 'onlyParry');
  // Extra actions from a very high FV can only be used with that weapon (HH 803–810).
  const general = generalSlots(c, ctx.state.opp).length > 0;
  const weaponOnly = new Set(freeSlots(c, ctx.state.opp).filter((s) => s.weapon).map((s) => s.weapon as SlotWeapon));
  if (!general && weaponOnly.size) restrictions.push('Only actions with your heroic weapon remain this opportunity.');
  const usable = (ref: string) => general || weaponOnly.has(slotWeaponOf(ref)!);

  const attacks = attackBlock ? [] : meleeAttackOptions(ctx, c).filter((o) => usable(o.weapon));
  const shots: ShotOption[] = [];
  const blockedShots: { targetName: string; reason: string }[] = [];
  const rw = rangedWeapon(c);
  if (rw && !attackBlock && usable('main')) {
    for (const t of visibleEnemiesOf(ctx, c)) {
      const check = checkRanged(ctx, c, t);
      if (!check.ok) {
        blockedShots.push({ targetName: t.sheet.name, reason: check.reason! });
        continue;
      }
      const line = lineOfFire(ctx.state.map, ctx.state.grid, c.pos, t.pos);
      const between = ctx.state.combatants.filter((x) => x !== c && x !== t && x.status === 'active' && line.some((p) => p.x === x.pos.x && p.y === x.pos.y));
      shots.push({
        targetId: t.id,
        targetName: t.sheet.name,
        weaponName: rw.def.name,
        distanceM: check.distanceM,
        maxRangeM: check.maxRangeM,
        inTheWay: between.map((x) => x.sheet.name),
        friendsInTheWay: between.filter((x) => x.team === c.team).map((x) => x.sheet.name),
        random: rangedCL(ctx, c, t, null),
        aimed: LOCATIONS.filter((l) => !(check.cover && COVERED_BY_LOW.includes(l))).map((l) => ({ location: l, exposed: false, cl: rangedCL(ctx, c, t, l) })),
      });
    }
  }

  const allowance = onlyParry || c.running || !general ? 0 : moveAllowance(ctx, c);
  const move = allowance > 0 ? { maxSquares: allowance, squares: reachableSquares(ctx, c, allowance) } : null;
  const noSlotsUsed = c.slots.every((s) => !s.used);
  const ff = currentFF(c, r);
  const run = !onlyParry && general && noSlotsUsed && !c.attackedThisRound && ff > 0 ? { maxSquares: ff * 2, squares: reachableSquares(ctx, c, ff * 2) } : null;

  const held = heldItem(c, 'main');
  const canReload = general && !!held && held.def.kind === 'projectile' && !!held.def.reload && !held.state.loaded && (c.ammo[held.def.ammo!] ?? 0) > 0;
  const reloadInfo = canReload ? `${c.reloadLeft || held!.def.reload! * Math.max(1, c.slots.length)} actions to reload` : null;
  const canAim = general && !!rw && !onlyParry && c.aimBonus < 3 && (!rw.def.reload || c.items[rw.key].loaded);

  const loadouts = c.sheet.equipment.loadouts
    .map((lo, index) => ({ lo, index }))
    .filter(({ lo, index }) => index !== c.loadoutIndex || c.hands.main !== lo.main || c.hands.off !== lo.off)
    .filter(({ lo }) => [lo.main, lo.off].every((k) => !k || (c.items[k]?.status === 'carried' && c.items[k].count > 0 && canWield(c, itemDef(c.items[k].def)))))
    .filter(({ lo }) => armsFor(c, lo, r))
    .filter(() => general || hasHero(c, 'quickDraw'))
    .map(({ lo, index }) => ({ index, name: lo.name }));

  const engaged = enemiesOf(ctx, c).filter((e) => squares(c.pos, e.pos, ctx.state.grid) <= Math.max(maxReach(ctx, c), maxReach(ctx, e)));
  const canDefensive =
    general && c.stance === 'normal' && noSlotsUsed && engaged.length > 0 && engaged.every((e) => c.initiative > e.initiative) && !onlyParry;

  const hide = general && !onlyParry && !c.running && engaged.length === 0 ? hideCheck(ctx, c) : null;
  // Shooters who act after `c` this round and could shoot at it.
  const shooters =
    ctx.state.opp === 1 && noSlotsUsed
      ? visibleEnemiesOf(ctx, c).filter((e) => {
          const w = rangedWeapon(e);
          return e.initiative < c.initiative && !!w && (!w.def.reload || e.items[w.key].loaded) && !hiddenFrom(c, e) && canSee(ctx.state.map, ctx.state.grid, e.pos, c.pos);
        })
      : [];
  const takeCover =
    general && !onlyParry && !c.running && !c.casting && shooters.length > 0 && c.tookCover?.round !== r
      ? { behind: coverNear(ctx.state.map, ctx.state.grid, c.pos), smi: effectiveSMI(c), shooters: shooters.map((e) => e.sheet.name) }
      : null;
  const hiddenEnemies = enemiesOf(ctx, c).filter((e) => hiddenFrom(e, c)).length;
  const search = general && !onlyParry && !c.running && hiddenEnemies > 0 ? { fv: findHiddenFV(c).fv, hidden: hiddenEnemies } : null;
  const swordThrows = attackBlock ? [] : swordThrowOptions(ctx, c).filter((o) => usable(o.weapon));
  const canIntimidate =
    !!c.hero && general && noSlotsUsed && !onlyParry && !c.running && enemiesOf(ctx, c).some((e) => !c.hero!.psyched.includes(e.id));
  // Casting needs a general action; spells aren't attacks, so only "may only parry" and running stop them.
  const magic = general && !onlyParry && !c.running ? magicOptions(ctx, c) : null;
  if (magic?.blocked && c.sheet.magic) restrictions.push(`No new spells: ${magic.blocked}.`);

  return {
    attacks,
    shots,
    blockedShots,
    move,
    run,
    canAim,
    canReload,
    reloadInfo,
    loadouts,
    canDefensive,
    swordThrows,
    canIntimidate,
    takeCover,
    search,
    hide,
    heroPoints: c.hero?.points ?? 0,
    magic,
    restrictions,
  };
}

export interface HideCheck {
  fv: number;
  cl: number;
  note: string;
  /** " in the bushes" / " out of sight". */
  where: string;
}

/**
 * Can `c` hide right now, and at what CL? Gömma sig (INT, I 2254) needs somewhere to be out of sight for a while –
 * shadows, behind an obstacle, under a cart, in bushes – and no enemy within reach. The game master's modifier for
 * the spot (the best one at hand):
 *   out of every enemy's sight +3, under a cart +3, in bushes +2, behind a crate, barrel, table, stall or fence +1,
 *   in the shadow of a wall, house, tree, boulder or pillar ±0, anywhere in darkness ±0;
 * plus the light (dusk/torchlight +2, night +5).
 */
export function hideCheck(ctx: Ctx, c: Combatant): HideCheck | null {
  // A fighter can hide again once someone has found it.
  if (c.hidden && !c.spottedBy.length) return null;
  const s = ctx.state;
  const spot = hidingSpot(ctx, c);
  if (!spot) return null;
  const fv = hideFV(c);
  if (fv <= 0) return null;
  const light = LIGHTS[s.map.light].hide;
  const cl = fv + spot.mod + light;
  const notes = [spot.mod ? `${spot.mod > 0 ? '+' : ''}${spot.mod} ${spot.label}` : '', light ? `+${light} ${LIGHTS[s.map.light].name.toLowerCase()}` : ''].filter(Boolean);
  return { fv, cl, note: notes.length ? ` (${fv} ${notes.join(', ')})` : '', where: ` ${spot.where}` };
}

/** The best place to hide right where `c` stands, if any. */
export function hidingSpot(ctx: Ctx, c: Combatant): { where: string; label: string; mod: number } | null {
  const s = ctx.state;
  const options: { where: string; label: string; mod: number }[] = [];
  if (!enemiesOf(ctx, c).some((e) => canSee(s.map, s.grid, e.pos, c.pos))) options.push({ where: 'out of sight', label: 'out of sight', mod: 3 });
  if (concealed(s.map, c.pos)) options.push({ where: 'in the bushes', label: 'bushes', mod: HIDE_IN_BUSHES });
  for (const n of neighbours(c.pos, s.grid)) {
    const kind = terrainAt(s.map, n);
    const deco = decoAt(s.map, n);
    if (kind === 'low' && deco === 'cart') options.push({ where: 'under the cart', label: 'under a cart', mod: 3 });
    else if (kind === 'low') options.push({ where: `behind the ${deco || 'obstacle'}`, label: `behind a ${deco || 'obstacle'}`, mod: 1 });
    else if (TERRAIN[kind].blocksSight && inMap(s.map, n)) options.push({ where: `in the shadow of the ${TERRAIN[kind].name}`, label: 'shadow', mod: 0 });
  }
  if (s.map.light === 'dark') options.push({ where: 'in the darkness', label: 'darkness', mod: 0 });
  return options.sort((a, b) => b.mod - a.mod)[0] ?? null;
}

function armsFor(c: Combatant, lo: { main: string | null; off: string | null }, round: number): boolean {
  if (lo.main && !limbUsable(c, armOfHand(c, 'main'), round)) return false;
  if (lo.off && !limbUsable(c, armOfHand(c, 'off'), round)) return false;
  return true;
}

export function maxReach(ctx: Ctx, c: Combatant): number {
  return Math.max(0, ...meleeWeapons(ctx, c).map((w) => w.reach));
}

export function hasAnyOption(o: ActionOptions): boolean {
  return (
    o.attacks.length > 0 ||
    o.shots.length > 0 ||
    !!o.move ||
    !!o.run ||
    o.canAim ||
    o.canReload ||
    o.loadouts.length > 0 ||
    o.canDefensive ||
    o.swordThrows.length > 0 ||
    o.canIntimidate ||
    !!o.hide ||
    !!o.takeCover ||
    !!o.search ||
    !!o.magic?.spells.length ||
    !!(o.magic?.casting && !o.magic.casting.reactionOnly)
  );
}

// ---------------------------------------------------------------------------
// Parry options (§7.2)
// ---------------------------------------------------------------------------

export function canParryNow(ctx: Ctx, d: Combatant): boolean {
  const r = ctx.state.round;
  if (!canAct(ctx, d)) return false;
  if (hasCondition(d, r, 'noParry') || d.running) return false;
  return freeSlots(d, ctx.state.opp).length > 0;
}

function holdingProjectileWeapon(d: Combatant): boolean {
  return heldItem(d, 'main')?.def.kind === 'projectile';
}

export function meleeParryOptions(ctx: Ctx, d: Combatant, a: Combatant, w: ResolvedWeapon, pc: ParryContext): ParryOption[] {
  if (!canParryNow(ctx, d)) return [];
  const spell = slotFor(d, ctx.state.opp, null) ? spellParryOptions(ctx, d) : [];
  if (holdingProjectileWeapon(d)) return spell;
  const r = ctx.state.round;
  const out: ParryOption[] = [];
  for (const hand of ['main', 'off'] as const) {
    const held = heldItem(d, hand);
    if (!held || (held.def.kind !== 'melee' && held.def.kind !== 'shield')) continue;
    if (!canWield(d, held.def) || !limbUsable(d, armOfHand(d, hand), r)) continue;
    const src: ParrySource = { kind: 'item', hand };
    out.push({ source: src, name: held.def.name, cl: parryCL(ctx, d, a, src, pc) });
  }
  const unarmedAttack = w.kind === 'unarmed';
  const handsEmpty = !heldItem(d, 'main') && !heldItem(d, 'off');
  if (handsEmpty && (unarmedAttack || hasMartialTechnique(d.sheet, 'unarmedWeaponParry'))) {
    const src: ParrySource = { kind: 'unarmed' };
    const cl = parryCL(ctx, d, a, src, pc);
    if (cl.fv > 0) out.push({ source: src, name: 'Unarmed parry', cl });
  }
  return [...out.filter((o) => !!slotFor(d, ctx.state.opp, parrySlotWeapon(o.source))), ...spell];
}

/** Which restricted slot a parry may use. */
export function parrySlotWeapon(src: ParrySource): SlotWeapon | null {
  if (src.kind === 'item') return src.hand;
  if (src.kind === 'spell') return null;
  return 'unarmed';
}

/** SKÖLD as a parry option: prepared earlier, or instant with S above 30 (§22.6). */
function spellParryOptions(ctx: Ctx, d: Combatant): ParryOption[] {
  const sp = shieldParry(ctx, d);
  if (!sp) return [];
  const src: ParrySource = { kind: 'spell', e: sp.e, prepared: sp.prepared };
  return [{ source: src, name: `SKÖLD spell (E${sp.e}, BV ${shieldBV(sp.e)}${sp.prepared ? ', prepared' : ', 1 action'})`, cl: sp.cl }];
}

export function rangedParryOptions(ctx: Ctx, d: Combatant, a: Combatant, thrown: boolean): ParryOption[] {
  if (!canParryNow(ctx, d)) return [];
  const spell = slotFor(d, ctx.state.opp, null) ? spellParryOptions(ctx, d) : [];
  if (holdingProjectileWeapon(d)) return spell;
  const r = ctx.state.round;
  const pc: ParryContext = { wild: false, chain: false, feint: false, kneeStrike: false, attackerActions: a.slots.length };
  const out: ParryOption[] = [];
  if (hasMartialTechnique(d.sheet, 'projectileParry')) {
    const src: ParrySource = { kind: 'projectileParry' };
    out.push({ source: src, name: 'Projectile parry', cl: parryCL(ctx, d, a, src, pc) });
  }
  for (const hand of ['main', 'off'] as const) {
    const held = heldItem(d, hand);
    if (!held || !limbUsable(d, armOfHand(d, hand), r) || !canWield(d, held.def)) continue;
    const shieldVsThrown = thrown && held.def.kind === 'shield';
    const quick = (d.sheet.abilities ?? []).includes('quickPerception') && held.def.kind === 'melee';
    // Hero ability Projektilparering: edged weapon, shield or staff (HH 368).
    const heroic =
      hasHero(d, 'projectileParry') && (held.def.kind === 'shield' || (held.def.kind === 'melee' && (held.def.damageKind !== 'blunt' || held.def.group === 'polearm')));
    if (!shieldVsThrown && !quick && !heroic) continue;
    const src: ParrySource = { kind: 'item', hand };
    out.push({ source: src, name: heroic && !shieldVsThrown ? `${held.def.name} (projectile parry)` : held.def.name, cl: parryCL(ctx, d, a, src, pc) });
  }
  return [...out.filter((o) => !!slotFor(d, ctx.state.opp, parrySlotWeapon(o.source))), ...spell];
}

export { resolveWeapon };
export type { Mod };
