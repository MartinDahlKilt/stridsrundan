import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { attackDirection, faceTowards } from '../src/engine/facing';
import { cellDistance, cellMetres, neighbours } from '../src/engine/grid';
import { DEFAULT_RULES } from '../src/engine/rules';
import { CombatSession, simulate } from '../src/engine/session';
import { createCombat } from '../src/engine/state';
import type { Pos } from '../src/engine/types';

const setup = (pa: Pos, pb: Pos) => [
  { sheet: presetById('knight'), team: 0, controller: 'ai' as const, pos: pa },
  { sheet: presetById('barbarian'), team: 1, controller: 'ai' as const, pos: pb },
];

describe('hex grid', () => {
  it('is the default', () => {
    expect(DEFAULT_RULES.grid).toBe('hex');
    expect(createCombat(setup({ x: 5, y: 5 }, { x: 9, y: 5 }), 1).state.grid).toBe('hex');
  });

  it('has six neighbours, each one step and 1.5 m away', () => {
    for (const p of [{ x: 5, y: 4 }, { x: 5, y: 5 }]) {
      const n = neighbours(p, 'hex');
      expect(n).toHaveLength(6);
      for (const q of n) {
        expect(cellDistance(p, q, 'hex')).toBe(1);
        expect(cellMetres(p, q, 'hex')).toBe(1.5);
      }
    }
  });

  it('makes no direction faster than another', () => {
    // On squares a diagonal step covers 2.1 m; on hexes every step is 1.5 m, so 4 steps never exceed 6 m.
    expect(cellMetres({ x: 0, y: 0 }, { x: 4, y: 4 }, 'square')).toBeGreaterThan(8);
    expect(cellDistance({ x: 0, y: 0 }, { x: 4, y: 4 }, 'square')).toBe(4);
    const far = cellMetres({ x: 5, y: 5 }, { x: 7, y: 1 }, 'hex');
    expect(cellDistance({ x: 5, y: 5 }, { x: 7, y: 1 }, 'hex')).toBe(4);
    expect(far).toBeLessThanOrEqual(6);
    expect(cellDistance({ x: 3, y: 5 }, { x: 16, y: 5 }, 'hex')).toBe(13);
  });

  it('offers the cells within the movement allowance', () => {
    const s = new CombatSession(
      setup({ x: 10, y: 5 }, { x: 20, y: 0 }).map((f, i) => ({ ...f, controller: i === 0 ? ('human' as const) : ('ai' as const) })),
      1,
    );
    s.advance();
    const req = s.pending!;
    expect(req.kind).toBe('action');
    const k = s.state.combatants[0];
    const o = (req as Extract<typeof req, { kind: 'action' }>).options;
    const n = o.move!.maxSquares;
    expect(o.move!.squares.every((p) => cellDistance(k.pos, p, 'hex') <= n)).toBe(true);
    // A hexagon of radius n has 3n(n+1) cells around the centre.
    expect(n).toBeLessThanOrEqual(5); // so the hexagon fits on the board
    expect(o.move!.squares).toHaveLength(3 * n * (n + 1));
  });

  it('splits the hexes around a fighter into three in front, two at the side and one behind', () => {
    const ctx = createCombat(setup({ x: 5, y: 5 }, { x: 6, y: 5 }), 1);
    const [k] = ctx.state.combatants;
    expect(k.facing).toEqual({ x: 1, y: 0 });
    const dirs = neighbours(k.pos, 'hex').map((p) => attackDirection(k, p, 'hex'));
    expect(dirs.filter((d) => d === 'front')).toHaveLength(3);
    expect(dirs.filter((d) => d === 'side')).toHaveLength(2);
    expect(dirs.filter((d) => d === 'rear')).toHaveLength(1);
    expect(attackDirection(k, { x: 4, y: 5 }, 'hex')).toBe('rear');
    // Facing snaps to one of the six hex sides.
    faceTowards(k, { x: 6, y: 1 }, 'hex');
    expect(Math.hypot(k.facing.x, k.facing.y)).toBeCloseTo(1);
    expect((Math.atan2(k.facing.y, k.facing.x) * 180) / Math.PI).toBeCloseTo(-60);
  });

  it('fights to the end on either grid', () => {
    for (const grid of ['hex', 'square'] as const) {
      const ctx = simulate(setup({ x: 3, y: 5 }, { x: 16, y: 5 }), 7, { grid });
      expect(ctx.state.over).toBe(true);
    }
  });
});
