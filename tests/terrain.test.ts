import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { checkRanged, rangedCL } from '../src/engine/cl';
import { generateMap } from '../src/engine/mapgen';
import { buildActionOptions, hideCheck, hidingSpot, reachableSquares } from '../src/engine/requests';
import { CombatSession, simulate } from '../src/engine/session';
import { createCombat, updateAwareness, visibleEnemiesOf, type CombatantSetup } from '../src/engine/state';
import { emptyMap, MAP_PRESETS, pathCost, sight, walkable, type BattleMap, type TerrainKind } from '../src/engine/terrain';
import type { Pos } from '../src/engine/types';

function mapWith(cells: [Pos, TerrainKind, string?][]): BattleMap {
  const m = emptyMap(21, 11);
  for (const [p, k, deco] of cells) {
    m.cells[p.y * m.width + p.x] = k;
    m.deco[p.y * m.width + p.x] = deco ?? '';
  }
  return m;
}

const duel = (a: string, b: string, pa: Pos, pb: Pos): CombatantSetup[] => [
  { sheet: presetById(a), team: 0, controller: 'ai', pos: pa },
  { sheet: presetById(b), team: 1, controller: 'ai', pos: pb },
];

/** The longbow archer. */
const archer = 'ranger';

describe('generated battlefields', () => {
  it('are the same for the same seed and always join the two sides', () => {
    for (const grid of ['hex', 'square'] as const)
      for (const p of MAP_PRESETS)
        for (let seed = 1; seed <= 5; seed++) {
          const m = generateMap({ preset: p.id, size: 'medium', seed }, grid);
          expect(generateMap({ preset: p.id, size: 'medium', seed }, grid)).toEqual(m);
          expect(m.width).toBe(31);
          for (const s of m.starts) expect(walkable(m, s)).toBe(true);
          expect(pathCost(m, grid, m.starts[0], m.starts[1])).toBeLessThan(Infinity);
        }
  });

  it('fights to a finish on every setting', () => {
    for (const p of MAP_PRESETS) {
      const map = generateMap({ preset: p.id, size: 'small', seed: 4 }, 'hex');
      const ctx = simulate(
        [
          { sheet: presetById('knight'), team: 0, controller: 'ai' },
          { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
        ],
        4,
        {},
        map,
      );
      expect(ctx.state.over).toBe(true);
      expect(ctx.state.round).toBeLessThan(60);
    }
  });
});

describe('line of sight and cover', () => {
  it('walls block sight, low obstacles next to the target give cover, bushes conceal', () => {
    const m = mapWith([
      [{ x: 8, y: 5 }, 'wall'],
      [{ x: 9, y: 3 }, 'low', 'crate'],
      [{ x: 7, y: 7 }, 'bush'],
    ]);
    expect(sight(m, 'hex', { x: 4, y: 5 }, { x: 12, y: 5 }).blocked).toBe(true);
    expect(sight(m, 'hex', { x: 4, y: 3 }, { x: 10, y: 3 })).toEqual({ blocked: false, cover: 'crate', concealed: false });
    // The crate right in front of the shooter doesn't count – you shoot over it.
    expect(sight(m, 'hex', { x: 10, y: 3 }, { x: 4, y: 3 }).cover).toBe(null);
    expect(sight(m, 'hex', { x: 3, y: 7 }, { x: 12, y: 7 }).concealed).toBe(true);
  });

  it("can't shoot through a house, and cover costs CL", () => {
    const m = mapWith([
      [{ x: 10, y: 5 }, 'house'],
      [{ x: 14, y: 3 }, 'low', 'barrel'],
    ]);
    const ctx = createCombat(duel(archer, 'barbarian', { x: 5, y: 5 }, { x: 15, y: 5 }), 1, {}, undefined, m);
    const [a, d] = ctx.state.combatants;
    expect(checkRanged(ctx, a, d)).toMatchObject({ ok: false, reason: 'no line of sight' });
    d.pos = { x: 15, y: 3 };
    a.pos = { x: 5, y: 3 };
    const check = checkRanged(ctx, a, d);
    expect(check).toMatchObject({ ok: true, cover: 'barrel' });
    expect(rangedCL(ctx, a, d, null).mods).toContainEqual({ label: 'behind a barrel', value: -3 });
  });

  it("a long weapon can't reach round a wall", () => {
    const m = mapWith([[{ x: 6, y: 5 }, 'wall']]);
    const ctx = createCombat(duel('knight', 'barbarian', { x: 5, y: 5 }, { x: 7, y: 5 }), 1, {}, undefined, m);
    ctx.state.round = 1;
    const [k] = ctx.state.combatants;
    expect(buildActionOptions(ctx, k).attacks).toHaveLength(0);
  });
});

describe('movement over terrain', () => {
  it('goes round walls, and bushes cost double', () => {
    const wall: [Pos, TerrainKind][] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => [{ x: 8, y }, 'wall']);
    const m = mapWith([...wall, [{ x: 5, y: 5 }, 'bush']]);
    expect(pathCost(m, 'hex', { x: 4, y: 5 }, { x: 5, y: 5 })).toBe(2);
    expect(pathCost(m, 'hex', { x: 7, y: 5 }, { x: 9, y: 5 })).toBeGreaterThan(2);
    const ctx = createCombat(duel('knight', 'barbarian', { x: 7, y: 5 }, { x: 18, y: 1 }), 1, {}, undefined, m);
    const k = ctx.state.combatants[0];
    const cells = reachableSquares(ctx, k, 3);
    expect(cells.some((p) => p.x === 9 && p.y === 5)).toBe(false); // the wall is in the way
    expect(cells.some((p) => p.x === 8)).toBe(false);
  });
});

describe('hiding', () => {
  it('needs bushes or being out of sight, and bushes help', () => {
    const m = mapWith([
      [{ x: 5, y: 5 }, 'bush'],
      [{ x: 10, y: 2 }, 'wall'],
    ]);
    const ctx = createCombat(duel('cutthroat', 'barbarian', { x: 3, y: 5 }, { x: 15, y: 5 }), 1, {}, undefined, m);
    const [cut] = ctx.state.combatants;
    expect(hideCheck(ctx, cut)).toBe(null); // in the open, in plain view
    cut.pos = { x: 5, y: 5 };
    const h = hideCheck(ctx, cut)!;
    expect(h.cl - h.fv).toBe(2); // the GM's terrain modifier for Gömma sig in bushes
    cut.pos = { x: 9, y: 2 }; // the wall between it and the barbarian
    ctx.state.combatants[1].pos = { x: 15, y: 2 };
    expect(hideCheck(ctx, cut)?.where).toBe(' out of sight');
  });

  it("hidden fighters can't be shot at", () => {
    const shotsAt = (hidden: boolean) => {
      const s = new CombatSession(
        [
          { sheet: presetById(archer), team: 0, controller: 'human', pos: { x: 3, y: 5 } },
          { sheet: presetById('barbarian'), team: 1, controller: 'ai', pos: { x: 14, y: 5 } },
        ],
        2,
        {},
        mapWith([]),
      );
      s.state.combatants[1].hidden = hidden;
      s.advance();
      const req = s.pending!;
      return req.kind === 'action' ? req.options.shots.length : -1;
    };
    expect(shotsAt(false)).toBe(1);
    expect(shotsAt(true)).toBe(0);
  });

  it('a find holds for the one who found it, until it loses sight', () => {
    const m = mapWith([]);
    const ctx = createCombat(
      [
        { sheet: presetById('knight'), team: 0, controller: 'ai', pos: { x: 3, y: 5 } },
        { sheet: presetById('mercenary'), team: 0, controller: 'ai', pos: { x: 3, y: 2 } },
        { sheet: presetById('cutthroat'), team: 1, controller: 'ai', pos: { x: 12, y: 5 }, hidden: true },
      ],
      1,
      {},
      undefined,
      m,
    );
    const [k, merc, cut] = ctx.state.combatants;
    expect(visibleEnemiesOf(ctx, k)).toHaveLength(0);
    cut.spottedBy = [k.id];
    expect(visibleEnemiesOf(ctx, k)).toEqual([cut]);
    expect(visibleEnemiesOf(ctx, merc)).toHaveLength(0); // the mercenary hasn't found it
    updateAwareness(ctx);
    expect(cut.spottedBy).toEqual([k.id]); // still in sight
    m.cells[5 * m.width + 8] = 'wall'; // a wall between them
    updateAwareness(ctx);
    expect(cut.spottedBy).toEqual([]);
  });

  it('searching costs an action and can find the hidden', () => {
    let found = 0;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const s = new CombatSession(
        [
          // Not the knight: its great helm leaves it no chance (Finna dolda ting −5).
          { sheet: presetById('mercenary'), team: 0, controller: 'human', pos: { x: 3, y: 5 } },
          { sheet: presetById('cutthroat'), team: 1, controller: 'ai', pos: { x: 12, y: 5 }, hidden: true },
        ],
        seed,
        {},
        mapWith([]),
      );
      s.advance();
      const req = s.pending!;
      if (req.kind !== 'action' || !req.options.search) continue;
      const k = s.state.combatants[0];
      const free = k.slots.filter((sl) => !sl.used && !sl.lost).length;
      s.answer({ kind: 'search' }, 'step');
      expect(k.slots.filter((sl) => !sl.used && !sl.lost).length).toBe(free - 1);
      if (s.state.combatants[1].spottedBy.includes(k.id)) found++;
    }
    expect(found).toBe(1);
  });

  it('hiding places: under a cart beats a crate, a crate beats a wall; anywhere in the dark', () => {
    const m = mapWith([
      [{ x: 6, y: 5 }, 'low', 'cart'],
      [{ x: 6, y: 2 }, 'low', 'crate'],
      [{ x: 5, y: 9 }, 'wall'], // beside it, not between it and the barbarian
    ]);
    const ctx = createCombat(duel('cutthroat', 'barbarian', { x: 5, y: 5 }, { x: 15, y: 5 }), 1, {}, undefined, m);
    const [cut] = ctx.state.combatants;
    expect(hidingSpot(ctx, cut)).toMatchObject({ where: 'under the cart', mod: 3 });
    cut.pos = { x: 5, y: 2 };
    expect(hidingSpot(ctx, cut)).toMatchObject({ where: 'behind the crate', mod: 1 });
    cut.pos = { x: 5, y: 8 };
    expect(hidingSpot(ctx, cut)).toMatchObject({ mod: 0 });
    cut.pos = { x: 3, y: 3 };
    expect(hidingSpot(ctx, cut)).toBe(null);
    m.light = 'dark';
    expect(hidingSpot(ctx, cut)).toMatchObject({ where: 'in the darkness' });
  });

  it('Finna dolda ting above 20 is always on: a free search every round', () => {
    let free = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const ctx = simulate(
        [
          { sheet: presetById('ilsabet'), team: 0, controller: 'ai' },
          { sheet: presetById('cutthroat'), team: 1, controller: 'ai', hidden: true },
        ],
        seed,
        {},
        mapWith([]),
      );
      const log = ctx.state.log.map((e) => e.text);
      if (log.some((t) => /Ilsabet.* keeps an eye out/.test(t))) free++;
      expect(log.some((t) => /Ilsabet.* searches the surroundings/.test(t))).toBe(false);
    }
    expect(free).toBeGreaterThan(0);
  });

  it('Smyga above 20 sneaks at full speed, with −5 on the roll when going faster than half speed', () => {
    const allowance = (sneak: number) => {
      const cut = presetById('cutthroat');
      const s = new CombatSession(
        [
          { sheet: { ...cut, skills: { ...cut.skills, sneak } }, team: 0, controller: 'human', pos: { x: 2, y: 5 }, hidden: true },
          { sheet: presetById('barbarian'), team: 1, controller: 'ai', pos: { x: 19, y: 1 } },
        ],
        2,
        {},
        mapWith([]),
      );
      s.advance();
      const req = s.pending!;
      return { s, move: req.kind === 'action' ? req.options.move : null };
    };
    const normal = allowance(14);
    const master = allowance(22);
    expect(master.move!.maxSquares).toBeGreaterThan(normal.move!.maxSquares);
    // Keep moving east as far as allowed this round: past half speed the master rolls again at −5.
    const { s } = master;
    for (let i = 0; i < 4 && s.state.round === 1; i++) {
      const req = s.pending;
      if (!req || req.kind !== 'action' || !req.options.move) break;
      const far = [...req.options.move.squares].sort((a, b) => b.x - a.x)[0];
      s.answer({ kind: 'move', to: far });
      while (s.pending && s.pending.kind !== 'action') s.autoAnswer();
    }
    const log = s.state.log.map((e) => e.text);
    expect(log.some((t) => /sneaks at full speed: Smyga 22 −5 = CL 17/.test(t))).toBe(true);
  });
});

