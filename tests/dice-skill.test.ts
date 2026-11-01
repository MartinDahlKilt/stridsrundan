import { describe, expect, it } from 'vitest';
import { maxDice, parseDice, rollDice, scriptedDice, seededDice } from '../src/engine/dice';
import { resistanceTarget, rollResistance, rollSkill } from '../src/engine/skill';

describe('dice', () => {
  it('parses Swedish notation', () => {
    expect(parseDice('2T6+2')).toEqual({ count: 2, sides: 6, mod: 2 });
    expect(parseDice('1T4')).toEqual({ count: 1, sides: 4, mod: 0 });
    expect(parseDice('3T6−1')).toEqual({ count: 3, sides: 6, mod: -1 });
    expect(parseDice('+1')).toEqual({ count: 0, sides: 0, mod: 1 });
    expect(parseDice('–')).toEqual({ count: 0, sides: 0, mod: 0 });
    expect(maxDice(parseDice('2T10+2'))).toBe(22);
  });

  it('rolls with scripted dice', () => {
    expect(rollDice(scriptedDice([3, 5]), parseDice('2T6+2')).total).toBe(10);
  });

  it('is reproducible from a seed', () => {
    const a = seededDice(42);
    const b = seededDice(42);
    const ra = Array.from({ length: 50 }, () => a.d(20));
    const rb = Array.from({ length: 50 }, () => b.d(20));
    expect(ra).toEqual(rb);
    expect(ra.every((v) => v >= 1 && v <= 20)).toBe(true);
  });
});

describe('§3.2 skill rolls', () => {
  it('succeeds at or below CL', () => {
    expect(rollSkill(scriptedDice([12]), 15, 12).outcome).toBe('success');
    expect(rollSkill(scriptedDice([13]), 15, 12).outcome).toBe('failure');
  });

  it('CL 1–19: a 1 confirmed against FV is perfect, otherwise a success', () => {
    expect(rollSkill(scriptedDice([1, 15]), 15, 8).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([1, 16]), 15, 8).outcome).toBe('success');
  });

  it('CL 1–19: a 20 confirmed above FV is a fumble, otherwise a failure', () => {
    expect(rollSkill(scriptedDice([20, 16]), 15, 12).outcome).toBe('fumble');
    expect(rollSkill(scriptedDice([20, 15]), 15, 12).outcome).toBe('failure');
  });

  it('confirmation uses FV, not CL', () => {
    // CL 5 (heavily modified), FV 15: second roll 10 is ≤ FV → perfect.
    expect(rollSkill(scriptedDice([1, 10]), 15, 5).outcome).toBe('perfect');
  });

  it('CL ≥ 20: 1 always perfect, 2 confirmed is perfect, only double 20 fumbles', () => {
    expect(rollSkill(scriptedDice([1]), 18, 22).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([2, 5]), 18, 22).outcome).toBe('perfect');
    expect(rollSkill(scriptedDice([2, 19]), 18, 22).outcome).toBe('success');
    expect(rollSkill(scriptedDice([20, 20]), 18, 22).outcome).toBe('fumble');
    expect(rollSkill(scriptedDice([20, 3]), 18, 22).outcome).toBe('failure');
    expect(rollSkill(scriptedDice([19]), 18, 22).outcome).toBe('success');
  });

  it('CL < 1: no perfect, 20 fumbles, success needs two 1s', () => {
    expect(rollSkill(scriptedDice([20]), 10, 0).outcome).toBe('fumble');
    expect(rollSkill(scriptedDice([1, 1]), 10, 0).outcome).toBe('success');
    expect(rollSkill(scriptedDice([1, 2]), 10, -3).outcome).toBe('failure');
    expect(rollSkill(scriptedDice([5]), 10, 0).outcome).toBe('failure');
  });
});

describe('§3.4 resistance table', () => {
  it('target = value − SG + 10', () => {
    expect(resistanceTarget(10, 10)).toBe(10);
    expect(resistanceTarget(1, 1)).toBe(10);
    expect(resistanceTarget(14, 15)).toBe(9);
  });
  it('automatic success at 20+, failure at 0 or less', () => {
    expect(rollResistance(scriptedDice([]), 15, 5).success).toBe(true);
    expect(rollResistance(scriptedDice([]), 1, 11).success).toBe(false);
    expect(rollResistance(scriptedDice([9]), 14, 15).success).toBe(true);
    expect(rollResistance(scriptedDice([10]), 14, 15).success).toBe(false);
  });
});
