import { describe, expect, it } from 'vitest';
import { PRESETS, presetById } from '../src/data/presets';
import { armourWeightFactor, bodyPoints, damageBonus, loadPenalty, movement } from '../src/data/tables';
import { armourAt, canWield, countActions, createCombatant, deriveStats, needsTwoHands, slotPlan } from '../src/engine/character';
import { itemDef } from '../src/data/items';
import { armourDef } from '../src/data/armour';

describe('tables', () => {
  it('§2.2 body points', () => {
    expect(bodyPoints(14)).toMatchObject({ chest: 6, head: 5, leftArm: 4, abdomen: 5 });
    expect(bodyPoints(40)).toMatchObject({ chest: 11, rightArm: 9 });
    expect(bodyPoints(45)).toMatchObject({ chest: 12 });
  });
  it('§2.4 damage bonus', () => {
    expect(damageBonus(26)).toBe('0');
    expect(damageBonus(30)).toBe('1T2');
    expect(damageBonus(34)).toBe('1T4');
  });
  it('§2.5 movement', () => {
    expect(movement(41)).toBe(11);
    expect(movement(93)).toBe(17);
  });
  it('§17.3 armour weight factor (III example: 48 → +20%)', () => {
    expect(armourWeightFactor(48)).toBeCloseTo(1.2);
    expect(armourWeightFactor(36)).toBeCloseTo(1);
  });
  it('§15.4 carrying capacity', () => {
    expect(loadPenalty(15, 16)).toBe(0);
    expect(loadPenalty(25, 16)).toBe(-1);
    expect(loadPenalty(40, 16)).toBe(-2);
  });
});

describe('§4.3 actions per round', () => {
  const actions = (id: string) => {
    const c = createCombatant(presetById(id), 'x', 0, 'ai', { x: 0, y: 0 });
    return countActions(c).total;
  };
  it('weapon + shield gives +1', () => expect(actions('mercenary')).toBe(3));
  it('heavy armour costs an action (knight: 2 + shield − plate)', () => expect(actions('knight')).toBe(2));
  it('two weapons + light weapon (duellist: main gauche STY 1 + 10 ≤ 14)', () => expect(actions('duellist')).toBe(4));
  it('two-handed weapon, nothing extra', () => expect(actions('barbarian')).toBe(2));
  it('unarmed fighter: two fists', () => expect(actions('monk')).toBe(3));

  it('extra actions go into opportunities 1, 2, 3', () => {
    expect(slotPlan(2)).toEqual([1, 2]);
    expect(slotPlan(4)).toEqual([1, 1, 2, 3]);
    expect(slotPlan(6)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('derived stats', () => {
  it('barbarian gets +3 STO/FYS for KP and +7 FYS for SP', () => {
    const d = deriveStats(presetById('barbarian'));
    expect(d.kpTotalMax).toBe(19); // ceil((16+3 + 16+3)/2)
    expect(d.spTotalMax).toBe(46); // (16+7)×2
  });
  it('SP = FYS × 2 distributed with the body table', () => {
    const d = deriveStats(presetById('mercenary'));
    expect(d.spTotalMax).toBe(28);
    expect(d.spMax.chest).toBe(9);
  });
});

describe('§8.2 armour layering', () => {
  it('abs KP adds up, abs SP takes the highest layer', () => {
    const c = createCombatant(presetById('huscarl'), 'x', 0, 'ai', { x: 0, y: 0 });
    c.armour.chest = ['chain-mailShirt', 'padded-harness'];
    const a = armourAt(c, 'chest');
    expect(a.absKP).toBe(5 + 3);
    expect(a.absSP).toBe(5);
    expect(a.glance).toBe('chain');
  });
});

describe('§15.3 handling', () => {
  const merc = createCombatant(presetById('mercenary'), 'x', 0, 'ai', { x: 0, y: 0 }); // STY 16
  it('one hand if STY ≥ requirement', () => expect(needsTwoHands(merc, itemDef('bastardSword'))).toBe(true));
  it('two-handed-only weapons always need two hands', () => expect(needsTwoHands(merc, itemDef('longSpear'))).toBe(true));
  it('unusable if requirement > 2 × STY', () => {
    expect(canWield(merc, itemDef('greatSword'))).toBe(true); // 31 ≤ 32
    expect(canWield(merc, itemDef('arbalest'))).toBe(true); // 32 ≤ 32
  });
});

describe('presets', () => {
  it('every preset can wield its starting weapons and wears valid armour', () => {
    for (const p of PRESETS) {
      const c = createCombatant(p, p.id, 0, 'ai', { x: 0, y: 0 });
      for (const key of [c.hands.main, c.hands.off]) {
        if (!key) continue;
        expect(canWield(c, itemDef(c.items[key].def)), `${p.id} ${key}`).toBe(true);
      }
      for (const loc of Object.keys(c.armour) as (keyof typeof c.armour)[]) {
        const types = c.armour[loc].map((id) => armourDef(id).type);
        expect(new Set(types).size, `${p.id} ${loc} type codes`).toBe(types.length);
      }
    }
  });
});

describe('eastern warriors (optional chapter)', () => {
  it('eastern armour never costs actions: the samurai in ~46 kg of o-yoroi keeps 2 actions', () => {
    const c = createCombatant(presetById('samurai'), 'x', 0, 'ai', { x: 0, y: 0 });
    expect(c.derived.armourWeightAdjusted).toBeGreaterThan(30);
    expect(countActions(c).total).toBe(2);
  });
  it('the samurai preset is marked eastern; its gear is eastern', () => {
    const p = presetById('samurai');
    expect(p.eastern).toBe(true);
    expect(itemDef('katana').eastern).toBe(true);
    expect(armourDef('kote').eastern).toBe(true);
  });
});
