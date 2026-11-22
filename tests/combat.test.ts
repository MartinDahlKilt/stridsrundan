import { describe, expect, it } from 'vitest';
import { PRESETS, presetById } from '../src/data/presets';
import { applyHit, checkThresholds, rollDamage, runSilently } from '../src/engine/damage';
import { resolveWeapon } from '../src/engine/cl';
import { scriptedDice } from '../src/engine/dice';
import { CombatSession, simulate } from '../src/engine/session';
import { createCombat } from '../src/engine/state';
import { rangedParryOptions } from '../src/engine/requests';
import type { Location } from '../src/engine/types';

const duel = (a: string, b: string) => [
  { sheet: presetById(a), team: 0, controller: 'ai' as const },
  { sheet: presetById(b), team: 1, controller: 'ai' as const },
];

function hit(attacker: string, defender: string, location: Location, kp: number, sp: number, extra: Partial<Parameters<typeof applyHit>[1]> = {}, dice: number[] = []) {
  const ctx = createCombat(duel(attacker, defender), 1);
  ctx.state.round = 1;
  ctx.dice = scriptedDice(dice);
  const [a, d] = ctx.state.combatants;
  runSilently(applyHit(ctx, { attacker: a, defender: d, location, dmg: { kp, sp, text: 'test' }, perfect: false, exactRoll: false, weaponDef: null, interactive: false, ...extra }));
  return { ctx, a, d };
}

describe('§8 damage', () => {
  it('armour absorbs KP and SP separately', () => {
    // Mercenary chest: chainmail hauberk 5/4.
    const { d } = hit('barbarian', 'mercenary', 'chest', 8, 6);
    expect(d.kp.chest.cur).toBe(d.kp.chest.max - 3);
    expect(d.sp.chest.cur).toBe(d.sp.chest.max - 2);
    expect(d.kpTotal.cur).toBe(d.kpTotal.max - 3);
  });

  it('a perfect hit ignores armour', () => {
    const { d } = hit('barbarian', 'mercenary', 'chest', 4, 2, { perfect: true }, [1]);
    expect(d.kp.chest.cur).toBe(d.kp.chest.max - 4);
  });

  it('§8.6 SP beyond the location overflows into KP', () => {
    // Monk arm SP: FYS 13 → 26 SP → arm 7. Cloth 1/2. 12 SP after armour = 10 → 3 overflow.
    const { d } = hit('barbarian', 'monk', 'leftArm', 1, 12, {}, [1]);
    expect(d.sp.leftArm.cur).toBe(0);
    expect(d.kp.leftArm.cur).toBe(d.kp.leftArm.max - (0 + 3));
  });

  it('§8.5 glancing hit halves damage against plate on 1–4', () => {
    const { d } = hit('barbarian', 'knight', 'chest', 14, 6, { exactRoll: true, weaponDef: { damageKind: 'cut' } as never }, [3]);
    // 14 → 7, minus abs 8 → 0 KP; 6 → 3 SP minus 4 → 0.
    expect(d.kp.chest.cur).toBe(d.kp.chest.max);
  });

  it('§10 losing more SP than STO in one attack costs the next action', () => {
    const ctx = createCombat(duel('barbarian', 'monk'), 1);
    ctx.state.round = 1;
    ctx.state.opp = 1;
    const [a, d] = ctx.state.combatants;
    d.slots = [{ opp: 1, used: false, lost: false }, { opp: 2, used: false, lost: false }];
    d.sheet = { ...d.sheet, skills: { ...d.sheet.skills, fallTechnique: 0 } };
    ctx.dice = scriptedDice([]);
    runSilently(applyHit(ctx, { attacker: a, defender: d, location: 'abdomen', dmg: { kp: 0, sp: 15, text: 't' }, perfect: false, exactRoll: false, weaponDef: null, interactive: false }));
    expect(d.slots[0].lost).toBe(true);
  });
});

describe('§11 thresholds', () => {
  it('abdomen at 0 KP takes the combatant out of the fight', () => {
    const { d } = hit('barbarian', 'duellist', 'abdomen', 20, 0);
    expect(d.status).toBe('out');
  });

  it('total KP at −FYS is death', () => {
    const ctx = createCombat(duel('barbarian', 'monk'), 1);
    const d = ctx.state.combatants[1];
    d.kpTotal.cur = -13;
    checkThresholds(ctx, d);
    expect(d.outKind).toBe('dead');
  });

  it('double damage to the head kills', () => {
    const { d } = hit('barbarian', 'monk', 'head', 30, 0);
    expect(d.outKind).toBe('dead');
  });
});

describe('whole fights', () => {
  it('every preset pairing runs to a result without errors', () => {
    for (let i = 0; i < PRESETS.length; i++) {
      for (let j = 0; j < PRESETS.length; j++) {
        if (i === j) continue;
        for (let seed = 1; seed <= 5; seed++) {
          const ctx = simulate(duel(PRESETS[i].id, PRESETS[j].id), seed);
          expect(ctx.state.over).toBe(true);
        }
      }
    }
  }, 30_000); // heavy: all pairings × 5 seeds; CI runners are slower than local

  it('the same seed gives the same fight', () => {
    const a = simulate(duel('knight', 'duellist'), 77).state.log.map((e) => e.text);
    const b = simulate(duel('knight', 'duellist'), 77).state.log.map((e) => e.text);
    expect(a).toEqual(b);
  });

  it('a human-controlled combatant stops the engine for decisions', () => {
    const s = new CombatSession(
      [
        { sheet: presetById('knight'), team: 0, controller: 'human' },
        { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
      ],
      5,
    );
    s.advance();
    expect(s.pending?.kind).toBe('action');
    expect(s.pending?.actorId).toBe('c0');
    // Hold every time until the fight is over – the engine keeps asking but always progresses.
    for (let i = 0; i < 500 && !s.state.over; i++) {
      if (!s.pending) break;
      s.autoAnswer();
    }
    expect(s.state.over).toBe(true);
  });
});

describe('optional eastern-warriors rules', () => {
  const setup = [
    { sheet: presetById('ranger'), team: 0, controller: 'ai' as const },
    { sheet: presetById('monk'), team: 1, controller: 'ai' as const },
  ];
  it('are off by default: eastern techniques are removed from the fighters', () => {
    const monk = createCombat(setup, 1).state.combatants[1];
    expect(monk.sheet.martialArtTechniques).not.toContain('projectileParry');
    expect(monk.sheet.martialArtTechniques).toContain('feint');
    expect(presetById('monk').martialArtTechniques).toContain('projectileParry'); // preset itself untouched
  });
  it('when on, the monk can parry arrows', () => {
    const ctx = createCombat(setup, 1, { easternWarriors: true });
    const [ranger, monk] = ctx.state.combatants;
    ctx.state.round = 1;
    ctx.state.opp = 1;
    monk.slots = [{ opp: 1, used: false, lost: false }];
    expect(rangedParryOptions(ctx, monk, ranger, false).map((o) => o.name)).toEqual(['Projectile parry']);
    const off = createCombat(setup, 1);
    off.state.round = 1;
    off.state.opp = 1;
    off.state.combatants[1].slots = [{ opp: 1, used: false, lost: false }];
    expect(rangedParryOptions(off, off.state.combatants[1], off.state.combatants[0], false)).toEqual([]);
  });
});

describe('katana', () => {
  it('uses its own two-handed damage row instead of +1T2', () => {
    const ctx = createCombat(duel('samurai', 'knight'), 1, { easternWarriors: true });
    const [a] = ctx.state.combatants;
    ctx.dice = scriptedDice([]);
    const w = resolveWeapon(a, 'main')!;
    const dmg = rollDamage(ctx, a, w, { melee: true, max: true });
    // max 1T10+2 = 12 (+ SB: STY 15 + STO 13 = 28 → +1) = 13 KP; max 1T8 = 8 + 1 = 9 SP.
    expect(dmg.kp).toBe(13);
    expect(dmg.sp).toBe(9);
  });
});
