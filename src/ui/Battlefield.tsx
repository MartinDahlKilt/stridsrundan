import { spellDef } from '../data/spells';
import { heldItem } from '../engine/character';
import { cellWord } from '../engine/grid';
import { hiddenFrom, metres, SQUARE_M } from '../engine/state';
import { decoAt, LIGHTS, MAP_PRESETS, movementCosts, sight, TERRAIN, terrainAt, walkable, type BattleMap } from '../engine/terrain';
import type { CombatState, Pos } from '../engine/types';
import { boardSize, CELL, cellPoints, pixel } from './boardGeometry';
import { BushLayer, GroundDefs, groundFill, TerrainLayer } from './Terrain';

export function Battlefield({
  state,
  highlight,
  highlightKind,
  onSquare,
  activeId,
  anySquare,
  viewerId = null,
  hiddenEnemies = 'ghost',
}: {
  state: CombatState;
  highlight: Pos[] | null;
  highlightKind: 'move' | 'run' | null;
  onSquare: (p: Pos) => void;
  activeId: string | null;
  /** Placement: every walkable cell is clickable (setup screen). */
  anySquare?: boolean;
  /**
   * Whose eyes the board is seen through: enemies hidden from this fighter are greyed out or left off the map.
   * null: everything is shown.
   */
  viewerId?: string | null;
  hiddenEnemies?: 'ghost' | 'hide';
}) {
  const grid = state.grid;
  const map = state.map;
  const { w, h } = boardSize(state.width, state.height, grid);
  const hl = new Set((highlight ?? []).map((p) => `${p.x},${p.y}`));
  const actor = state.combatants.find((c) => c.id === activeId);
  const viewer = state.combatants.find((c) => c.id === viewerId) ?? null;
  /** Is `c` an enemy the viewer doesn't know is there? */
  const unseen = (c: (typeof state.combatants)[number]) => !!viewer && c.team !== viewer.team && c.status === 'active' && hiddenFrom(c, viewer);
  const standing = state.combatants.filter((c) => c.status === 'active' && !unseen(c));
  // The range line runs from the fighter whose turn it is (or the first one standing) to the nearest enemy.
  const from = actor && actor.status === 'active' ? actor : standing[0];
  const foe = from
    ? standing.filter((c) => c.team !== from.team).sort((x, y) => metres(from.pos, x.pos, grid) - metres(from.pos, y.pos, grid))[0]
    : undefined;
  const dist = from && foe ? metres(from.pos, foe.pos, grid) : 0;
  // Aiming: when a fighter is deciding, show its line of sight to every enemy it knows about.
  const lines =
    actor && actor.status === 'active'
      ? standing
          .filter((e) => e.team !== actor.team && !hiddenFrom(e, actor))
          .map((e) => {
            const v = sight(map, grid, actor.pos, e.pos);
            return { e, kind: v.blocked ? 'blocked' : v.cover || v.concealed ? 'cover' : 'clear' };
          })
      : [];
  // Movement cost to the highlighted cells (round walls, bushes cost double).
  const walk =
    highlight && actor
      ? movementCosts(map, grid, actor.pos, 1000, (p) => standing.some((e) => e.team !== actor.team && e.pos.x === p.x && e.pos.y === p.y))
      : null;
  const presetName = MAP_PRESETS.find((p) => p.id === map.preset)?.name;

  return (
    <div className="battlefield">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Battlefield">
        <defs>
          <GroundDefs />
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
        <rect x={0} y={0} width={w} height={h} fill={groundFill(map.preset)} />
        <rect x={0} y={0} width={w} height={h} filter="url(#ground-noise)" opacity={map.preset === 'inside' || map.preset === 'town' ? 0.5 : 1} />
        <rect x={0} y={0} width={w} height={h} filter="url(#grain)" />
        <TerrainLayer map={map} grid={grid} />
        <rect x={0} y={0} width={w} height={h} fill="url(#vignette)" pointerEvents="none" />
        {Array.from({ length: state.width * state.height }, (_, i) => {
          const x = i % state.width;
          const y = Math.floor(i / state.width);
          const p = { x, y };
          const on = hl.has(`${x},${y}`);
          const pick = anySquare && walkable(map, p);
          const cost = on && walk ? walk.cost(p) : null;
          return (
            <polygon
              key={i}
              points={cellPoints(p, grid)}
              className={on ? `cell hl ${highlightKind}` : pick ? 'cell pick' : 'cell'}
              onClick={on || pick ? () => onSquare(p) : undefined}
            >
              {cost !== null ? (
                <title>{`Move here (${cost} ${cellWord(grid, cost)} of movement, ${(cost * SQUARE_M).toFixed(1)} m)`}</title>
              ) : (
                terrainAt(map, p) !== 'open' && <title>{terrainLabel(map, p)}</title>
              )}
            </polygon>
          );
        })}
        {lines.length > 0
          ? lines.map(({ e, kind }) => {
              const a = pixel(actor!.pos, grid);
              const b = pixel(e.pos, grid);
              return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`sight-line ${kind}`} />;
            })
          : from &&
            foe && <line x1={pixel(from.pos, grid).x} y1={pixel(from.pos, grid).y} x2={pixel(foe.pos, grid).x} y2={pixel(foe.pos, grid).y} className="range-line" />}
        {state.combatants.map((c) => {
          const { x: cx, y: cy } = pixel(c.pos, grid);
          const ghost = unseen(c);
          if (ghost && hiddenEnemies === 'hide') return null;
          if (ghost)
            return (
              <g key={c.id} className={`token team-${c.team} unseen`}>
                <circle className="rim" cx={cx} cy={cy} r={CELL * 0.44} />
                <text className="initials" x={cx} y={cy + 4} textAnchor="middle">
                  ?
                </text>
                <title>{`${c.sheet.name} – hidden from ${viewer!.sheet.name}: it can't be targeted until found (Search).`}</title>
              </g>
            );
          // Hidden, but this viewer has found it (or it is one of the viewer's own).
          const foundByViewer = !!viewer && c.hidden && c.team !== viewer.team && c.spottedBy.includes(viewer.id);
          const finders = c.spottedBy.map((id) => state.combatants.find((x) => x.id === id)?.sheet.name).filter(Boolean);
          const kpFrac = Math.max(0, c.kpTotal.cur / c.kpTotal.max);
          const spFrac = Math.max(0, c.spTotal.cur / c.spTotal.max);
          const main = heldItem(c, 'main');
          return (
            <g key={c.id} className={`token team-${c.team} ${c.status === 'out' ? 'out' : ''} ${c.id === activeId ? 'active' : ''} ${c.hidden && c.status !== 'out' && !foundByViewer ? 'hidden-token' : ''}`}>
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
              {foundByViewer && (
                <g className="found-glyph" transform={`translate(${cx - CELL * 0.42} ${cy - CELL * 0.3})`}>
                  <ellipse rx={5} ry={3} />
                  <circle r={1.6} />
                </g>
              )}
              <title>{`${c.sheet.name}${main ? ` – ${main.def.name}` : ''}${c.casting ? ` – casting ${spellDef(c.casting.spell).sv} E${c.casting.e}` : ''}${c.status === 'out' ? ` (${c.outKind})` : ''}${
                c.hidden && c.status === 'active' ? (foundByViewer ? ' – hidden, but you have found it' : ` – hidden${finders.length ? ` (found by ${finders.join(', ')})` : ''}`) : ''
              }`}</title>
            </g>
          );
        })}
        <BushLayer map={state.map} grid={grid} />
        {map.light !== 'day' && <rect x={0} y={0} width={w} height={h} fill="#0a0d1a" opacity={map.light === 'dark' ? 0.5 : 0.22} pointerEvents="none" />}
      </svg>
      <div className="field-caption muted">
        {presetName ? `${presetName} · ` : ''}
        {map.light !== 'day' ? `${LIGHTS[map.light].name} (${LIGHTS[map.light].attack} to attacks) · ` : ''}1 {cellWord(grid)} = 1.5 m{from && foe ? ` · ${from.sheet.name} – ${foe.sheet.name} ${dist} m` : ''}
        {highlight ? ` · click a highlighted ${cellWord(grid)} to ${highlightKind === 'run' ? 'run' : 'move'}` : ''}
        {lines.length > 0 && (
          <span className="sight-legend">
            {' '}
            · line of sight: <span className="clear">clear</span> <span className="cover">cover</span> <span className="blocked">blocked</span>
          </span>
        )}
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

/** Hover text for a terrain cell, with what it does in the fight. */
function terrainLabel(map: BattleMap, p: Pos): string {
  const kind = terrainAt(map, p);
  const t = TERRAIN[kind];
  const name = decoAt(map, p) || t.name;
  const what = t.conceal
    ? 'costs 2 to enter; +2 to Gömma sig (and −3 to shoot into or through, with terrain cover)'
    : t.cover
      ? 'blocks movement; something to duck behind (and, with terrain cover, covers the legs of whoever is right behind it: −3 to shoot)'
      : t.blocksSight
        ? 'blocks movement and line of sight; something to duck behind'
        : t.blocksMove
          ? 'blocks movement'
          : t.cost > 1
            ? 'costs 2 to enter'
            : '';
  return `${name[0].toUpperCase()}${name.slice(1)}${what ? ` – ${what}` : ''}`;
}
