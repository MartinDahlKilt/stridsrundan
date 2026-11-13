import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { attackCL, resolveWeapon } from '../src/engine/cl';
import { scriptedDice } from '../src/engine/dice';
import { rollDamage } from '../src/engine/damage';
import { attackDirection, faceTowards, sneakFV, spotDangerCL } from '../src/engine/facing';
import { simulate } from '../src/engine/session';
import { createCombat, placeFighters } from '../src/engine/state';
import type { Pos } from '../src/engine/types';

const setup = (a: string, b: string, pa?: Pos, pb?: Pos) => [
  { sheet: presetById(a), team: 0, controller: 'ai' as const, pos: pa },
  { sheet: presetById(b), team: 1, controller: 'ai' as const, pos: pb },
];

describe('facing', () => {
  it('splits the squares around a fighter into front, side and rear', () => {
    const ctx = createCombat(setup('knight', 'barbarian', { x: 5, y: 5 }, { x: 6, y: 5 }), 1);
    const [k] = ctx.state.combatants;
    expect(k.facing).toEqual({ x: 1, y: 0 }); // towards the barbarian
    expect(attackDirection(k, { x: 6, y: 4 })).toBe('front');
    expect(attackDirection(k, { x: 6, y: 6 })).toBe('front');
    expect(attackDirection(k, { x: 5, y: 4 })).toBe('side');
    expect(attackDirection(k, { x: 5, y: 6 })).toBe('side');
    expect(attackDirection(k, { x: 4, y: 4 })).toBe('rear');
    expect(attackDirection(k, { x: 4, y: 5 })).toBe('rear');
    // Reach-2 squares: a knight's move ahead still counts as the front.
    expect(attackDirection(k, { x: 7, y: 6 })).toBe('front');
  });

  it('gives +3 from the side and +7 from behind, unless the option is off', () => {
    const ctx = createCombat(setup('barbarian', 'knight', { x: 5, y: 4 }, { x: 5, y: 5 }), 1);
    const [b, k] = ctx.state.combatants;
    const w = resolveWeapon(b, 'main')!;
    faceTowards(k, { x: 6, y: 5 }); // the knight looks east; the barbarian is at its side
    const side = attackCL(ctx, b, k, w, 'chest');
    expect(side.mods).toContainEqual({ label: 'from the side', value: 3 });
    faceTowards(k, { x: 5, y: 6 }); // now the barbarian is behind it
    const rear = attackCL(ctx, b, k, w, 'chest');
    expect(rear.mods).toContainEqual({ label: 'from behind', value: 7 });
    expect(rear.cl - side.cl).toBe(4);
    ctx.rules.flanking = false;
    expect(attackCL(ctx, b, k, w, 'chest').mods.some((m) => m.label.startsWith('from'))).toBe(false);
  });

  it('uses base chances for Smyga and Upptäcka fara, halving Smyga in metal armour', () => {
    const ctx = createCombat(setup('cutthroat', 'knight'), 1);
    const [cut, knight] = ctx.state.combatants;
    expect(sneakFV(cut)).toEqual({ fv: 3, note: '' }); // SMI 16 → BC 3, leather
    expect(sneakFV(knight).fv).toBe(1); // SMI 12 → BC 2, halved in plate
    expect(spotDangerCL(knight).fv).toBe(3); // PSY 14
  });
});

describe('backstab', () => {
  it('the assassin multiplies weapon damage and drops SB', () => {
    const ctx = createCombat(setup('cutthroat', 'knight'), 1);
    const [cut] = ctx.state.combatants;
    cut.hands = { main: 'dagger1', off: 'dagger2' };
    const w = resolveWeapon(cut, 'main')!;
    ctx.dice = scriptedDice([3, 2]); // dagger KP 1T4+1 → 4, SP 1T3 → 2
    const dmg = rollDamage(ctx, cut, w, { melee: true, weaponMultiplier: 2, noSB: true, extraKp: 4 });
    expect(dmg.kp).toBe((3 + 1) * 2 + 4); // dagger 1T4+1
    expect(dmg.sp).toBe(2 * 2);
  });
});

describe('several fighters per side', () => {
  it('lines up fighters without a square and keeps the given ones', () => {
    const p = placeFighters([{ team: 0 }, { team: 0 }, { team: 1, pos: { x: 2, y: 2 } }, { team: 1 }, { team: 0 }]);
    expect(p[0]).toEqual({ x: 3, y: 5 });
    expect(p[1]).toEqual({ x: 3, y: 4 });
    expect(p[2]).toEqual({ x: 2, y: 2 });
    expect(p[3]).toEqual({ x: 16, y: 5 });
    expect(p[4]).toEqual({ x: 3, y: 6 });
  });

  it('numbers fighters with the same name', () => {
    const ctx = createCombat([...setup('knight', 'barbarian'), { sheet: presetById('knight'), team: 0, controller: 'ai' }], 1);
    expect(ctx.state.combatants.map((c) => c.sheet.name)).toEqual(['Knight 1', 'Northern Barbarian', 'Knight 2']);
  });

  it('two against one: the pair flanks, and the fights end', () => {
    let flanked = 0;
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulate(
        [
          { sheet: presetById('mercenary'), team: 0, controller: 'ai' },
          { sheet: presetById('huscarl'), team: 0, controller: 'ai' },
          { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
        ],
        seed,
      );
      expect(r.state.over).toBe(true);
      if (r.state.log.some((e) => / from (the side|behind) /.test(e.text) || /steals? up behind/.test(e.text))) flanked++;
      if (r.state.winner === 0) wins++;
    }
    expect(flanked).toBeGreaterThan(10);
    expect(wins).toBeGreaterThan(14);
  });
});

describe('sneaking up from behind', () => {
  const fight = (hidden: boolean, seed: number) =>
    simulate(
      [
        { sheet: presetById('mercenary'), team: 0, controller: 'ai' },
        { sheet: presetById('cutthroat'), team: 0, controller: 'ai', hidden },
        { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
      ],
      seed,
    );
  const sneaks = (log: { text: string }[]) => log.filter((e) => /tries to steal up behind|steals up behind/.test(e.text));

  it('is only possible for a fighter hidden from the start', () => {
    for (let seed = 1; seed <= 20; seed++) expect(sneaks(fight(false, seed).state.log)).toHaveLength(0);
  });

  it('a hidden fighter sneaks at most once – its first attack gives it away', () => {
    let tried = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const log = fight(true, seed).state.log;
      const s = sneaks(log);
      expect(s.length).toBeLessThanOrEqual(1);
      tried += s.length;
      const revealed = log.findIndex((e) => /Cutthroat is no longer hidden/.test(e.text));
      if (s.length) expect(log.indexOf(s[0] as (typeof log)[number])).toBeLessThan(revealed);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('starts hidden only when chosen, and only with the facing rule on', () => {
    const hiddenCut = (rules = {}) =>
      createCombat(
        [
          { sheet: presetById('cutthroat'), team: 0, controller: 'ai', hidden: true },
          { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
        ],
        1,
        rules,
      ).state.combatants;
    expect(hiddenCut().map((c) => c.hidden)).toEqual([true, false]);
    expect(hiddenCut({ flanking: false })[0].hidden).toBe(false);
  });
});
