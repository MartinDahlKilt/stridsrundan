/**
 * Dice. Swedish notation is used throughout the rules: "2T6+2" = two six-sided dice plus 2.
 * All randomness goes through a `Dice` instance so fights are reproducible from a seed and
 * tests can script exact rolls.
 */

export interface Dice {
  /** Roll one die with the given number of sides (1..sides). */
  d(sides: number): number;
}

/** mulberry32 – small, fast, seedable PRNG. */
export function seededDice(seed: number): Dice {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { d: (sides) => 1 + Math.floor(next() * sides) };
}

/**
 * Dice that return pre-scripted values (for tests). Throws if the script runs out or a value
 * doesn't fit the die, so tests notice when the engine rolls something unexpected.
 */
export function scriptedDice(values: number[], fallback?: Dice): Dice & { remaining(): number } {
  const queue = [...values];
  return {
    d(sides) {
      if (queue.length === 0) {
        if (fallback) return fallback.d(sides);
        throw new Error(`scriptedDice: script exhausted (wanted 1T${sides})`);
      }
      const v = queue.shift()!;
      if (v < 1 || v > sides) throw new Error(`scriptedDice: ${v} is not a valid 1T${sides} result`);
      return v;
    },
    remaining: () => queue.length,
  };
}

export interface DiceExpr {
  count: number;
  sides: number;
  mod: number;
}

export const NO_DICE: DiceExpr = { count: 0, sides: 0, mod: 0 };

/** Parse "2T6+2", "1T4", "3T6−1", "+1", "–" (nothing). Accepts T or D. */
export function parseDice(text: string): DiceExpr {
  const s = text.replace(/\s+/g, '').replace(/[−–]/g, '-').toUpperCase();
  if (s === '' || s === '-') return { ...NO_DICE };
  const m = /^(\d*)[TD](\d+)([+-]\d+)?$/.exec(s);
  if (m) {
    return { count: m[1] === '' ? 1 : Number(m[1]), sides: Number(m[2]), mod: m[3] ? Number(m[3]) : 0 };
  }
  const n = /^([+-]?\d+)$/.exec(s);
  if (n) return { count: 0, sides: 0, mod: Number(n[1]) };
  throw new Error(`Cannot parse dice expression "${text}"`);
}

export function formatDice(e: DiceExpr): string {
  if (e.count === 0) return e.mod === 0 ? '0' : String(e.mod);
  const mod = e.mod === 0 ? '' : e.mod > 0 ? `+${e.mod}` : `−${-e.mod}`;
  return `${e.count}T${e.sides}${mod}`;
}

export interface DiceResult {
  expr: DiceExpr;
  rolls: number[];
  total: number;
}

export function rollDice(dice: Dice, e: DiceExpr): DiceResult {
  const rolls: number[] = [];
  for (let i = 0; i < e.count; i++) rolls.push(dice.d(e.sides));
  return { expr: e, rolls, total: rolls.reduce((a, b) => a + b, 0) + e.mod };
}

export function maxDice(e: DiceExpr): number {
  return e.count * e.sides + e.mod;
}

export function avgDice(e: DiceExpr): number {
  return (e.count * (e.sides + 1)) / 2 + e.mod;
}

/** "1T8+1 [6]+1 = 7" style text for the combat log. */
export function describeRoll(r: DiceResult): string {
  if (r.expr.count === 0) return `${r.total}`;
  const mod = r.expr.mod === 0 ? '' : r.expr.mod > 0 ? `+${r.expr.mod}` : `−${-r.expr.mod}`;
  return `${formatDice(r.expr)} [${r.rolls.join(',')}]${mod} = ${r.total}`;
}
