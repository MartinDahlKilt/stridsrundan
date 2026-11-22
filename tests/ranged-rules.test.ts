import { describe, expect, it } from 'vitest';
import { itemDef } from '../src/data/items';
import { presetById } from '../src/data/presets';
import { rangeModifier } from '../src/data/tables';
import { attackCL, maxRangeM, rangedCL, resolveWeapon } from '../src/engine/cl';
import { hideFV } from '../src/engine/facing';
import { hideCheck } from '../src/engine/requests';
import { CombatSession } from '../src/engine/session';
import { createCombat, type CombatantSetup } from '../src/engine/state';
import { emptyMap, missilePath, type BattleMap, type Light, type TerrainKind } from '../src/engine/terrain';
import type { Pos } from '../src/engine/types';

const field = (light: Light = 'day', cells: [Pos, TerrainKind][] = []): BattleMap => {
  const m = emptyMap(21, 11);
  m.light = light;
  for (const [p, k] of cells) m.cells[p.y * m.width + p.x] = k;
  return m;
};
const duel = (a: string, b: string, pa: Pos, pb: Pos): CombatantSetup[] => [
  { sheet: presetById(a), team: 0, controller: 'ai', pos: pa },
  { sheet: presetById(b), team: 1, controller: 'ai', pos: pb },
];

describe('range (III 2637–2645)', () => {
  it('no penalty inside half the range, −5 to ¾, −10 to the full range, nothing beyond', () => {
    expect(rangeModifier(60, 135)).toBe(0);
    expect(rangeModifier(90, 135)).toBe(-5);
    expect(rangeModifier(120, 135)).toBe(-10);
    expect(rangeModifier(136, 135)).toBe(null);
  });

  it("thrown weapons reach the thrower's STY in squares; God bågskytt adds 25% to bows", () => {
    const ctx = createCombat(duel('ranger', 'barbarian', { x: 3, y: 5 }, { x: 15, y: 5 }), 1, {}, undefined, field());
    const [r] = ctx.state.combatants;
    expect(maxRangeM(r, itemDef('throwingKnife'))).toBe(r.sheet.attributes.STY * 1.5);
    expect(maxRangeM(r, itemDef('longbow'))).toBe(180);
    r.sheet = { ...r.sheet, abilities: ['goodArcher'] };
    expect(maxRangeM(r, itemDef('longbow'))).toBe(225);
    expect(maxRangeM(r, itemDef('throwingKnife'))).toBe(r.sheet.attributes.STY * 1.5);
  });
});

describe('light (II 1343)', () => {
  it('costs −5 in dim light and −15 in the dark, melee and ranged; dwarves see in the dark', () => {
    for (const [light, value] of [['dim', -5], ['dark', -15]] as const) {
      const ctx = createCombat(duel('ranger', 'barbarian', { x: 3, y: 5 }, { x: 12, y: 5 }), 1, {}, undefined, field(light));
      const [a, d] = ctx.state.combatants;
      expect(rangedCL(ctx, a, d, null).mods.some((m) => m.value === value)).toBe(true);
      d.pos = { x: 4, y: 5 };
      const w = resolveWeapon(d, 'main')!;
      expect(attackCL(ctx, d, a, w, 'chest').mods.some((m) => m.value === value)).toBe(true);
      d.sheet = { ...d.sheet, race: 'dwarf' };
      expect(attackCL(ctx, d, a, w, 'chest').mods.some((m) => m.value === value)).toBe(false);
    }
  });
});

describe('hiding (I 2254)', () => {
  it('uses Gömma sig (INT), +4 for halflings, easier in poor light', () => {
    const ctx = createCombat(duel('cutthroat', 'barbarian', { x: 3, y: 5 }, { x: 15, y: 5 }), 1, {}, undefined, field('dark', [[{ x: 3, y: 5 }, 'bush']]));
    const [c] = ctx.state.combatants;
    const base = hideFV(c);
    expect(hideCheck(ctx, c)!.cl).toBe(base + 2 + 5); // bushes +2, night +5
    c.sheet = { ...c.sheet, race: 'halfling' };
    if (c.sheet.skills.hide === undefined) expect(hideFV(c)).toBe(base + 4);
  });
});

describe('missiles', () => {
  it('a miss flies on 50% further, within range, until something solid stops it', () => {
    const m = field('day', [[{ x: 17, y: 5 }, 'wall']]);
    const path = missilePath(m, 'hex', { x: 2, y: 5 }, { x: 10, y: 5 }, 100);
    expect(path[0]).toEqual({ x: 11, y: 5 });
    expect(path.at(-1)).toEqual({ x: 14, y: 5 }); // 8 cells on → 4 more
    expect(missilePath(m, 'hex', { x: 2, y: 5 }, { x: 10, y: 5 }, 12)).toEqual([]); // range 8 cells: nothing beyond the target
    expect(missilePath(m, 'hex', { x: 2, y: 5 }, { x: 10, y: 5 }, 13.5)).toEqual([{ x: 11, y: 5 }]);
    expect(missilePath(m, 'hex', { x: 6, y: 5 }, { x: 14, y: 5 }, 100).some((p) => p.x >= 17)).toBe(false); // the wall
  });

  it('shows who is in the line of fire', () => {
    const s = new CombatSession(
      [
        { sheet: presetById('ranger'), team: 0, controller: 'human', pos: { x: 3, y: 5 } },
        { sheet: presetById('mercenary'), team: 0, controller: 'ai', pos: { x: 8, y: 5 } },
        { sheet: presetById('barbarian'), team: 1, controller: 'ai', pos: { x: 14, y: 5 } },
      ],
      3,
      {},
      field(),
    );
    s.advance();
    let req = s.pending;
    for (let i = 0; i < 20 && req && req.kind !== 'action'; i++) {
      s.autoAnswer();
      req = s.pending;
    }
    expect(req?.kind).toBe('action');
    const shot = req!.kind === 'action' ? req!.options.shots.find((x) => x.targetName.startsWith('Northern')) : undefined;
    expect(shot?.friendsInTheWay).toEqual(['Mercenary']);
  });

  it('takes cover only at the start of the round, before a slower shooter, using every action', () => {
    let offered = 0;
    let notOffered = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = new CombatSession(
        [
          { sheet: presetById('ranger'), team: 0, controller: 'ai', pos: { x: 3, y: 5 } },
          { sheet: presetById('barbarian'), team: 1, controller: 'human', pos: { x: 15, y: 5 } },
        ],
        seed,
        {},
        field('day', [[{ x: 16, y: 5 }, 'rock']]),
      );
      s.advance();
      const req = s.pending!;
      if (req.kind !== 'action') continue;
      const [ranger, barbarian] = s.state.combatants;
      const firstMove = s.state.opp === 1 && barbarian.slots.every((sl) => !sl.used);
      if (!req.options.takeCover) {
        if (firstMove && ranger.initiative > barbarian.initiative) notOffered++;
        continue;
      }
      offered++;
      expect(firstMove).toBe(true);
      expect(barbarian.initiative).toBeGreaterThan(ranger.initiative);
      expect(req.options.takeCover).toMatchObject({ behind: 'boulder', shooters: ['Ranger'] });
      s.answer({ kind: 'takeCover', how: 'cover' }, 'step');
      expect(s.state.round).toBe(1);
      expect(barbarian.tookCover?.round).toBe(1);
      expect(barbarian.slots.every((sl) => sl.used || sl.lost)).toBe(true);
    }
    expect(offered).toBeGreaterThan(0);
    expect(notOffered).toBeGreaterThan(0);
  });
});
