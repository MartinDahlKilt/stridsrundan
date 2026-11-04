import type { DiceExpr } from './dice';

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export type Location = 'head' | 'chest' | 'abdomen' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

export const LOCATIONS: Location[] = ['head', 'chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

export const LOCATION_NAMES: Record<Location, string> = {
  head: 'Head',
  chest: 'Chest',
  abdomen: 'Abdomen',
  leftArm: 'Left arm',
  rightArm: 'Right arm',
  leftLeg: 'Left leg',
  rightLeg: 'Right leg',
};

export const isArm = (l: Location) => l === 'leftArm' || l === 'rightArm';
export const isLeg = (l: Location) => l === 'leftLeg' || l === 'rightLeg';
export const isLimb = (l: Location) => isArm(l) || isLeg(l);

export function mirror(l: Location): Location {
  switch (l) {
    case 'leftArm':
      return 'rightArm';
    case 'rightArm':
      return 'leftArm';
    case 'leftLeg':
      return 'rightLeg';
    case 'rightLeg':
      return 'leftLeg';
    default:
      return l;
  }
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export type Attribute = 'STY' | 'FYS' | 'SMI' | 'INT' | 'PSY' | 'KAR' | 'STO';
export type Attributes = Record<Attribute, number>;

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  STY: 'Strength',
  FYS: 'Constitution',
  SMI: 'Dexterity',
  INT: 'Intelligence',
  PSY: 'Psyche',
  KAR: 'Charisma',
  STO: 'Size',
};

/** right/left; dubbelhänt = either hand, not both at once; ambidextrous = both at once (§2.6). */
export type Handedness = 'right' | 'left' | 'dubbelhant' | 'ambidextrous';

export type Race = 'human' | 'elf' | 'dwarf' | 'halfling' | 'halfelf' | 'halforc' | 'duck';

export type Profession =
  | 'warrior'
  | 'barbarian'
  | 'knight'
  | 'gladiator'
  | 'swashbuckler'
  | 'weaponmaster'
  | 'soldier'
  | 'assassin'
  | 'ranger'
  | 'warriorMonk'
  | 'samurai'
  | 'ronin'
  | 'kensai'
  | 'budoka'
  | 'ninja'
  | 'paladin'
  | 'bountyHunter'
  | 'thief'
  | 'mariner'
  | 'monk'
  | 'bard'
  | 'healer'
  | 'scholar'
  | 'wizard'
  | 'archmage';

export type SpecialAbility =
  | 'precision' // Precisionssinne: +1 CL all weapons
  | 'lightningReflexes' // Blixtrande reflexer: +3 initiative
  | 'quickStriker' // Snabbslående: always first
  | 'painTolerant' // Smärttålig: SP x1.5
  | 'tough' // Stryktålig: KP x1.5
  | 'findOpening' // Finna blotta: opponent abs KP −3
  | 'quickPerception' // Snabb uppfattningsförmåga: +5 parry, parry projectiles
  | 'extremelyFast'; // Extremt snabb: +1 action

/** Hero abilities from Hjältarnas Handbok (HH 279–495) that matter in a fight. */
export type HeroAbility =
  | 'ironFist' // Järnnäve: unarmed blows always do maximum damage incl. SB
  | 'quickDraw' // Snabbdragning: drawing/switching weapons costs no action
  | 'powerStrike' // Kraftslag: after a hit, spend 1T6 PSY for maximum damage (4×/day)
  | 'quickStriker' // Snabbslående: always wins initiative
  | 'projectileParry' // Projektilparering: parry thrown and shot weapons with an edged weapon, shield or staff
  | 'steeled' // Stålsättning: takes damage like a berserker (PSY roll instead of skill roll)
  | 'weaponMaster' // Vapenmästare: +5 CL with all weapons
  | 'wildBeast' // Vilddjuret: once blood has been drawn, SB +1T6, CL +3, +1 action
  | 'favouredByGods' // Gudarnas gunstling: KP restored when total KP reaches 0 (chance)
  | 'fearless' // Orädd: can't be psyched out
  | 'heroicReflexes'; // archetype "Den ljusskygge hjälten": +5 initiative

export interface HeroSheet {
  /** Hero status 1–5 (Nybörjarhjälte … Legendarisk hjälte), HH 515–538. */
  status: 1 | 2 | 3 | 4 | 5;
  heroPoints: number;
  /** Dark heroes count as one status step higher when psyching out opponents. */
  dark?: boolean;
  abilities: HeroAbility[];
  /** Short title/epithet shown in the UI. */
  title?: string;
}

/** Magic schools (III 18–66). Allmänna (general) spells count as the caster's best school. */
export type MagicSchool = 'elemental' | 'animism' | 'mentalism';

/** Spellcasting (basic rules III 9–520, Magikerns Handbok). */
export interface MagicSheet {
  /** FV per school: limits the effect grade (max E = school FV). */
  schools: Partial<Record<MagicSchool, number>>;
  /** Skicklighetsvärde (S) per known spell id (see data/spells.ts). */
  spells: Record<string, number>;
  /** PSY points stored in a staff with a PSY-källa (MH 2390); spent before the caster's own. */
  staffPsy?: number;
}

export interface Loadout {
  name: string;
  main: string | null; // item key in equipment.items
  off: string | null;
}

export interface CharacterSheet {
  id: string;
  name: string;
  profession: Profession;
  /** UI name of the profession. */
  professionName: string;
  race: Race;
  description: string;
  attributes: Attributes;
  handedness: Handedness;
  /**
   * Skill values (FV). Keys are item ids (weapon/shield skills) or one of:
   * twoWeapons, brawling, martialArt, fallTechnique.
   */
  skills: Record<string, number>;
  /** Weapon technique (vapenteknik) FVs, keyed by technique id. */
  techniques?: Record<string, number>;
  /** From the optional eastern-warriors chapter: only offered when that rules option is on. */
  eastern?: boolean;
  /** Techniques included in the character's martial art (one FV = skills.martialArt). */
  martialArtTechniques?: string[];
  abilities?: SpecialAbility[];
  /** Present for heroes (Hjältarnas Handbok). */
  hero?: HeroSheet;
  /** Present for spellcasters. */
  magic?: MagicSheet;
  equipment: {
    /** Items carried. Key → item def id and optional count (thrown weapons). */
    items: Record<string, { def: string; count?: number }>;
    /** Ammunition carried, by ammo type. */
    ammo?: Record<string, number>;
    /** Weapon configurations; the first is the starting one. Switching costs one action. */
    loadouts: Loadout[];
    /** Armour piece ids worn. */
    armour: string[];
  };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type ItemKind = 'melee' | 'projectile' | 'thrown' | 'shield';

export type WeaponGroup =
  | 'dagger'
  | 'sword1h'
  | 'blunt1h'
  | 'axe1h'
  | 'twoHanded'
  | 'spear'
  | 'flail'
  | 'whip'
  | 'polearm'
  | 'bow'
  | 'crossbow'
  | 'sling'
  | 'thrown'
  | 'shield'
  | 'unarmed';

export type DamageKind = 'cut' | 'thrust' | 'blunt';

export type ShieldCover = 'shieldArm' | 'chest' | 'abdomen' | 'shieldLeg';

export interface ItemDef {
  id: string;
  name: string;
  /** Swedish name in the rule books. */
  sv: string;
  /** From the optional eastern-warriors chapter (only usable when that rules option is on). */
  eastern?: boolean;
  kind: ItemKind;
  group: WeaponGroup;
  kp: string;
  sp: string;
  sty: number;
  length: number;
  weight: number;
  bv: number | null;
  damageKind: DamageKind;
  /** Can never be used with one hand (marked * in the basic table). */
  twoHandedOnly?: boolean;
  /** Can only be used with one hand (thrown weapons). */
  oneHandedOnly?: boolean;
  /** Projectile max range in metres. */
  range?: number;
  /** Thrown weapons: range = thrower's STY in squares. */
  rangeIsSty?: boolean;
  /** Reload time in SR. */
  reload?: number;
  pv?: { kp: number; sp: number };
  ammo?: string;
  /** Chain weapons and whips: parry CL halved, 18–20 auto miss with fumble risk (§10.2). */
  chain?: boolean;
  /** Spears, pikes, staves, natural weapons can't damage a parrying weapon. */
  noBvDamage?: boolean;
  /** Light weapon for critical-hit purposes (roll 1T10 instead of 1T20). */
  lightForCrits?: boolean;
  parryBonus?: number;
  covers?: ShieldCover[];
  /** Separate damage when wielded with two hands (katana, KH 7097–7116) – replaces the +1T2 grip bonus. */
  twoHandedDamage?: { kp: string; sp: string };
}

export type GlanceClass = 'metal' | 'lamellar' | 'chain' | null;

export interface ArmourPieceDef {
  id: string;
  name: string;
  sv: string;
  absKP: number;
  absSP: number;
  /** Type code I/II/III for layering (KH). */
  type: 1 | 2 | 3;
  glance: GlanceClass;
  weight: number;
  covers: Location[];
  /** Action penalty listed for complete armours (HB). */
  hb?: number;
  /** Heaviest classes where martial arts are impossible even with Rustad strid. */
  forbidsMartialArts?: boolean;
  /** Heavier than leather (martial arts need Rustad strid). */
  heavierThanLeather?: boolean;
  /** Eastern armour (KH 7354–7500): never reduces the number of actions. */
  eastern?: boolean;
  /** Contains iron: a wizard wearing it can't cast spells (III 507). */
  iron?: boolean;
}

// ---------------------------------------------------------------------------
// Effects and conditions (criticals, fumbles, special situations)
// ---------------------------------------------------------------------------

export type ClScope = 'all' | 'attack' | 'parry' | 'attackParry' | 'ranged' | 'mainHand' | 'hitArm';

/** Relative round window: 0 = this round, 1 = next round, … 'fight' = rest of the fight. */
export type RoundSpan = { from: number; through: number | 'fight' } | { uses: number };

export type Effect =
  | { t: 'loseActions'; n: number }
  | { t: 'loseRestOfRound' }
  | { t: 'cannotAct'; from: number; through: number | string } // through may be a dice string, e.g. "1T6"
  | { t: 'onlyParry'; from: number; through: number }
  | { t: 'noParry'; from: number; through: number }
  | { t: 'noAttack'; from: number; through: number | 'fight' }
  | { t: 'autoFail'; span: RoundSpan | { from: number; throughDice: string } }
  | { t: 'missNext'; uses: number }
  | { t: 'clMod'; value: number; scope: ClScope; span: RoundSpan | { from: number; throughDice: string } }
  | { t: 'actionPenalty'; n: number }
  | { t: 'bleed'; kp: number; every: number }
  | { t: 'limbUnusable'; which: 'hit' | 'randomArm' | 'shieldArm'; throughDice?: string }
  | { t: 'dropItem'; which: 'hit' | 'main' | 'shield'; squares?: string }
  | { t: 'breakItem'; which: 'main' | 'shield' }
  | { t: 'movementFactor'; factor: number }
  | { t: 'ffMod'; value: number }
  | { t: 'prone'; through: number | 'fight' }
  | { t: 'opponentBonus'; value: number; span: RoundSpan }
  | { t: 'autoHitAgainst'; uses: number; noParry: boolean }
  | { t: 'selfDamage'; kp: number; location: Location | 'randomLeg' | 'mainArm' }
  | { t: 'loseArmour' }
  | { t: 'hitFriend' }
  | { t: 'out'; kind: OutKind; reason: string }
  | { t: 'rollTwice' };

export type OutKind = 'unconscious' | 'dying' | 'dead' | 'incapacitated';

export interface TableEntry {
  roll: number;
  text: string;
  effects: Effect[];
}

export type ConditionKind =
  | 'clMod'
  | 'cannotAct'
  | 'onlyParry'
  | 'noParry'
  | 'noAttack'
  | 'autoFail'
  | 'missNext'
  | 'actionPenalty'
  | 'opponentBonus'
  | 'autoHitAgainst'
  | 'prone'
  | 'movementFactor'
  | 'ffMod'
  | 'limbUnusable';

export interface Condition {
  kind: ConditionKind;
  value?: number;
  scope?: ClScope;
  location?: Location;
  noParry?: boolean;
  /** Absolute round numbers (inclusive). */
  fromRound: number;
  throughRound: number;
  /** For use-counted conditions (next attack, next parry, …). */
  uses?: number;
  text: string;
}

export interface Bleed {
  kp: number;
  every: number;
  counter: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Combat state
// ---------------------------------------------------------------------------

export interface Pos {
  x: number;
  y: number;
}

export interface Pool {
  max: number;
  cur: number;
}

export interface ItemState {
  def: string;
  bv: number | null;
  count: number;
  status: 'carried' | 'dropped' | 'broken' | 'thrown';
  /** Crossbows: whether a bolt is loaded. */
  loaded: boolean;
}

export type SlotWeapon = 'main' | 'off' | 'unarmed';

export interface Slot {
  opp: 1 | 2 | 3;
  used: boolean;
  lost: boolean;
  /** Extra action from a very high weapon FV: only for attacks/parries with that weapon (HH 803–810). */
  weapon?: SlotWeapon;
}

/** Per-fight hero state. */
export interface HeroState {
  points: number;
  powerStrikesLeft: number;
  lastStandUsed: boolean;
  /** Last round of a suicide attack (the hero dies after it). */
  lastStandUntil: number | null;
  /** Spending this whole round psyching out the opponents. */
  psyching: boolean;
  /** Opponents already psyched by this hero. */
  psyched: string[];
  /** Locations for which the Steeling PSY roll has been made. */
  steeledChecks: Location[];
  /** …and those where the roll succeeded (the wound is ignored). */
  steeledOk: Location[];
  /** Double/triple strike used this round. */
  multiStrikeUsed: boolean;
}

/** A spell being prepared/cast over several actions (MH "Magi och handlingar"). */
export interface CastingState {
  spell: string;
  e: number;
  /** Actions spent so far. */
  done: number;
  /** Actions the whole casting takes; the last one releases the spell. */
  total: number;
  /** Suicide spell (III 225): PSY may go below zero, CL = unmodified S, the caster dies. */
  suicide: boolean;
}

/** An ongoing spell effect on a combatant (or on one of the combatant's items). */
export interface ActiveSpell {
  kind: 'whirlwind' | 'flamingHand' | 'weapon';
  /** Effect grade (whirlwind, flaming hand) or CL/damage modifier (weapon). */
  value: number;
  /** Item key for weapon enchantments/curses. */
  itemKey?: string;
  throughRound: number;
  name: string;
}

/** Ongoing fire damage (ELDKLOT, INRE ELD): at the end of each round, total KP and SP without armour. */
export interface Burn {
  dice: string;
  /** First and last round in which it burns. */
  fromRound: number;
  throughRound: number;
  source: string;
}

export interface Derived {
  kpMax: Record<Location, number>;
  kpTotalMax: number;
  spMax: Record<Location, number>;
  spTotalMax: number;
  sb: DiceExpr;
  sbText: string;
  ffBase: number;
  armourWeight: number;
  armourWeightAdjusted: number;
  load: number;
  loadPenalty: number;
}

export interface Combatant {
  id: string;
  sheet: CharacterSheet;
  team: number;
  controller: 'human' | 'ai';
  pos: Pos;
  derived: Derived;
  kp: Record<Location, Pool>;
  kpTotal: Pool;
  sp: Record<Location, Pool>;
  spTotal: Pool;
  items: Record<string, ItemState>;
  hands: { main: string | null; off: string | null };
  loadoutIndex: number;
  ammo: Record<string, number>;
  /** Armour piece ids worn per location (pieces can be lost through fumbles). */
  armour: Record<Location, string[]>;
  /** Current PSY points (spent on spells, power strikes, …). */
  psy: number;
  /** PSY attribute – the normal maximum. */
  psyMax: number;
  /** PSY stored in a wizard's staff (null without one). */
  staffPsy: Pool | null;
  /** Spell in progress. */
  casting: CastingState | null;
  activeSpells: ActiveSpell[];
  burns: Burn[];
  /** Why the combatant can no longer cast (misfire: mute, …). */
  magicLost: string | null;
  /** Spells forgotten through a misfire (brain damage). */
  forgottenSpells: string[];
  status: 'active' | 'out';
  outKind?: OutKind;
  outReason?: string;
  conditions: Condition[];
  bleeds: Bleed[];
  /** Locations that already received a double-damage critical. */
  criticalLocations: Location[];
  /** Limbs for which the hard PSY roll to keep fighting has been made. */
  limbChecks: Location[];

  // --- per round ---
  initiative: number;
  slots: Slot[];
  turnDone: Record<number, boolean>;
  movedThisRound: number;
  attackedThisRound: boolean;
  shotThisRound: boolean;
  running: boolean;
  stance: 'normal' | 'defensive';
  /** Side this combatant fights with this round (relevant for ambidextrous fighters). */
  fightingSide: 'right' | 'left';
  /** Exposed location per attacking opponent, rolled once per round. */
  blotta: Record<string, Location>;
  opponentFumbled: boolean;
  techniquesUsed: string[];
  /** Lunge: can't strike back in this opportunity. */
  noCounterOpp: number | null;
  // --- persistent tactical state ---
  aimBonus: number;
  reloadLeft: number;
  /** Lose N upcoming actions (carried into the next round if needed). */
  pendingLostActions: number;
  /** Hero state (null for ordinary characters). */
  hero: HeroState | null;
  /** Can no longer make a suicide attack (e.g. fled). */
  noLastStand?: boolean;
}

export interface LogEntry {
  id: number;
  round: number;
  opp: number;
  depth: 0 | 1 | 2;
  tone: 'heading' | 'info' | 'roll' | 'hit' | 'miss' | 'critical' | 'fumble' | 'status' | 'ai';
  text: string;
  actorId?: string;
}

export interface CombatState {
  round: number;
  opp: number;
  width: number;
  height: number;
  combatants: Combatant[];
  log: LogEntry[];
  nextLogId: number;
  over: boolean;
  winner: number | null;
  seed: number;
  /** Pairs (sorted ids joined by '|') that have attacked each other – for the Lightning attack. */
  engaged: string[];
  /** Somebody has taken KP damage (wakes the Wild beast). */
  bloodDrawn: boolean;
  /** Every die rolled, for the dice tray. */
  rolls: DieRoll[];
}

export interface DieRoll {
  id: number;
  sides: number;
  value: number;
  /** The log entry that describes this roll: the next entry written after it. */
  logId: number;
  round: number;
}
