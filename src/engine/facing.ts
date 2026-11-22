import { armourDef } from '../data/armour';
import { raceDef } from '../data/races';
import { centre, facingVector, type Grid } from './grid';
import { baseChance } from './skill';
import type { Combatant, Pos } from './types';

/**
 * Facing and attacks from the side or from behind (II 1732–1756, combat-rules §7.5).
 *
 * 🔧 SIM-27: a fighter faces the one it last attacked or shot at; after moving it turns to the nearest enemy
 * within a few squares (else the way it moved). Parrying doesn't turn anyone. Seen from the defender, the
 * attacker is in front within 67.5° of the facing (the three squares ahead), behind beyond 112.5°
 * (the three squares at the back), and at the side in between.
 *
 * On the hex grid a fighter faces one of the six sides. Front is still within 67.5° (the three hexes ahead), the
 * side reaches out to 135° (the two hexes behind the shoulders) and only the hex straight behind is the rear.
 */

export type AttackDirection = 'front' | 'side' | 'rear';

/** Turn `c` to face `p` – or, given `from`, the way from `from` to `p`. */
export function faceTowards(c: Combatant, p: Pos, grid: Grid, from: Pos = c.pos): void {
  const d = facingVector(from, p, grid);
  if (d) c.facing = d;
}

export function attackDirection(defender: Combatant, from: Pos, grid: Grid): AttackDirection {
  const a = centre(defender.pos, grid);
  const b = centre(from, grid);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const f = defender.facing;
  if ((!vx && !vy) || (!f.x && !f.y)) return 'front';
  const cos = (vx * f.x + vy * f.y) / (Math.hypot(vx, vy) * Math.hypot(f.x, f.y));
  const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const rearFrom = grid === 'hex' ? 135 : 112.5;
  return angle <= 67.5 ? 'front' : angle < rearFrom ? 'side' : 'rear';
}

/** CL bonus for a melee attack from the side (+3) or from behind (+7), II 1362–1363. */
export const DIRECTION_BONUS: Record<AttackDirection, number> = { front: 0, side: 3, rear: 7 };

/** Smyga (SMI, primary): the sheet's FV or the base chance, halved in metal armour (III 2971–2974). */
export function sneakFV(c: Combatant): { fv: number; note: string } {
  let fv = (c.sheet.skills.sneak ?? baseChance(c.sheet.attributes.SMI)) + (raceDef(c.sheet.race).skillBonus?.sneak ?? 0);
  const metal = Object.values(c.armour)
    .flat()
    .some((id) => armourDef(id).glance !== null);
  if (metal) fv = Math.floor(fv / 2);
  return { fv, note: metal ? ' (halved in metal armour)' : '' };
}

/** Wears a great helm (Tunnhjälm): −5 to Finna dolda ting and Upptäcka fara (III 2894, 2935). */
export function blinkered(c: Combatant): boolean {
  return Object.values(c.armour)
    .flat()
    .some((id) => id === 'greatHelm');
}

/** Upptäcka fara (PSY, primary): the sheet's FV or the base chance; a bounty hunter always has CL 17 or more (KH 261). */
export function spotDangerCL(c: Combatant): { fv: number; floor: number; note: string } {
  const fv = (c.sheet.skills.spotDanger ?? baseChance(c.sheet.attributes.PSY)) + (raceDef(c.sheet.race).skillBonus?.spotDanger ?? 0);
  const helm = blinkered(c);
  return { fv: helm ? fv - 5 : fv, floor: c.sheet.profession === 'bountyHunter' ? 17 : 0, note: helm ? ' (−5 great helm)' : '' };
}

/** Gömma sig (INT, primary, I 2254): the sheet's FV or the base chance (+4 for halflings). */
export function hideFV(c: Combatant): number {
  return (c.sheet.skills.hide ?? baseChance(c.sheet.attributes.INT)) + (raceDef(c.sheet.race).skillBonus?.hide ?? 0);
}

/**
 * Smyga above 20 (HH 626): moves silently at half walking speed as always, and can sneak up to its full normal
 * movement in a round – with −5 on the Smyga roll when it does. Based on the skill itself, before metal armour.
 */
export function silentMover(c: Combatant): boolean {
  return (c.sheet.skills.sneak ?? 0) > 20;
}

/**
 * Finna dolda ting above 20 is "always on" (HH 594): the game master keeps rolling it for the character, so it
 * searches every round without spending an action. Based on the skill itself, before the great helm.
 */
export function alwaysSearching(c: Combatant): boolean {
  return (c.sheet.skills.findHidden ?? 0) > 20;
}

/** Finna dolda ting (INT, primary, I 2229): the sheet's FV or the base chance, −5 in a great helm. */
export function findHiddenFV(c: Combatant): { fv: number; note: string } {
  const fv = c.sheet.skills.findHidden ?? baseChance(c.sheet.attributes.INT);
  const helm = blinkered(c);
  return { fv: helm ? fv - 5 : fv, note: helm ? ' (−5 great helm)' : '' };
}

/**
 * Weapons small enough for Anfall bakifrån: daggers and dagger-like blades no bigger than a short sword (KH 1135).
 */
export function backstabWeapon(defId: string, group: string): boolean {
  return group === 'dagger' || defId === 'shortSword' || defId === 'wakizashi' || defId === 'tanto' || defId === 'aiguchi';
}
