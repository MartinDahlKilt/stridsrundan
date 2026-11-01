import type { MagicSchool } from '../engine/types';

/**
 * Combat spells – combat-rules §22. Elementarmagi from the basic rules (III 1315–2290) and Magikerns Handbok
 * (MH 5597–5920), with the KH conversion from MH 1885–1915: every spell does as many dice of SP as of KP.
 * Spells for travel, crafting, weather, summoning and battlefield-sized areas are left out (§22.8).
 */

export type SpellKind =
  | 'damage'
  | 'shield' // SKÖLD: a magic parry
  | 'flamingHand' // FLAMMANDE HAND: +1T3/E on blows
  | 'coldHand' // KALLA HANDEN: hard FYS roll or lose the round
  | 'weapon' // FÖRTROLLA / FÖRBANNA VAPEN: ±E CL and damage on a weapon
  | 'shatter' // KNÄCKA: lower an item's BV
  | 'whirlwind' // VIRVELSKÖLD: deflect projectiles
  | 'explosion' // EXPLOSION: 5/E around a point, blinds onlookers
  | 'breathless'; // KVÄVA, DRÄNKA: the target can't breathe or act

/** Who or what the spell is aimed at when it is released. */
export type SpellTargeting = 'self' | 'enemy' | 'enemyItem' | 'ownItem';

/**
 * Range codes from the spell descriptions (III 380–400):
 * personal/touch, short = S/2 squares, sx2 = S×2 squares, long = S×10 squares, sx10m = S×10 metres.
 */
export type SpellRange = 'personal' | 'touch' | 'short' | 'sx2' | 'long' | 'sx10m';

/** Duration codes: S×1 SR, S×1 minutes, 1T3 minutes (1 minute = 12 SR of 5 s, II 1145). */
export type SpellDuration = 'sxSR' | 'sxMin' | '1T3min';

export interface DamageSpec {
  /** Die per effect grade (1T6/E → 6). Ignored when `flatPerE` is set. */
  sides: number;
  /** Flat damage per E instead of dice (EXPLOSION: 5/E). */
  flatPerE?: number;
  /**
   * total = total KP/SP only (the detailed-system note on ELD, FROST, BLIXT, EXPLOSION, FÖRFRYSA);
   * random = random location (ranged table); aimed = the caster chooses the location ("kan rikta").
   */
  mode: 'total' | 'random' | 'aimed';
  /** Armour absorbs (for total damage: the torso armour, 🔧 SIM-21). */
  armour: boolean;
  /** Everyone within E metres of the point of impact is hit. */
  area?: boolean;
  /** Afterburn: `dice` every round for `rounds` rounds, no armour. */
  burn?: { dice: string; rounds: string };
}

export interface SpellDef {
  id: string;
  /** English name used in the UI. */
  name: string;
  /** Swedish name, written in capitals as in the books. */
  sv: string;
  school: MagicSchool;
  /** Skolvärde: the school FV needed to learn the spell. */
  schoolValue: number;
  /** (K) kvick: 2 actions instead of 4. */
  quick: boolean;
  /** (F) fysisk: no PSY-vs-PSY resistance. */
  physical: boolean;
  kind: SpellKind;
  targeting: SpellTargeting;
  range: SpellRange;
  duration?: SpellDuration;
  damage?: DamageSpec;
  /** Harmful to its target – a misfire result of 12–15 turns it on the caster (III 562). */
  harmful: boolean;
  /** Short English rules summary. */
  description: string;
  /** Rules reference. */
  ref: string;
}

const S = (d: SpellDef) => d;

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(
  [
    // --- Basic rules (III) ------------------------------------------------------------------
    S({
      id: 'shield', name: 'Shield', sv: 'SKÖLD', school: 'elemental', schoolValue: 3, quick: true, physical: true,
      kind: 'shield', targeting: 'self', range: 'personal', harmful: false,
      description: 'Hardens the air into a shield that parries one physical attack automatically: BV 4, +2 per E above the first. Released as a parry.',
      ref: 'III 1370',
    }),
    S({
      id: 'flamingHand', name: 'Flaming hand', sv: 'FLAMMANDE HAND', school: 'elemental', schoolValue: 4, quick: false, physical: true,
      kind: 'flamingHand', targeting: 'self', range: 'touch', duration: '1T3min', harmful: false,
      description: 'Your hand bursts into flame: +1T3 KP and SP per E on your melee blows for 1T3 minutes.',
      ref: 'III 1381',
    }),
    S({
      id: 'coldHand', name: 'Cold hand', sv: 'KALLA HANDEN', school: 'elemental', schoolValue: 4, quick: true, physical: true,
      kind: 'coldHand', targeting: 'enemy', range: 'short', harmful: true,
      description: 'A ray of cold (range S/2 squares): the target makes a hard FYS roll or can do nothing more this round; even on a success −4 CL this round.',
      ref: 'III 1391',
    }),
    S({
      id: 'lightning', name: 'Lightning', sv: 'BLIXT', school: 'elemental', schoolValue: 6, quick: true, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 6, mode: 'total', armour: false },
      description: '1T6 per E to total KP (and SP). Armour gives no protection.',
      ref: 'III 1404',
    }),
    S({
      id: 'fire', name: 'Fire', sv: 'ELD', school: 'elemental', schoolValue: 6, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 6, mode: 'total', armour: true },
      description: 'A one-metre sphere of sudden heat: 1T6 per E to total KP (and SP). Armour absorbs.',
      ref: 'III 1415',
    }),
    S({
      id: 'energyBolt', name: 'Energy bolt', sv: 'ENERGISTRÅLE', school: 'elemental', schoolValue: 6, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 3, mode: 'random', armour: true },
      description: 'A beam of magic light: 1T3 per E in the detailed system, to a random location. Armour absorbs.',
      ref: 'III 1442',
    }),
    S({
      id: 'frost', name: 'Frost', sv: 'FROST', school: 'elemental', schoolValue: 6, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 6, mode: 'total', armour: true },
      description: 'A one-metre sphere of sudden cold: 1T6 per E to total KP (and SP). Armour absorbs.',
      ref: 'III 1455',
    }),
    S({
      id: 'curseWeapon', name: 'Curse weapon', sv: 'FÖRBANNA VAPEN', school: 'elemental', schoolValue: 6, quick: false, physical: false,
      kind: 'weapon', targeting: 'enemyItem', range: 'long', duration: 'sxMin', harmful: true,
      description: 'A weapon or shield gets −1 CL and −1 damage per E for S minutes. Targets the item, so there is no PSY resistance.',
      ref: 'III 1476',
    }),
    S({
      id: 'enchantWeapon', name: 'Enchant weapon', sv: 'FÖRTROLLA VAPEN', school: 'elemental', schoolValue: 6, quick: false, physical: false,
      kind: 'weapon', targeting: 'ownItem', range: 'long', duration: 'sxMin', harmful: false,
      description: 'Your weapon or shield gets +1 CL and +1 damage per E for S minutes; cancels a curse grade for grade.',
      ref: 'III 1487',
    }),
    S({
      id: 'shatter', name: 'Shatter', sv: 'KNÄCKA', school: 'elemental', schoolValue: 6, quick: true, physical: true,
      kind: 'shatter', targeting: 'enemyItem', range: 'sx2', harmful: true,
      description: "Lowers a weapon's or shield's BV by 10, +2 per E above the first (S×2 squares). Bows and crossbows count as BV 10.",
      ref: 'III 1502',
    }),
    S({
      id: 'whirlwind', name: 'Whirlwind shield', sv: 'VIRVELSKÖLD', school: 'elemental', schoolValue: 8, quick: false, physical: true,
      kind: 'whirlwind', targeting: 'self', range: 'personal', duration: 'sxSR', harmful: false,
      description: 'A whirlwind around you for S rounds: each arrow, bolt, stone or thrown weapon must be beaten by E on the resistance table or it misses.',
      ref: 'III 1546',
    }),
    S({
      id: 'explosion', name: 'Explosion', sv: 'EXPLOSION', school: 'elemental', schoolValue: 11, quick: true, physical: true,
      kind: 'explosion', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 0, flatPerE: 5, mode: 'total', armour: false, area: true },
      description: '5 KP (and SP) per E to everyone within E metres, 1 less per square beyond – the caster too. Everyone else who sees it is blinded next round (−15 CL).',
      ref: 'III 2275',
    }),

    // --- Magikerns Handbok ------------------------------------------------------------------
    S({
      id: 'gust', name: 'Gust', sv: 'VINDSTÖT', school: 'elemental', schoolValue: 8, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'long', harmful: true,
      damage: { sides: 6, mode: 'aimed', armour: true },
      description: 'A fist-sized blast of wind at the point you aim at: 1T6 per E. Armour absorbs.',
      ref: 'MH 5686',
    }),
    S({
      id: 'iceBall', name: 'Ice ball', sv: 'ISKLOT', school: 'elemental', schoolValue: 10, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 8, mode: 'aimed', armour: true },
      description: 'A block of ice hurled at the target – usually from above, at the head: 1T8 per E. Armour absorbs.',
      ref: 'MH 5872',
    }),
    S({
      id: 'fireball', name: 'Fireball', sv: 'ELDKLOT', school: 'elemental', schoolValue: 12, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 8, mode: 'random', armour: true, burn: { dice: '1T6', rounds: '1T3' } },
      description: 'A burning ball the size of a child’s head: 1T8 per E to a random location, then 1T6 burns per round for 1T3 rounds. Armour absorbs the impact.',
      ref: 'MH 5744',
    }),
    S({
      id: 'boulder', name: 'Crushing boulder', sv: 'KROSSANDE KLIPPBLOCK', school: 'elemental', schoolValue: 12, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 10, mode: 'aimed', armour: true },
      description: 'A great stone hurled at the target – usually from above, at the head: 1T10 per E. Armour absorbs.',
      ref: 'MH 5615',
    }),
    S({
      id: 'iceMissiles', name: 'Ice missiles', sv: 'ISMISSILER', school: 'elemental', schoolValue: 14, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 8, mode: 'random', armour: true, area: true },
      description: 'A swarm of icicles: 1T8 per E to everyone within E metres of the target, random locations. Armour absorbs.',
      ref: 'MH 5879',
    }),
    S({
      id: 'suffocate', name: 'Suffocate', sv: 'KVÄVA', school: 'elemental', schoolValue: 14, quick: false, physical: false,
      kind: 'breathless', targeting: 'enemy', range: 'long', harmful: true,
      description: 'Drives the air out of the target’s lungs. Must beat the target’s PSY; the victim can do nothing but slowly suffocate.',
      ref: 'MH 5714',
    }),
    S({
      id: 'drown', name: 'Drown', sv: 'DRÄNKA', school: 'elemental', schoolValue: 14, quick: false, physical: false,
      kind: 'breathless', targeting: 'enemy', range: 'long', harmful: true,
      description: 'Fills the target’s lungs with water. Must beat the target’s PSY; the victim can do nothing but drown.',
      ref: 'MH 5820',
    }),
    S({
      id: 'freeze', name: 'Freeze', sv: 'FÖRFRYSA', school: 'elemental', schoolValue: 15, quick: false, physical: false,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 8, mode: 'total', armour: false },
      description: 'Chills a living body below freezing: 1T8 per E to total KP (and SP). No armour protects, but it must beat the target’s PSY.',
      ref: 'MH 5886',
    }),
    S({
      id: 'innerFire', name: 'Inner fire', sv: 'INRE ELD', school: 'elemental', schoolValue: 16, quick: false, physical: false,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 6, mode: 'total', armour: false, burn: { dice: '1T6', rounds: '1T10' } },
      description: 'Magic fire inside the body: 1T6 per E, then 1T6 every round for 1T10 rounds. No armour; must beat the target’s PSY.',
      ref: 'MH 5758',
    }),
    S({
      id: 'rockSwarm', name: 'Rock swarm', sv: 'KLIPPSVÄRM', school: 'elemental', schoolValue: 16, quick: false, physical: true,
      kind: 'damage', targeting: 'enemy', range: 'sx10m', harmful: true,
      damage: { sides: 10, mode: 'aimed', armour: true, area: true },
      description: 'Flying rocks rain down within E metres of the point of impact – usually at the head: 1T10 per E to everyone there. Armour absorbs.',
      ref: 'MH 5622',
    }),
  ].map((d) => [d.id, d]),
);

export function spellDef(id: string): SpellDef {
  const d = SPELLS[id];
  if (!d) throw new Error(`Unknown spell "${id}"`);
  return d;
}

export const SCHOOL_NAMES: Record<MagicSchool, string> = { elemental: 'Elemental magic (Elementarmagi)', animism: 'Animism', mentalism: 'Mentalism' };

/**
 * Resistance values of projectiles against VIRVELSKÖLD (III 1568). Thrown swords and other weapons not in the
 * table count as a throwing axe (5).
 */
export const PROJECTILE_RESISTANCE: Record<string, number> = { arrow: 4, bolt: 6, stone: 7, throwingKnife: 4, javelin: 5, throwingAxe: 5 };
