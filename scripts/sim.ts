/**
 * Headless AI-vs-AI runner.
 *   npm run sim -- knight barbarian            one fight with the full log
 *   npm run sim -- knight barbarian --n 1000   win rates and fight length
 *   npm run sim -- --all --n 200               every preset against every other
 *   add --eastern to enable the optional eastern-warriors rules
 */
import { PRESETS, presetById } from '../src/data/presets';
import { simulate } from '../src/engine/session';

const args = process.argv.slice(2);
const flag = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const n = flag('n', 1);
const seed0 = flag('seed', 1);
const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

function run(aId: string, bId: string, count: number, printLog: boolean) {
  const a = presetById(aId);
  const b = presetById(bId);
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let rounds = 0;
  const causes = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const ctx = simulate(
      [
        { sheet: a, team: 0, controller: 'ai' },
        { sheet: b, team: 1, controller: 'ai' },
      ],
      seed0 + i,
      { easternWarriors: args.includes('--eastern') },
    );
    const s = ctx.state;
    if (printLog) {
      for (const e of s.log) {
        const indent = e.depth === 0 ? '\n' : e.depth === 1 ? '  ' : '      ';
        console.log(indent + e.text);
      }
    }
    rounds += s.round;
    if (s.winner === 0) winsA++;
    else if (s.winner === 1) winsB++;
    else draws++;
    for (const c of s.combatants) if (c.status === 'out') {
      const k = c.outKind!;
      causes.set(k, (causes.get(k) ?? 0) + 1);
    }
  }
  const pct = (x: number) => `${((100 * x) / count).toFixed(0)}%`;
  console.log(
    `${a.name.padEnd(20)} vs ${b.name.padEnd(20)}  ${pct(winsA).padStart(4)} / ${pct(winsB).padStart(4)}  draws ${pct(draws).padStart(3)}  avg ${(rounds / count).toFixed(1)} rounds  [${[...causes].map(([k, v]) => `${k} ${v}`).join(', ')}]`,
  );
}

if (args.includes('--all')) {
  for (let i = 0; i < PRESETS.length; i++) for (let j = i + 1; j < PRESETS.length; j++) run(PRESETS[i].id, PRESETS[j].id, n, false);
} else {
  const [a = 'knight', b = 'barbarian'] = names;
  run(a, b, n, n === 1);
}
