import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { attackCL, resolveWeapon } from '../src/engine/cl';
import { meleeAttackOptions } from '../src/engine/requests';
import { simulate } from '../src/engine/session';
import { createCombat } from '../src/engine/state';

const duel = (a: string, b: string) => [
  { sheet: presetById(a), team: 0, controller: 'ai' as const, pos: { x: 0, y: 0 } },
  { sheet: presetById(b), team: 1, controller: 'ai' as const, pos: { x: 1, y: 0 } },
];

const logText = (houseRules: boolean, seeds: number) => {
  const out: string[] = [];
  for (let seed = 1; seed <= seeds; seed++) out.push(...simulate(duel('mercenary', 'barbarian'), seed, { houseRules }).state.log.map((l) => l.text));
  return out;
};

describe('house rules', () => {
  it('a standard attack has no penalty and aiming at any location costs −5', () => {
    const ctx = createCombat(duel('mercenary', 'barbarian'), 1, { houseRules: true });
    const [a, d] = ctx.state.combatants;
    const w = resolveWeapon(a, 'main')!;
    const standard = attackCL(ctx, a, d, w, 'wild');
    expect(standard.mods.find((m) => m.label === 'standard attack')?.value).toBe(0);
    for (const loc of ['head', 'chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const) {
      expect(attackCL(ctx, a, d, w, loc).cl).toBe(standard.cl - 5);
    }
  });

  it('no blotta is rolled and Förutse blotta is not offered', () => {
    const ctx = createCombat(duel('mercenary', 'barbarian'), 1, { houseRules: true });
    const [a, d] = ctx.state.combatants;
    const opts = meleeAttackOptions(ctx, a, d);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      expect(o.exposed).toBeNull();
      expect(o.standard).toBe(true);
      expect(o.techniques.some((t) => t.id === 'predictOpening')).toBe(false);
    }
    expect(d.blotta).toEqual({});
  });

  it('fights under the house rules have special hits, no blotta and parryable perfect hits', () => {
    const text = logText(true, 40);
    expect(text.some((t) => t.startsWith('SPECIAL HIT'))).toBe(true);
    expect(text.some((t) => t.includes(' exposes the '))).toBe(false);
    expect(text.some((t) => t.startsWith('Only a perfect parry'))).toBe(false);
    expect(text.some((t) => t.includes('makes a standard attack'))).toBe(true);
  });

  it('the basic rules are unchanged: no special hits', () => {
    const text = logText(false, 20);
    expect(text.some((t) => t.startsWith('SPECIAL HIT'))).toBe(false);
    expect(text.some((t) => t.includes(' exposes the '))).toBe(true);
  });
});
