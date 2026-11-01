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
}: {
  state: CombatState;
  highlight: Pos[] | null;
  highlightKind: 'move' | 'run' | null;
  onSquare: (p: Pos) => void;
  activeId: string | null;
}) {
  const w = state.width * CELL;
  const h = state.height * CELL;
  const hl = new Set((highlight ?? []).map((p) => `${p.x},${p.y}`));
  const [a, b] = state.combatants;
  const dist = a && b ? metres(a.pos, b.pos) : 0;
  const actor = state.combatants.find((c) => c.id === activeId);

  return (
    <div className="battlefield">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Battlefield">
        <rect x={0} y={0} width={w} height={h} className="field" />
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
              className={on ? `cell hl ${highlightKind}` : 'cell'}
              onClick={on ? () => onSquare({ x, y }) : undefined}
            >
              {on && actor && <title>{`Move here (${(Math.max(Math.abs(x - actor.pos.x), Math.abs(y - actor.pos.y)) * SQUARE_M).toFixed(1)} m)`}</title>}
            </rect>
          );
        })}
        {a && b && a.status === 'active' && b.status === 'active' && (
          <line x1={(a.pos.x + 0.5) * CELL} y1={(a.pos.y + 0.5) * CELL} x2={(b.pos.x + 0.5) * CELL} y2={(b.pos.y + 0.5) * CELL} className="range-line" />
        )}
        {state.combatants.map((c) => {
          const cx = (c.pos.x + 0.5) * CELL;
          const cy = (c.pos.y + 0.5) * CELL;
          const kpFrac = Math.max(0, c.kpTotal.cur / c.kpTotal.max);
          const spFrac = Math.max(0, c.spTotal.cur / c.spTotal.max);
          const main = heldItem(c, 'main');
          return (
            <g key={c.id} className={`token team-${c.team} ${c.status === 'out' ? 'out' : ''} ${c.id === activeId ? 'active' : ''}`}>
              <circle cx={cx} cy={cy} r={CELL * 0.4} />
              <text x={cx} y={cy + 4} textAnchor="middle">
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
        1 square = 1.5 m · distance {dist} m{highlight ? ` · click a highlighted square to ${highlightKind === 'run' ? 'run' : 'move'}` : ''}
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
