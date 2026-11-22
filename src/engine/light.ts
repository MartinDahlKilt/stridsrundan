import { raceDef } from '../data/races';
import type { Ctx } from './state';
import { LIGHTS } from './terrain';
import type { Combatant } from './types';

/**
 * Poor light (II 1343): dusk, moonlight or torchlight −5 CL on attacks, darkness −15. Dwarves see perfectly in the
 * dark (Mörkersyn, I 628); Nattsyn (KH 494) removes the penalty in dim light; a successful Strid i mörker roll this
 * round (KH) removes it in dim light and leaves −5 in darkness.
 */
export function lightMod(ctx: Ctx, c: Combatant): { label: string; value: number } | null {
  const light = ctx.state.map.light;
  if (light === 'day' || raceDef(c.sheet.race).darkVision) return null;
  const trained = c.darkFightingRound === ctx.state.round;
  if (light === 'dim') {
    if (trained || (c.sheet.abilities ?? []).includes('nightVision')) return null;
    return { label: 'poor light', value: LIGHTS.dim.attack };
  }
  return trained ? { label: 'darkness (Strid i mörker)', value: -5 } : { label: 'darkness', value: LIGHTS.dark.attack };
}

/** Does `c` gain anything from a Strid i mörker roll this round? */
export function needsDarkFighting(ctx: Ctx, c: Combatant): boolean {
  return ctx.state.map.light !== 'day' && !!c.sheet.skills.fightInDarkness && !!lightMod(ctx, c);
}
