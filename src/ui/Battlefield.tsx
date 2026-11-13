import { spellDef } from '../data/spells';
import { heldItem } from '../engine/character';
import { metres, SQUARE_M } from '../engine/state';
import type { CombatState, Pos } from '../engine/types';

const CELL = 34;

export function Battlefield({
  state,
  highlight,
  highlightKind,
  onSquare,
  activeId,
  anySquare,
}: {
  state: CombatState;
  highlight: Pos[] | null;
  highlightKind: 'move' | 'run' | null;
  onSquare: (p: Pos) => void;
  activeId: string | null;
  /** Placement: every square is clickable (setup screen). */
  anySquare?: boolean;
}) {
  const w = state.width * CELL;
  const h = state.height * CELL;
  const hl = new Set((highlight ?? []).map((p) => `${p.x},${p.y}`));
  const actor = state.combatants.find((c) => c.id === activeId);
  // The range line runs from the fighter whose turn it is (or the first one standing) to the nearest enemy.
  const standing = state.combatants.filter((c) => c.status === 'active');
  const from = actor && actor.status === 'active' ? actor : standing[0];
  const foe = from
    ? standing.filter((c) => c.team !== from.team).sort((x, y) => metres(from.pos, x.pos) - metres(from.pos, y.pos))[0]
    : undefined;
  const dist = from && foe ? metres(from.pos, foe.pos) : 0;

  return (
    <div className="battlefield">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Battlefield">
        <defs>
          {/* Battle-map ground: grass with patches of earth, a little noise and a vignette. */}
          <filter id="ground-noise" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed={state.seed % 97} result="t" />
            <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.20  0 0 0 0 0.16  0 0 0 0 0.05  0 0 0 0.55 0" />
          </filter>
          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="g" />
            <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.02  0 0 0 0.18 0" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6f7f3c" />
            <stop offset="50%" stopColor="#7d8a45" />
            <stop offset="100%" stopColor="#64733a" />
          </linearGradient>
          {[0, 1].map((t) => (
            <radialGradient key={t} id={`face-${t}`} cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor={t === 0 ? '#7da2e6' : '#ec7d6c'} />
              <stop offset="70%" stopColor={t === 0 ? '#2c4f8f' : '#9c2b23'} />
              <stop offset="100%" stopColor={t === 0 ? '#16294d' : '#4f130f'} />
            </radialGradient>
          ))}
          <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9b25a" />
            <stop offset="55%" stopColor="#8a6420" />
            <stop offset="100%" stopColor="#4a3410" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={w} height={h} fill="url(#ground)" />
        <rect x={0} y={0} width={w} height={h} filter="url(#ground-noise)" />
        <rect x={0} y={0} width={w} height={h} filter="url(#grain)" />
        <rect x={0} y={0} width={w} height={h} fill="url(#vignette)" />
        {Array.from({ length: state.width * state.height }, (_, i) => {
          const x = i % state.width;
          const y = Math.floor(i / state.width);
          const on = hl.has(`${x},${y}`);
          return (
            <rect
              key={i}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              className={on ? `cell hl ${highlightKind}` : anySquare ? 'cell pick' : 'cell'}
              onClick={on || anySquare ? () => onSquare({ x, y }) : undefined}
            >
              {on && actor && <title>{`Move here (${(Math.max(Math.abs(x - actor.pos.x), Math.abs(y - actor.pos.y)) * SQUARE_M).toFixed(1)} m)`}</title>}
            </rect>
          );
        })}
        {from && foe && (
          <line x1={(from.pos.x + 0.5) * CELL} y1={(from.pos.y + 0.5) * CELL} x2={(foe.pos.x + 0.5) * CELL} y2={(foe.pos.y + 0.5) * CELL} className="range-line" />
        )}
        {state.combatants.map((c) => {
          const cx = (c.pos.x + 0.5) * CELL;
          const cy = (c.pos.y + 0.5) * CELL;
          const kpFrac = Math.max(0, c.kpTotal.cur / c.kpTotal.max);
          const spFrac = Math.max(0, c.spTotal.cur / c.spTotal.max);
          const main = heldItem(c, 'main');
          return (
            <g key={c.id} className={`token team-${c.team} ${c.status === 'out' ? 'out' : ''} ${c.id === activeId ? 'active' : ''} ${c.hidden && c.status !== 'out' ? 'hidden-token' : ''}`}>
              <ellipse className="base-shadow" cx={cx + 2} cy={cy + 4} rx={CELL * 0.44} ry={CELL * 0.36} />
              <circle className="rim" cx={cx} cy={cy} r={CELL * 0.44} fill="url(#rim)" />
              {c.status === 'active' && <FacingMark cx={cx} cy={cy} facing={c.facing} />}
              <circle className="face" cx={cx} cy={cy} r={CELL * 0.34} fill={`url(#face-${c.team === 0 ? 0 : 1})`} />
              <text className="initials" x={cx} y={cy + 4} textAnchor="middle">
                {initials(c.sheet.name)}
              </text>
              <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62} width={CELL * 0.9} height={3} className="bar-bg" />
              <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62} width={CELL * 0.9 * kpFrac} height={3} className="bar-kp" />
              <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62 + 4} width={CELL * 0.9} height={3} className="bar-bg" />
              <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62 + 4} width={CELL * 0.9 * spFrac} height={3} className="bar-sp" />
              {c.sheet.magic && (
                <>
                  <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62 + 8} width={CELL * 0.9} height={3} className="bar-bg" />
                  <rect x={cx - CELL * 0.45} y={cy - CELL * 0.62 + 8} width={CELL * 0.9 * Math.max(0, Math.min(1, c.psy / c.psyMax))} height={3} className="bar-psy" />
                </>
              )}
              {c.casting && c.status === 'active' && (
                <text x={cx + CELL * 0.38} y={cy - CELL * 0.22} className="casting-glyph">
                  ✦
                </text>
              )}
              <title>{`${c.sheet.name}${main ? ` – ${main.def.name}` : ''}${c.casting ? ` – casting ${spellDef(c.casting.spell).sv} E${c.casting.e}` : ''}${c.status === 'out' ? ` (${c.outKind})` : ''}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="field-caption muted">
        1 square = 1.5 m{from && foe ? ` · ${from.sheet.name} – ${foe.sheet.name} ${dist} m` : ''}{highlight ? ` · click a highlighted square to ${highlightKind === 'run' ? 'run' : 'move'}` : ''}
      </div>
    </div>
  );
}

/** A brass notch on the rim pointing the way the fighter faces. */
function FacingMark({ cx, cy, facing }: { cx: number; cy: number; facing: Pos }) {
  const a = Math.atan2(facing.y, facing.x);
  const at = (r: number, da: number) => `${cx + Math.cos(a + da) * r},${cy + Math.sin(a + da) * r}`;
  return <polygon className="facing-mark" points={[at(CELL * 0.56, 0), at(CELL * 0.4, 0.42), at(CELL * 0.4, -0.42)].join(' ')} />;
}

function initials(name: string): string {
  // "Northern Barbarian 2" → "N2": a numbered fighter keeps its number so twins can be told apart.
  const words = name.split(/\s+/);
  const num = /^\d+$/.test(words[words.length - 1]) ? words.pop()! : '';
  const letters = words.map((w) => w[0]).join('').toUpperCase();
  return num ? letters[0] + num : letters.slice(0, 2);
}
