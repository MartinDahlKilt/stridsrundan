import { describe, expect, it } from 'vitest';
import { spellDef } from '../src/data/spells';
import { presetById } from '../src/data/presets';
import { castingCL } from '../src/engine/cl';
import { applyDirectKp } from '../src/engine/damage';
import { scriptedDice } from '../src/engine/dice';
import { castActions, castBlock, castShieldParry, magicOptions, misfire, psyCost, releaseSpell, suicideMaxE, tickBurns, whirlwindDeflects } from '../src/engine/magic';
import { buildActionOptions, meleeParryOptions } from '../src/engine/requests';
import { resolveWeapon } from '../src/engine/cl';
import { CombatSession, simulate } from '../src/engine/session';
import { createCombat } from '../src/engine/state';
import { itemDef } from '../src/data/items';
import type { CharacterSheet } from '../src/engine/types';

const duel = (a: string | CharacterSheet, b: string | CharacterSheet) => [
  { sheet: typeof a === 'string' ? presetById(a) : a, team: 0, controller: 'ai' as const },
  { sheet: typeof b === 'string' ? presetById(b) : b, team: 1, controller: 'ai' as const },
];

/** A fight in round 1 with scripted dice. */
function setup(a: string | CharacterSheet, b: string | CharacterSheet, dice: number[]) {
  const ctx = createCombat(duel(a, b), 1, {}, scriptedDice(dice));
  ctx.state.round = 1;
  ctx.state.opp = 1;
  const [x, y] = ctx.state.combatants;
  return { ctx, x, y };
}

describe('§22.2 casting time (MH 1893–1903)', () => {
  it('normal 4 actions, quick 2; S above 30 makes normal spells quick and quick spells take 1 action', () => {
    expect(castActions(spellDef('fireball'), 14)).toBe(4);
    expect(castActions(spellDef('lightning'), 14)).toBe(2);
    expect(castActions(spellDef('fireball'), 31)).toBe(2);
    expect(castActions(spellDef('shield'), 31)).toBe(1);
    expect(castActions(spellDef('shield'), 30)).toBe(2);
  });
});

describe('§22.2 CL and PSY (III 103–212)', () => {
  it('CL = S − 2 per effect grade above the first; a suicide spell uses the plain S', () => {
    const { ctx, x } = setup('stormCaller', 'knight', []);
    expect(castingCL(ctx, x, 'lightning', 1).cl).toBe(14);
    expect(castingCL(ctx, x, 'lightning', 4).cl).toBe(8);
    expect(castingCL(ctx, x, 'lightning', 6, true).cl).toBe(14);
  });
  it('PSY: success E, perfect half (min 1, in the caster’s favour), failure 1, fumble E', () => {
    expect(psyCost('success', 5)).toBe(5);
    expect(psyCost('perfect', 5)).toBe(2);
    expect(psyCost('perfect', 1)).toBe(1);
    expect(psyCost('failure', 5)).toBe(1);
    expect(psyCost('fumble', 5)).toBe(5);
  });
  it('max E is the school FV and the PSY left; a suicide spell may use PSY + half the normal PSY', () => {
    const { ctx, x } = setup('stormCaller', 'knight', []);
    const blixt = magicOptions(ctx, x)!.spells.find((s) => s.id === 'lightning')!;
    expect(blixt.maxE).toBe(15); // school FV 15, PSY 16
    x.psy = 3;
    const low = magicOptions(ctx, x)!.spells.find((s) => s.id === 'lightning')!;
    expect(low.maxE).toBe(3);
    expect(suicideMaxE(x)).toBe(3 + 8);
    expect(low.suicideMaxE).toBe(11);
  });
});

describe('§22.1 iron (III 505–520)', () => {
  it('no casting in iron armour or with iron in hand; wooden staves are fine', () => {
    const { x, y } = setup('pyromancer', 'knight', []);
    expect(castBlock(x)).toBeNull();
    const knightWizard: CharacterSheet = { ...presetById('knight'), magic: { schools: { elemental: 10 }, spells: { fire: 10 } } };
    const k = createCombat(duel(knightWizard, 'barbarian'), 1).state.combatants[0];
    expect(castBlock(k)).toMatch(/wears iron/);
    const swordWizard: CharacterSheet = {
      ...presetById('pyromancer'),
      equipment: { items: { sword: { def: 'shortSword' } }, loadouts: [{ name: 'Sword', main: 'sword', off: null }], armour: ['cloth-complete'] },
    };
    const s = createCombat(duel(swordWizard, 'barbarian'), 1).state.combatants[0];
    expect(castBlock(s)).toMatch(/holds iron/);
    expect(y.sheet.magic).toBeUndefined();
  });
  it('non-casters get no magic options; casters do', () => {
    const { ctx, x, y } = setup('pyromancer', 'knight', []);
    for (const c of [x, y]) c.slots = [{ opp: 1, used: false, lost: false }];
    expect(buildActionOptions(ctx, y).magic).toBeNull();
    expect(buildActionOptions(ctx, x).magic!.spells.map((s) => s.id)).toEqual(['shield', 'flamingHand', 'fire', 'fireball', 'innerFire']);
  });
});

describe('§22.5 spell damage', () => {
  it('BLIXT: 1T6/E to total KP and SP, armour gives no protection', () => {
    // cast roll 5 ≤ CL 10; KP 1,2,3; SP 4,5,6
    const { ctx, x, y } = setup('stormCaller', 'knight', [5, 1, 2, 3, 4, 5, 6]);
    const kp = y.kpTotal.cur;
    const sp = y.spTotal.cur;
    releaseSpell(ctx, x, { spell: 'lightning', e: 3, suicide: false }, { targetId: y.id });
    expect(y.kpTotal.cur).toBe(kp - 6);
    expect(y.spTotal.cur).toBe(sp - 15);
    expect(x.psy).toBe(16 - 3);
  });
  it('ELD: total KP/SP, the torso armour absorbs', () => {
    // knight chest: full plate 8/4. Cast 5 ≤ 12; KP 6+6 = 12 − 8 = 4; SP 6+6 = 12 − 4 = 8
    const { ctx, x, y } = setup('pyromancer', 'knight', [5, 6, 6, 6, 6]);
    const kp = y.kpTotal.cur;
    const sp = y.spTotal.cur;
    releaseSpell(ctx, x, { spell: 'fire', e: 2, suicide: false }, { targetId: y.id });
    expect(y.kpTotal.cur).toBe(kp - 4);
    expect(y.spTotal.cur).toBe(sp - 8);
  });
  it('ISKLOT is aimed: it hits the chosen location through that location’s armour', () => {
    // barbarian head: leather cap 2/2. Cast 3 ≤ 12; KP 8+8 = 16 − 2 = 14
    const { ctx, x, y } = setup('frostWitch', 'barbarian', [3, 8, 8, 1, 1]);
    const before = y.kp.head.cur;
    releaseSpell(ctx, x, { spell: 'iceBall', e: 2, suicide: false }, { targetId: y.id, location: 'head' });
    expect(y.kp.head.cur).toBe(before - 14);
    expect(y.status).toBe('out');
  });
  it('a failed spell costs 1 PSY and does nothing; a perfect one costs half', () => {
    const fail = setup('stormCaller', 'knight', [15]);
    releaseSpell(fail.ctx, fail.x, { spell: 'lightning', e: 4, suicide: false }, { targetId: fail.y.id });
    expect(fail.x.psy).toBe(15);
    expect(fail.y.kpTotal.cur).toBe(fail.y.kpTotal.max);
    const perfect = setup('stormCaller', 'knight', [1, 5, 1, 1, 1, 1, 1, 1, 1, 1]);
    releaseSpell(perfect.ctx, perfect.x, { spell: 'lightning', e: 4, suicide: false }, { targetId: perfect.y.id });
    expect(perfect.x.psy).toBe(14);
  });
  it('ELDKLOT keeps burning: 1T6 KP and SP at the end of the following rounds', () => {
    const { ctx, x, y } = setup('pyromancer', 'barbarian', [5, 1, 1, 1, 2]); // cast, KP, SP, location, burn rounds
    releaseSpell(ctx, x, { spell: 'fireball', e: 1, suicide: false }, { targetId: y.id });
    expect(y.burns).toEqual([{ dice: '1T6', fromRound: 2, throughRound: 3, source: 'ELDKLOT' }]);
    const kp = y.kpTotal.cur;
    ctx.dice = scriptedDice([4, 3, 2, 2]);
    tickBurns(ctx, y); // round 1: not yet
    expect(y.kpTotal.cur).toBe(kp);
    ctx.state.round = 2;
    tickBurns(ctx, y);
    expect(y.kpTotal.cur).toBe(kp - 4);
    ctx.state.round = 3;
    tickBurns(ctx, y);
    expect(y.kpTotal.cur).toBe(kp - 6);
    expect(y.burns).toEqual([]);
  });
});

describe('§22.3 magic resistance (III 246–260)', () => {
  it('FÖRFRYSA must beat the target’s PSY with the caster’s PSY after paying', () => {
    // E1: witch PSY 16 → 15 after paying vs knight PSY 14 → needs 11. Cast 4, resistance 12 → resisted.
    const { ctx, x, y } = setup('frostWitch', 'knight', [4, 12]);
    releaseSpell(ctx, x, { spell: 'freeze', e: 1, suicide: false }, { targetId: y.id });
    expect(y.kpTotal.cur).toBe(y.kpTotal.max);
    expect(ctx.state.log.some((l) => /needs 11, rolled 12 – Knight resists/.test(l.text))).toBe(true);
  });
  it('physical (F) spells need no resistance roll', () => {
    const { ctx, x, y } = setup('stormCaller', 'knight', [5, 1, 1]);
    releaseSpell(ctx, x, { spell: 'lightning', e: 1, suicide: false }, { targetId: y.id });
    expect(ctx.state.log.some((l) => /resists|takes hold/.test(l.text))).toBe(false);
  });
});

describe('§22.4 concentration (III 212–216)', () => {
  it('being hurt while casting loses the spell and 1 PSY', () => {
    const { ctx, x } = setup('pyromancer', 'knight', []);
    x.casting = { spell: 'fireball', e: 4, done: 2, total: 4, suicide: false };
    applyDirectKp(ctx, x, 'leftArm', 1, 'test');
    expect(x.casting).toBeNull();
    expect(x.psy).toBe(16);
  });
  it('doing something else gives up the spell (1 PSY); waiting keeps it', () => {
    const s = new CombatSession(
      [
        { sheet: presetById('pyromancer'), team: 0, controller: 'human' },
        { sheet: presetById('knight'), team: 1, controller: 'ai' },
      ],
      3,
    );
    s.advance();
    const c = s.state.combatants[0];
    while (s.pending && !(s.pending.kind === 'action' && s.pending.actorId === c.id)) s.autoAnswer();
    s.answer({ kind: 'cast', spell: 'fireball', e: 2 });
    expect(c.casting).toMatchObject({ spell: 'fireball', done: 1, total: 4 });
    while (s.pending && !(s.pending.kind === 'action' && s.pending.actorId === c.id)) s.autoAnswer();
    s.answer({ kind: 'hold' });
    expect(c.casting?.done).toBe(1);
    while (s.pending && !(s.pending.kind === 'action' && s.pending.actorId === c.id)) s.autoAnswer();
    const psy = c.psy;
    s.answer({ kind: 'aim' } as never); // not offered, but any other action abandons the spell
    expect(c.casting).toBeNull();
    expect(c.psy).toBe(psy - 1);
  });
});

describe('§22.6 special spells', () => {
  it('SKÖLD: an instant magic parry with S above 30; success stops the blow', () => {
    const { ctx, x, y } = setup('vaelis', 'knight', [5]);
    x.slots = [{ opp: 1, used: false, lost: false }];
    const opts = meleeParryOptions(ctx, x, y, resolveWeapon(y, 'main')!, { wild: false, chain: false, feint: false, kneeStrike: false, attackerActions: 2 });
    const shield = opts.find((o) => o.source.kind === 'spell');
    expect(shield?.name).toMatch(/SKÖLD spell \(E1, BV 4, 1 action\)/);
    expect(castShieldParry(ctx, x, 1, false)).toBe(true);
    expect(x.staffPsy?.cur).toBe(4); // the staff pays first
    expect(x.psy).toBe(21);
  });
  it('SKÖLD must be prepared first without S above 30', () => {
    const { ctx, x, y } = setup('pyromancer', 'knight', []);
    x.slots = [{ opp: 1, used: false, lost: false }];
    const pc = { wild: false, chain: false, feint: false, kneeStrike: false, attackerActions: 2 };
    const w = resolveWeapon(y, 'main')!;
    expect(meleeParryOptions(ctx, x, y, w, pc).some((o) => o.source.kind === 'spell')).toBe(false);
    x.casting = { spell: 'shield', e: 1, done: 1, total: 2, suicide: false };
    expect(meleeParryOptions(ctx, x, y, w, pc).find((o) => o.source.kind === 'spell')?.name).toMatch(/prepared/);
  });
  it('KNÄCKA lowers BV by 10 (+2 per extra E) and breaks the weapon at 0', () => {
    const { ctx, x, y } = setup('stoneShaper', 'huscarl', [5]);
    releaseSpell(ctx, x, { spell: 'shatter', e: 2, suicide: false }, { targetId: y.id, item: 'main' });
    expect(y.items[y.sheet.equipment.loadouts[0].main!].status).toBe('broken');
    expect(y.hands.main).toBeNull();
  });
  it('FÖRBANNA VAPEN: −E CL and damage on that weapon', () => {
    const { ctx, x, y } = setup('stoneShaper', 'huscarl', [5]);
    releaseSpell(ctx, x, { spell: 'curseWeapon', e: 3, suicide: false }, { targetId: y.id, item: 'main' });
    expect(y.activeSpells).toHaveLength(1);
    expect(y.activeSpells[0]).toMatchObject({ kind: 'weapon', value: -3 });
    const opts = buildActionOptions(ctx, y);
    expect(opts).toBeDefined();
  });
  it('KALLA HANDEN: a failed hard FYS roll loses the rest of the round', () => {
    // cast 5; FYS 16 vs hard: needs 11, rolled 15 → frozen
    const { ctx, x, y } = setup('frostWitch', 'barbarian', [5, 15]);
    y.slots = [
      { opp: 1, used: false, lost: false },
      { opp: 2, used: false, lost: false },
    ];
    releaseSpell(ctx, x, { spell: 'coldHand', e: 1, suicide: false }, { targetId: y.id });
    expect(y.slots.every((s) => s.lost)).toBe(true);
  });
  it('VIRVELSKÖLD: E vs the projectile on the resistance table', () => {
    const { ctx, x } = setup('stormCaller', 'ranger', [3, 15]);
    x.activeSpells.push({ kind: 'whirlwind', value: 5, throughRound: 10, name: 'VIRVELSKÖLD E5' });
    expect(whirlwindDeflects(ctx, x, itemDef('longbow'))).toBe(true); // needs 5 − 4 + 10 = 11
    expect(whirlwindDeflects(ctx, x, itemDef('longbow'))).toBe(false);
  });
});

describe('§22.7 misfires (III 556–570)', () => {
  it('1–5: half effect; 6–11: knocked out; 12–15 harmful: hits the caster; 16–17: mute; 18: paralysed', () => {
    const half = setup('stormCaller', 'knight', [2, 1, 2, 1, 1]); // 2 + E3 = 5 → E2: KP 1+2, SP 1+1
    misfire(half.ctx, half.x, spellDef('lightning'), 3, { targetId: half.y.id });
    expect(half.y.kpTotal.cur).toBe(half.y.kpTotal.max - 3);

    const out = setup('stormCaller', 'knight', [8]);
    misfire(out.ctx, out.x, spellDef('lightning'), 3, { targetId: out.y.id });
    expect(out.x.outKind).toBe('unconscious');

    const back = setup('stormCaller', 'knight', [11, 6, 6, 6, 6, 6, 6]);
    misfire(back.ctx, back.x, spellDef('lightning'), 3, { targetId: back.y.id });
    expect(back.x.kpTotal.cur).toBeLessThan(0);
    expect(back.y.kpTotal.cur).toBe(back.y.kpTotal.max);

    const mute = setup('stormCaller', 'knight', [15]);
    misfire(mute.ctx, mute.x, spellDef('lightning'), 1, { targetId: mute.y.id });
    expect(castBlock(mute.x)).toMatch(/struck dumb/);

    const para = setup('stormCaller', 'knight', [17]);
    misfire(para.ctx, para.x, spellDef('lightning'), 1, { targetId: para.y.id });
    expect(para.x.outReason).toMatch(/paralysed/);
  });
});

describe('§22.2 suicide spell (III 225–245)', () => {
  it('PSY below zero kills the caster after the spell takes effect', () => {
    const { ctx, x, y } = setup('stormCaller', 'barbarian', [10, 6, 6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 1]);
    x.psy = 2;
    releaseSpell(ctx, x, { spell: 'lightning', e: 6, suicide: true }, { targetId: y.id });
    expect(x.psy).toBe(-4);
    expect(x.outKind).toBe('dead');
    expect(y.kpTotal.cur).toBe(y.kpTotal.max - 36);
  });
});

describe('§22 whole fights with the AI', () => {
  const casters = ['pyromancer', 'frostWitch', 'stormCaller', 'stoneShaper', 'vaelis'];
  const foes = ['knight', 'barbarian', 'ranger', 'duellist', 'aldric', 'pyromancer'];
  it('every caster fights every kind of foe to a finish, casting spells and spending PSY', () => {
    for (const a of casters) {
      for (const b of foes) {
        for (let seed = 1; seed <= 6; seed++) {
          const ctx = simulate(duel(a, b), seed);
          expect(ctx.state.over).toBe(true);
          const w = ctx.state.combatants[0];
          expect(w.psy + (w.staffPsy?.cur ?? 0)).toBeLessThanOrEqual(w.psyMax + (w.staffPsy?.max ?? 0));
        }
        const casts = [1, 2, 3, 4, 5, 6].some((seed) => simulate(duel(a, b), seed).state.log.some((l) => /begins|releases|snaps up/.test(l.text)));
        expect(casts, `${a} vs ${b}`).toBe(true);
      }
    }
  });
});
