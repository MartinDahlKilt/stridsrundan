import type { Grid } from './grid';
import type { CharacterSheet } from './types';

/**
 * Rules options – every interpretation from combat-rules §20 that is worth switching lives here.
 * Defaults are the decisions accepted on 2026-10-24.
 */
export interface RulesConfig {
  /** SIM-5: 'never' = perfect attacks get no parry roll (default); 'perfectParry' = only a perfect parry stops one. */
  perfectAttackParry: 'never' | 'perfectParry';
  /** GAP-9: add SB to SP damage as well as KP. */
  sbOnSp: boolean;
  /** GAP-12: the longer weapon strikes first when fighters first come into reach. */
  longerWeaponStrikesFirst: boolean;
  /** Offer "roll with the blow" when SP damage after armour is at least this much. */
  rollWithBlowThreshold: number;
  /** Wind in m/s from the side (GAP-10). 0 = no wind. */
  windMs: number;
  /**
   * Use the optional chapter "Österländska krigare" (KH 6645–7668): eastern martial-art techniques,
   * eastern weapons, armour and professions. Off by default.
   */
  easternWarriors: boolean;
  /**
   * HH 572–577, fumbles at FV > 20: 'hh' = after a 20, a 2nd roll above FV/2 (and always 16–20) fumbles;
   * 'base' = only two 20s in a row, as for CL ≥ 20 in the basic rules.
   */
  heroicFumble: 'hh' | 'base';
  /** Chance (%) that the gods restore a hero with Gudarnas gunstling when total KP reaches 0 (HH: 25–50%). */
  favouredByGodsChance: number;
  /**
   * Facing (II 1732–1756): melee attacks from the side +3 CL, from behind +7; an unnoticed attacker from behind
   * (Smyga vs Upptäcka fara) can't be parried, and Anfall bakifrån / the assassin's backstab apply.
   */
  flanking: boolean;
  /**
   * House rules (optional):
   * - no blotta: a standard melee attack has the same CL against every location and the hit location is rolled
   *   on the melee location table; aiming at a chosen location costs −5 CL;
   * - a perfect hit can be stopped by a normal successful parry;
   * - special hit: a successful attack roll of 5 or less followed by a 2nd roll ≤ FV deals maximum damage,
   *   but armour still absorbs.
   */
  houseRules: boolean;
  /**
   * Battlefield layout. 'square' is the rules as written (1.5 m squares, a diagonal step counts as one, so moving
   * diagonally covers more ground); 'hex' (house option, default) uses 1.5 m hexes so every step is the same length.
   */
  grid: Grid;
  /**
   * House rule: terrain gives cover by itself – a low obstacle right in front of the target covers its legs and
   * costs −3 CL, bushes −3 CL. (The books only have taking cover as an action, which always applies.)
   */
  terrainCover: boolean;
  /** Safety stop. */
  maxRounds: number;
}

export const DEFAULT_RULES: RulesConfig = {
  perfectAttackParry: 'never',
  sbOnSp: true,
  longerWeaponStrikesFirst: true,
  rollWithBlowThreshold: 4,
  windMs: 0,
  easternWarriors: false,
  heroicFumble: 'hh',
  favouredByGodsChance: 25,
  flanking: true,
  houseRules: false,
  grid: 'hex',
  terrainCover: true,
  maxRounds: 60,
};

/**
 * Martial-art techniques that exist only in the eastern schools (KH 7516–7588).
 * Techniques the eastern list shares with the basic rules or the weapon academies
 * (Dödande anfall, Förutse blotta, Undanmanöver, Virvelvindsanfall, Psykisk duell, Anfall bakifrån)
 * stay available as weapon techniques.
 */
export const EASTERN_TECHNIQUES = ['projectileParry', 'predictAttack', 'kiai', 'rollingAttack', 'armouredFighting', 'fallingKick'];

/** The sheet as used in a fight under these rules (eastern techniques removed when the option is off). */
export function applyRuleOptions(sheet: CharacterSheet, rules: RulesConfig): CharacterSheet {
  if (rules.easternWarriors || !sheet.martialArtTechniques) return sheet;
  return { ...sheet, martialArtTechniques: sheet.martialArtTechniques.filter((t) => !EASTERN_TECHNIQUES.includes(t)) };
}
