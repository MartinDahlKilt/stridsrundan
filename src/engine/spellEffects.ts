import type { ActiveSpell, Combatant } from './types';

/** Ongoing spell effects (§22.6). No engine imports, so the CL and damage code can use it freely. */

export function activeSpell(c: Combatant, kind: ActiveSpell['kind'], round: number): ActiveSpell | undefined {
  return c.activeSpells.find((x) => x.kind === kind && x.throughRound >= round);
}

/** FÖRTROLLA VAPEN (+E) and FÖRBANNA VAPEN (−E) on one item: CL and damage modifier (III 1476–1500). */
export function weaponSpellMod(c: Combatant, itemKey: string | undefined, round: number): number {
  if (!itemKey) return 0;
  return c.activeSpells.filter((x) => x.kind === 'weapon' && x.itemKey === itemKey && x.throughRound >= round).reduce((s, x) => s + x.value, 0);
}

export function pruneSpells(c: Combatant, round: number): void {
  c.activeSpells = c.activeSpells.filter((x) => x.throughRound >= round);
}
