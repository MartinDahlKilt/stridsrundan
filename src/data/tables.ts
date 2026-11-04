import type { Location } from '../engine/types';

/** Lookup tables from the basic rules and Krigarens Handbok. */

/** Body point table (§2.2): KP or SP per location from the total. */
export function bodyPoints(total: number): Record<Location, number> {
  let idx: number;
  if (total <= 7) idx = 0;
  else if (total <= 11) idx = 1;
  else if (total <= 15) idx = 2;
  else if (total <= 20) idx = 3;
  else if (total <= 25) idx = 4;
  else if (total <= 30) idx = 5;
  else if (total <= 35) idx = 6;
  else if (total <= 40) idx = 7;
  else idx = 7 + Math.ceil((total - 40) / 5);
  return {
    chest: 4 + idx,
    rightLeg: 3 + idx,
    leftLeg: 3 + idx,
    abdomen: 3 + idx,
    rightArm: 2 + idx,
    leftArm: 2 + idx,
    head: 3 + idx,
  };
}

/** Damage bonus (§2.4) from STY + STO. */
export function damageBonus(stySto: number): string {
  if (stySto <= 26) return '0';
  if (stySto <= 29) return '+1';
  if (stySto <= 32) return '1T2';
  if (stySto <= 40) return '1T4';
  if (stySto <= 50) return '1T6';
  if (stySto <= 60) return '1T10';
  if (stySto <= 80) return '2T6';
  if (stySto <= 100) return '3T6';
  if (stySto <= 140) return '4T6';
  return '5T6';
}

/** Movement (§2.5) in squares per SR from STO + FYS + SMI. */
export function movement(sum: number): number {
  const steps = [11, 20, 29, 38, 47, 56, 65, 74, 83, 92];
  for (let i = 0; i < steps.length; i++) if (sum <= steps[i]) return 7 + i;
  return 16 + Math.ceil((sum - 92) / 8);
}

export const RACE_MOVEMENT: Record<string, number> = { elf: 1, dwarf: -2, halfling: -2, duck: -2 };

/** Armour weight modifier (§17.3) from STO + STY + FYS, as a factor. */
export function armourWeightFactor(sum: number): number {
  const rows: [number, number][] = [
    [8, -0.7],
    [11, -0.6],
    [14, -0.5],
    [17, -0.4],
    [20, -0.3],
    [26, -0.2],
    [33, -0.1],
    [39, 0],
    [45, 0.1],
    [51, 0.2],
    [57, 0.3],
    [63, 0.4],
    [69, 0.5],
  ];
  for (const [max, mod] of rows) if (sum <= max) return 1 + mod;
  return 1 + 0.5 + 0.1 * Math.ceil((sum - 69) / 6);
}

/** Carrying capacity (§15.4): modifier to FF, SMI and SMI-based skills. */
export function loadPenalty(load: number, sty: number): number {
  const r = load / Math.max(1, sty);
  if (r <= 1) return 0;
  if (r <= 2) return -1;
  if (r <= 3) return -2;
  if (r <= 4) return -4;
  if (r <= 5) return -6;
  return -8;
}

/** Närstridstabell (§6.1), against a right-handed opponent. */
export const BLOTTA_TABLE: [number, Location][] = [
  [2, 'leftLeg'],
  [4, 'rightLeg'],
  [6, 'abdomen'],
  [10, 'leftArm'],
  [14, 'rightArm'],
  [18, 'chest'],
  [20, 'head'],
];

export const AIM_PENALTY: Record<Location, number> = {
  leftLeg: -1,
  rightLeg: -3,
  abdomen: -4,
  leftArm: -1,
  rightArm: -2,
  chest: -3,
  head: -4,
};

export const RANDOM_MELEE: [number, Location][] = [
  [2, 'leftLeg'],
  [4, 'rightLeg'],
  [8, 'abdomen'],
  [11, 'leftArm'],
  [14, 'rightArm'],
  [16, 'chest'],
  [20, 'head'],
];

export const RANDOM_RANGED: [number, Location][] = [
  [3, 'leftLeg'],
  [6, 'rightLeg'],
  [9, 'abdomen'],
  [11, 'leftArm'],
  [13, 'rightArm'],
  [18, 'chest'],
  [20, 'head'],
];

export function lookup(table: [number, Location][], roll: number): Location {
  for (const [max, loc] of table) if (roll <= max) return loc;
  return table[table.length - 1][1];
}

/** Ranged range modifier (§15.2): < ½ ±0, ½–¾ −5, ¾–full −10, beyond = impossible (null). */
export function rangeModifier(distanceM: number, maxRangeM: number): number | null {
  if (distanceM > maxRangeM) return null;
  if (distanceM < maxRangeM / 2) return 0;
  if (distanceM <= (maxRangeM * 3) / 4) return -5;
  return -10;
}

/** Glancing-hit thresholds on 1T6 (§8.5). */
export const GLANCE_ON: Record<'metal' | 'lamellar' | 'chain', number> = { metal: 4, lamellar: 3, chain: 2 };
