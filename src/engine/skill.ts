import type { Dice } from './dice';

/** combat-rules §3: skill rolls, perfect rolls, fumbles and the resistance table. */

export type Outcome = 'perfect' | 'success' | 'failure' | 'fumble';

export interface SkillRoll {
  fv: number;
  cl: number;
  /** All 1T20 rolls made, including confirmation rolls. */
  rolls: number[];
  /** The first (deciding) roll. */
  roll: number;
  outcome: Outcome;
}

/**
 * Roll 1T20 against CL. Perfect/fumble confirmation rolls are made against FV, not CL (§3.2).
 * With FV above 20 the hero rules apply (Hjältarnas Handbok 561–577, §21.1).
 */
export function rollSkill(dice: Dice, fv: number, cl: number, heroicFumble: 'hh' | 'base' = 'hh'): SkillRoll {
  const rolls: number[] = [];
  const d20 = () => {
    const r = dice.d(20);
    rolls.push(r);
    return r;
  };
  const r = d20();
  const done = (outcome: Outcome): SkillRoll => ({ fv, cl, rolls, roll: r, outcome });

  if (fv > 20 && cl >= 1) {
    // FV 21–40: a 1 is always perfect, a 2 is perfect if the 2nd roll ≤ FV−20; FV 41–60: 1–2 always, 3 if ≤ FV−40 …
    const band = Math.floor((fv - 1) / 20);
    if (r <= band) return done('perfect');
    if (r === band + 1 && r < 20) {
      if (d20() <= fv - 20 * band) return done('perfect');
      return done(r <= cl ? 'success' : 'failure');
    }
    if (r === 20) {
      const second = d20();
      // 'hh': fumble if the 2nd roll is above FV/2, and 16–20 always fumbles (reading of HH 572–577).
      // 'base': only two 20s in a row (basic rule for CL ≥ 20).
      const fumble = heroicFumble === 'hh' ? second >= 16 || second > fv / 2 : second === 20;
      return done(fumble ? 'fumble' : 'failure');
    }
    return done(r <= cl ? 'success' : 'failure');
  }
  if (cl < 1) {
    // No perfect possible; 20 is a fumble; success needs two 1s in a row (OCR-6).
    if (r === 20) return done('fumble');
    if (r === 1 && fv >= 1) return done(d20() === 1 ? 'success' : 'failure');
    return done('failure');
  }
  if (cl >= 20) {
    if (r === 1) return done('perfect');
    if (r === 2) return done(d20() <= fv ? 'perfect' : 'success');
    if (r === 20) return done(d20() === 20 ? 'fumble' : 'failure');
    return done('success');
  }
  if (r === 1) return done(d20() <= fv ? 'perfect' : 'success');
  if (r === 20) return done(d20() > fv ? 'fumble' : 'failure');
  return done(r <= cl ? 'success' : 'failure');
}

export const isSuccess = (o: Outcome) => o === 'success' || o === 'perfect';

/**
 * Hero point "Höja CL" (HH 2972–2981): fumble → failure, failure → success, success → perfect;
 * a perfect roll stays perfect and the hero point is refunded.
 */
/** Baschans (BC) from an attribute value (I 1590–1601): what a character has in a primary skill without training. */
export function baseChance(value: number): number {
  return value <= 3 ? 0 : value <= 8 ? 1 : value <= 12 ? 2 : value <= 16 ? 3 : value <= 20 ? 4 : 5;
}

export function raiseOutcome(o: Outcome): { outcome: Outcome; refund: boolean } {
  switch (o) {
    case 'fumble':
      return { outcome: 'failure', refund: false };
    case 'failure':
      return { outcome: 'success', refund: false };
    case 'success':
      return { outcome: 'perfect', refund: false };
    case 'perfect':
      return { outcome: 'perfect', refund: true };
  }
}

/** Resistance table (Motståndstabellen): target = value − SG + 10 (§3.4). */
export function resistanceTarget(value: number, sg: number): number {
  return value - sg + 10;
}

export interface ResistanceRoll {
  value: number;
  sg: number;
  target: number;
  roll: number | null;
  success: boolean;
}

export function rollResistance(dice: Dice, value: number, sg: number): ResistanceRoll {
  const target = resistanceTarget(value, sg);
  if (target >= 20) return { value, sg, target, roll: null, success: true };
  if (target <= 0) return { value, sg, target, roll: null, success: false };
  const roll = dice.d(20);
  return { value, sg, target, roll, success: roll <= target };
}

export const SG = { veryEasy: 1, easy: 5, normal: 10, hard: 15, veryHard: 20, extreme: 25 } as const;

export function outcomeLabel(o: Outcome): string {
  switch (o) {
    case 'perfect':
      return 'PERFECT';
    case 'success':
      return 'success';
    case 'failure':
      return 'failure';
    case 'fumble':
      return 'FUMBLE';
  }
}
