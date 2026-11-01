import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { buildSlots, countActions, createCombatant } from '../src/engine/character';
import { resolveWeapon } from '../src/engine/cl';
import { applyHit, checkThresholds, runSilently } from '../src/engine/damage';
import { scriptedDice } from '../src/engine/dice';
import { maneuverOptions } from '../src/engine/requests';
import { CombatSession } from '../src/engine/session';
import { raiseOutcome, rollSkill } from '../src/engine/skill';
import { createCombat } from '../src/engine/state';

const duel = (a: string, b: string) => [
  { sheet: presetById(a), team: 0, controller: 'ai' as const },
  { sheet: presetById(b), team: 1, controller: 'ai' as const },
];

describe('§21.1 very high FV (HH 561–577)', () => {
  it('FV 21–40: a 1 is always perfect; a 2 is perfect if the 2nd roll ≤ FV−20', () => {
    expect(rollSkill(scriptedDice([1]), 25, 25).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([2, 5]), 25, 25).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([2, 6]), 25, 25).outcome).toBe('success');
    expect(rollSkill(scriptedDice([19]), 25, 25).outcome).toBe('success');
  });
  it('FV 41+: 1–2 always perfect, a 3 if the 2nd roll ≤ FV−40', () => {
    expect(rollSkill(scriptedDice([2]), 45, 45).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([3, 5]), 45, 45).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([3, 6]), 45, 45).outcome).toBe('success');
  });
  it('fumble after a 20: 2nd roll above FV/2, and always on 16–20', () => {
    expect(rollSkill(scriptedDice([20, 13]), 24, 24).outcome).toBe('fumble'); // 13 > 12
    expect(rollSkill(scriptedDice([20, 12]), 24, 24).outcome).toBe('failure');
    expect(rollSkill(scriptedDice([20, 16]), 40, 40).outcome).toBe('fumble'); // 16–20 always
    expect(rollSkill(scriptedDice([20, 15]), 40, 40).outcome).toBe('failure');
    expect(rollSkill(scriptedDice([20, 19]), 40, 40, 'base').outcome).toBe('failure'); // option: only double 20
  });
  it('a 20 still fails even when CL is above 20', () => {
    expect(rollSkill(scriptedDice([20, 1]), 30, 35).outcome).toBe('failure');
  });
});

describe('§21.2 hero points – "Höja CL" (HH 2972)', () => {
  it('raises the outcome one step and refunds on a perfect', () => {
    expect(raiseOutcome('fumble')).toEqual({ outcome: 'failure', refund: false });
    expect(raiseOutcome('failure')).toEqual({ outcome: 'success', refund: false });
    expect(raiseOutcome('success')).toEqual({ outcome: 'perfect', refund: false });
    expect(raiseOutcome('perfect')).toEqual({ outcome: 'perfect', refund: true });
  });
});

describe('§21.3 extra actions and manoeuvres from high FV (HH 796–864)', () => {
  it('FV 21+ gives an extra action usable only with that weapon', () => {
    const c = createCombatant(presetById('ilsabet'), 'x', 0, 'ai', { x: 0, y: 0 });
    const count = countActions(c);
    // 2 base + 1 two weapons + 1 light (main gauche) + 1 for rapier FV 32
    expect(count.total).toBe(5);
    expect(count.restricted).toEqual({ weapon: 'main', n: 1 });
    const slots = buildSlots(count.total, count.restricted);
    expect(slots.filter((s) => s.weapon === 'main')).toHaveLength(1);
  });
  it('manoeuvres unlock by FV', () => {
    const ctx = createCombat(duel('ilsabet', 'aldric'), 1);
    const [ils, ald] = ctx.state.combatants;
    const ids = (c: typeof ils, t: typeof ald) => maneuverOptions(ctx, c, t, resolveWeapon(c, 'main')!).map((m) => m.id);
    expect(ids(ils, ald)).toEqual(['double', 'triple', 'lightning', 'heroPainStrike']); // FV 32
    expect(ids(ald, ils)).toEqual(['double', 'lightning', 'heroPainStrike']); // FV 24
    const knight = createCombat(duel('knight', 'barbarian'), 1).state.combatants[0];
    expect(maneuverOptions(ctx, knight, ald, resolveWeapon(knight, 'main')!)).toEqual([]); // FV 15
  });
  it('break weapon is offered against a wooden-shafted weapon', () => {
    const ctx = createCombat(duel('aldric', 'gladiator'), 1);
    const [ald, glad] = ctx.state.combatants;
    expect(maneuverOptions(ctx, ald, glad, resolveWeapon(ald, 'main')!).map((m) => m.id)).toContain('breakWeapon'); // trident
  });
});

describe('§21.4 hero abilities', () => {
  it('Steeling: a PSY roll lets the hero ignore a location reaching 0', () => {
    const ctx = createCombat(duel('barbarian', 'vargan'), 1);
    ctx.state.round = 1;
    const v = ctx.state.combatants[1];
    v.kp.chest.cur = 0;
    ctx.dice = scriptedDice([5]); // PSY 13 → ignores it
    checkThresholds(ctx, v, 'chest');
    expect(v.status).toBe('active');
  });
  it('Favoured by the gods restores KP on a successful roll', () => {
    const ctx = createCombat(duel('barbarian', 'aldric'), 1);
    const a = ctx.state.combatants[1];
    a.kpTotal.cur = 0;
    ctx.dice = scriptedDice([10]); // 1T100 ≤ 25
    checkThresholds(ctx, a);
    expect(a.status).toBe('active');
    expect(a.kpTotal.cur).toBe(a.kpTotal.max);
  });
});

describe('§21.5 suicide attack (HH 904–917)', () => {
  it('a fallen hero is offered a last stand: full KP, ignores all but perfect hits', () => {
    let tested = false;
    for (let seed = 1; seed <= 30 && !tested; seed++) {
      const s = new CombatSession(
        [
          { sheet: presetById('morgrath'), team: 0, controller: 'ai' },
          { sheet: presetById('vargan'), team: 1, controller: 'human' },
        ],
        seed,
      );
      s.advance();
      for (let i = 0; i < 400 && s.pending && !s.state.over; i++) {
        if (s.pending.kind !== 'lastStand') {
          s.autoAnswer();
          continue;
        }
        const v = s.ctx.state.combatants[1];
        s.answer(true, 'step');
        expect(v.status).toBe('active');
        expect(v.hero!.lastStandUntil).not.toBeNull();
        // A normal hit is ignored during the last stand.
        const before = v.kpTotal.cur;
        runSilently(applyHit(s.ctx, { attacker: s.ctx.state.combatants[0], defender: v, location: 'chest', dmg: { kp: 30, sp: 30, text: 't' }, perfect: false, exactRoll: false, weaponDef: null, interactive: false }));
        expect(v.kpTotal.cur).toBe(before);
        tested = true;
        break;
      }
    }
    expect(tested).toBe(true);
  });
});
