import type { HeroAbility } from '../engine/types';

/** UI labels shared by the setup screen and the combat panels. */

export const HERO_STATUS: Record<number, string> = { 1: 'Novice (1)', 2: 'Experienced (2)', 3: 'Veteran (3)', 4: 'Celebrated (4)', 5: 'Legendary (5)' };

export const HERO_ABILITY_NAMES: Record<HeroAbility, string> = {
  ironFist: 'Iron fist',
  quickDraw: 'Quick draw',
  powerStrike: 'Power strike',
  quickStriker: 'Quick striker',
  projectileParry: 'Projectile parry',
  steeled: 'Steeling',
  weaponMaster: 'Weapon master',
  wildBeast: 'Wild beast',
  favouredByGods: 'Favoured by the gods',
  fearless: 'Fearless',
  heroicReflexes: 'Heroic reflexes',
};
