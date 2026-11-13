import { armourDef } from '../data/armour';
import { raceDef } from '../data/races';
import { baseChance } from './skill';
import type { Combatant, Pos } from './types';

/**
 * Facing and attacks from the side or from behind (II 1732–1756, combat-rules §7.5).
 *
 * 🔧 SIM-27: a fighter faces the one it last attacked or shot at; after moving it turns to the nearest enemy
 * within a few squares (else the way it moved). Parrying doesn't turn anyone. Seen from the defender, the
 * attacker is in front within 67.5° of the facing (the three squares ahead), behind beyond 112.5°
 * (the three squares at the back), and at the side in between.
 */

export type AttackDirection = 'front' | 'side' | 'rear';

/** Unit-ish direction from one square to another (components −1, 0 or 1). */
export function directionTo(from: Pos, to: Pos): Pos {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
}

export function faceTowards(c: Combatant, p: Pos): void {
  const d = directionTo(c.pos, p);
  if (d.x || d.y) c.facing = d;
}

export function attackDirection(defender: Combatant, from: Pos): AttackDirection {
  const vx = from.x - defender.pos.x;
  const vy = from.y - defender.pos.y;
  const f = defender.facing;
  if ((!vx && !vy) || (!f.x && !f.y)) return 'front';
  const cos = (vx * f.x + vy * f.y) / (Math.hypot(vx, vy) * Math.hypot(f.x, f.y));
  const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  return angle <= 67.5 ? 'front' : angle < 112.5 ? 'side' : 'rear';
}

/** CL bonus for a melee attack from the side (+3) or from behind (+7), II 1362–1363. */
export const DIRECTION_BONUS: Record<AttackDirection, number> = { front: 0, side: 3, rear: 7 };

/** Smyga (SMI, primary): the sheet's FV or the base chance, halved in metal armour (III 2971–2974). */
export function sneakFV(c: Combatant): { fv: number; note: string } {
  let fv = c.sheet.skills.sneak ?? baseChance(c.sheet.attributes.SMI) + (raceDef(c.sheet.race).skillBonus?.sneak ?? 0);
  const metal = Object.values(c.armour)
    .flat()
    .some((id) => armourDef(id).glance !== null);
  if (metal) fv = Math.floor(fv / 2);
  return { fv, note: metal ? ' (halved in metal armour)' : '' };
}

/** Upptäcka fara (PSY, primary): the sheet's FV or the base chance; a bounty hunter always has CL 17 or more (KH 261). */
export function spotDangerCL(c: Combatant): { fv: number; floor: number } {
  const fv = c.sheet.skills.spotDanger ?? baseChance(c.sheet.attributes.PSY) + (raceDef(c.sheet.race).skillBonus?.spotDanger ?? 0);
  return { fv, floor: c.sheet.profession === 'bountyHunter' ? 17 : 0 };
}

/**
 * Weapons small enough for Anfall bakifrån: daggers and dagger-like blades no bigger than a short sword (KH 1135).
 */
export function backstabWeapon(defId: string, group: string): boolean {
  return group === 'dagger' || defId === 'shortSword' || defId === 'wakizashi' || defId === 'tanto' || defId === 'aiguchi';
}
