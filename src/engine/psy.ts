import { spellDef } from '../data/spells';
import { log, type Ctx } from './state';
import type { Combatant } from './types';

/** PSY available for spells: the caster's own points plus a staff's PSY-källa (MH 2390). */
export function availablePsy(c: Combatant): number {
  return Math.max(0, c.psy) + (c.staffPsy?.cur ?? 0);
}

/**
 * Spend PSY on a spell: the staff's store first, then the caster's own (🔧 SIM-22). Own PSY may go below zero
 * only through a suicide spell. Returns a text such as "3 PSY (staff 2, own 1)".
 */
export function spendPsy(c: Combatant, n: number): string {
  let left = n;
  let fromStaff = 0;
  if (c.staffPsy && c.staffPsy.cur > 0) {
    fromStaff = Math.min(c.staffPsy.cur, left);
    c.staffPsy.cur -= fromStaff;
    left -= fromStaff;
  }
  c.psy -= left;
  return fromStaff ? `${n} PSY (staff ${fromStaff}, own ${left})` : `${n} PSY`;
}

/**
 * Being hurt while casting breaks the concentration: it counts as a failed spell – 1 PSY is lost and the spell
 * has no effect (III 212–216). Also used when the caster gives up a spell to do something else (🔧 SIM-19).
 */
export function breakConcentration(ctx: Ctx, c: Combatant, why: string): void {
  if (!c.casting) return;
  const sv = spellDef(c.casting.spell).sv;
  c.casting = null;
  const paid = spendPsy(c, 1);
  log(ctx, `${c.sheet.name}'s concentration is broken (${why}) – the ${sv} is lost; ${paid} spent (${availablePsy(c)} PSY left).`, 'status', 2, c.id);
}
