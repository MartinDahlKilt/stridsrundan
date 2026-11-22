import { memo, type ReactElement } from 'react';
import { neighbours, type Grid } from '../engine/grid';
import { decoAt, terrainAt, type BattleMap, type MapPreset, type TerrainKind } from '../engine/terrain';
import type { Pos } from '../engine/types';
import { CELL, cellPoints, HEX_R, pixel, sharedEdge } from './boardGeometry';

/**
 * Top-down drawing of the battlefield terrain: the floor for the setting, then walls, houses, water and
 * furniture. Bushes are drawn separately on top of the tokens (`BushLayer`), so whoever hides in one is
 * half covered by leaves.
 */

/** Small deterministic noise per cell, so every tree and rock looks a little different. */
function hash(x: number, y: number, k = 0): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function GroundDefs() {
  return (
    <>
      <linearGradient id="ground-field" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6f7f3c" />
        <stop offset="50%" stopColor="#7d8a45" />
        <stop offset="100%" stopColor="#64733a" />
      </linearGradient>
      <linearGradient id="ground-forest" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4d5b2a" />
        <stop offset="50%" stopColor="#5a6630" />
        <stop offset="100%" stopColor="#47522a" />
      </linearGradient>
      <pattern id="ground-town" width="18" height="16" patternUnits="userSpaceOnUse">
        <rect width="18" height="16" fill="#8b8172" />
        <rect x="1" y="1" width="7.5" height="6" rx="2" fill="#9a9080" />
        <rect x="9.5" y="1" width="7.5" height="6" rx="2" fill="#948a7a" />
        <rect x="-3.5" y="9" width="7.5" height="6" rx="2" fill="#968c7c" />
        <rect x="5" y="9" width="7.5" height="6" rx="2" fill="#a09684" />
        <rect x="13.5" y="9" width="7.5" height="6" rx="2" fill="#928878" />
      </pattern>
      <pattern id="ground-inside" width="60" height="12" patternUnits="userSpaceOnUse">
        <rect width="60" height="12" fill="#7a5634" />
        <rect y="0" width="60" height="5.6" fill="#83603b" />
        <line x1="0" y1="5.8" x2="60" y2="5.8" stroke="#5a3d22" strokeWidth="0.8" />
        <line x1="0" y1="11.8" x2="60" y2="11.8" stroke="#5a3d22" strokeWidth="0.8" />
        <line x1="22" y1="0" x2="22" y2="5.8" stroke="#5a3d22" strokeWidth="0.8" />
        <line x1="48" y1="6" x2="48" y2="12" stroke="#5a3d22" strokeWidth="0.8" />
      </pattern>
      <pattern id="ground-dungeon" width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill="#5d5850" />
        <rect x="1" y="1" width="12" height="12" fill="#67625a" />
        <rect x="15" y="1" width="12" height="12" fill="#625d55" />
        <rect x="1" y="15" width="12" height="12" fill="#605b53" />
        <rect x="15" y="15" width="12" height="12" fill="#6a655c" />
      </pattern>
      <radialGradient id="ground-cave" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stopColor="#5b4d3e" />
        <stop offset="100%" stopColor="#40362c" />
      </radialGradient>
      <radialGradient id="canopy" cx="38%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#5f8a3a" />
        <stop offset="60%" stopColor="#3a6324" />
        <stop offset="100%" stopColor="#24421a" />
      </radialGradient>
      <radialGradient id="canopy-dark" cx="38%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#4f7a32" />
        <stop offset="60%" stopColor="#2d5420" />
        <stop offset="100%" stopColor="#1b3514" />
      </radialGradient>
      <radialGradient id="leaf" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#7aa24a" />
        <stop offset="100%" stopColor="#3e6b28" />
      </radialGradient>
      <radialGradient id="stone" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#b3aca0" />
        <stop offset="70%" stopColor="#7a746a" />
        <stop offset="100%" stopColor="#4f4a43" />
      </radialGradient>
      <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#2f6584" />
        <stop offset="100%" stopColor="#24506b" />
      </linearGradient>
    </>
  );
}

export function groundFill(preset: MapPreset | null): string {
  return `url(#ground-${preset ?? 'field'})`;
}

/** Fill and outline for the solid kinds, by setting. */
function solidStyle(kind: TerrainKind, preset: MapPreset | null): { fill: string; edge: string } {
  if (kind === 'wall') {
    if (preset === 'cave') return { fill: '#2b241e', edge: '#17120e' };
    if (preset === 'dungeon') return { fill: '#3a342d', edge: '#1d1915' };
    if (preset === 'inside') return { fill: '#4b3c2c', edge: '#22190f' };
    return { fill: '#6d665c', edge: '#36322c' };
  }
  if (kind === 'water') return { fill: 'url(#water)', edge: '#1a3a4f' };
  if (kind === 'shallow') return { fill: 'rgba(110, 160, 180, 0.65)', edge: 'rgba(40, 80, 100, 0.0)' };
  return { fill: '#888', edge: '#333' };
}

const ROOFS = ['#8e3b2a', '#7a4a2a', '#6b5a4a', '#94532f', '#5e3a2e'];

/** Connected groups of cells of one kind (houses get one roof each). */
function groups(m: BattleMap, grid: Grid, kind: TerrainKind): Pos[][] {
  const seen = new Set<number>();
  const out: Pos[][] = [];
  for (let i = 0; i < m.cells.length; i++) {
    if (m.cells[i] !== kind || seen.has(i)) continue;
    const g: Pos[] = [];
    const stack = [{ x: i % m.width, y: Math.floor(i / m.width) }];
    seen.add(i);
    while (stack.length) {
      const p = stack.pop()!;
      g.push(p);
      for (const n of edgeNeighbours(p, grid)) {
        const k = n.y * m.width + n.x;
        if (n.x < 0 || n.y < 0 || n.x >= m.width || n.y >= m.height || seen.has(k) || m.cells[k] !== kind) continue;
        seen.add(k);
        stack.push(n);
      }
    }
    out.push(g);
  }
  return out;
}

/** Neighbours sharing a whole edge (on squares: not the diagonals). */
function edgeNeighbours(p: Pos, grid: Grid): Pos[] {
  return neighbours(p, grid).filter((n) => grid === 'hex' || n.x === p.x || n.y === p.y);
}

/** Outline the edges of a region where it meets something else. */
function outline(m: BattleMap, grid: Grid, cells: Pos[], same: (k: TerrainKind) => boolean, stroke: string, width: number, key: string): ReactElement {
  const lines: ReactElement[] = [];
  for (const p of cells) {
    for (const n of edgeNeighbours(p, grid)) {
      const inside = n.x >= 0 && n.y >= 0 && n.x < m.width && n.y < m.height;
      if (!inside || same(terrainAt(m, n))) continue;
      const e = sharedEdge(p, n, grid);
      lines.push(<line key={`${p.x},${p.y}-${n.x},${n.y}`} {...e} />);
    }
  }
  return (
    <g key={key} stroke={stroke} strokeWidth={width} strokeLinecap="round">
      {lines}
    </g>
  );
}

export const TerrainLayer = memo(function TerrainLayer({ map, grid }: { map: BattleMap; grid: Grid }) {
  const out: ReactElement[] = [];
  const all: Pos[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) all.push({ x, y });
  const of = (k: TerrainKind) => all.filter((p) => terrainAt(map, p) === k);

  // Water first (it sits lowest), then the shallows round it.
  for (const kind of ['shallow', 'water'] as const) {
    const cells = of(kind).filter((p) => decoAt(map, p) !== 'well');
    if (!cells.length) continue;
    const st = solidStyle(kind, map.preset);
    out.push(
      <g key={`fill-${kind}`} fill={st.fill}>
        {cells.map((p) => (
          <polygon key={`${p.x},${p.y}`} points={cellPoints(p, grid, 1.04)} />
        ))}
      </g>,
    );
    if (kind === 'water') {
      out.push(outline(map, grid, cells, (k) => k === 'water', st.edge, 1.6, 'edge-water'));
      out.push(
        <g key="ripples" stroke="rgba(200,230,240,0.35)" strokeWidth="0.8" fill="none">
          {cells.map((p) => {
            const c = pixel(p, grid);
            const dx = (hash(p.x, p.y) - 0.5) * 10;
            return <path key={`${p.x},${p.y}`} d={`M${c.x - 6 + dx},${c.y + 2} q3,-3 6,0 t6,0`} />;
          })}
        </g>,
      );
    }
  }

  // Rubble: scattered stones.
  out.push(
    <g key="rubble" fill="url(#stone)" stroke="#3a352f" strokeWidth="0.4">
      {of('rubble').flatMap((p) => {
        const c = pixel(p, grid);
        return [0, 1, 2, 3, 4].map((i) => (
          <ellipse key={`${p.x},${p.y},${i}`} cx={c.x + (hash(p.x, p.y, i) - 0.5) * CELL * 0.7} cy={c.y + (hash(p.x, p.y, i + 9) - 0.5) * CELL * 0.6} rx={1.5 + hash(p.x, p.y, i + 3) * 2.5} ry={1.2 + hash(p.x, p.y, i + 5) * 2} />
        ));
      })}
    </g>,
  );

  // Walls (masonry, timber or bare rock) and doorways.
  const walls = of('wall');
  if (walls.length) {
    const st = solidStyle('wall', map.preset);
    out.push(
      <g key="walls" fill={st.fill}>
        {walls.map((p) => (
          <polygon key={`${p.x},${p.y}`} points={cellPoints(p, grid, 1.04)} />
        ))}
      </g>,
    );
    if (map.preset === 'cave' || map.preset === 'dungeon') {
      // Rough texture on the rock.
      out.push(
        <g key="rock-tex" fill="rgba(255,255,255,0.05)">
          {walls.map((p) => {
            const c = pixel(p, grid);
            return <circle key={`${p.x},${p.y}`} cx={c.x + (hash(p.x, p.y) - 0.5) * 12} cy={c.y + (hash(p.x, p.y, 2) - 0.5) * 12} r={3 + hash(p.x, p.y, 4) * 5} />;
          })}
        </g>,
      );
    }
    out.push(outline(map, grid, walls, (k) => k === 'wall', map.preset === 'cave' ? '#6e5e4c' : '#a89a84', 1.4, 'edge-wall'));
  }
  for (const p of of('door')) {
    const c = pixel(p, grid);
    // A wooden door standing open in the gap, along the line of the wall.
    const wallRunsAcross = terrainAt(map, { x: p.x - 1, y: p.y }) === 'wall' || terrainAt(map, { x: p.x + 1, y: p.y }) === 'wall';
    const long = CELL * 0.8;
    out.push(
      <rect
        key={`door-${p.x},${p.y}`}
        x={c.x - (wallRunsAcross ? long / 2 : 2.5)}
        y={c.y - (wallRunsAcross ? 2.5 : long / 2)}
        width={wallRunsAcross ? long : 5}
        height={wallRunsAcross ? 5 : long}
        fill="#6b4423"
        stroke="#2e1c0c"
        strokeWidth="0.8"
      />,
    );
  }

  // Houses: one roof per building, with a ridge along its length.
  groups(map, grid, 'house').forEach((g, i) => {
    const roof = ROOFS[Math.floor(hash(g[0].x, g[0].y, 1) * ROOFS.length)];
    const px = g.map((p) => pixel(p, grid));
    const x0 = Math.min(...px.map((q) => q.x));
    const x1 = Math.max(...px.map((q) => q.x));
    const y0 = Math.min(...px.map((q) => q.y));
    const y1 = Math.max(...px.map((q) => q.y));
    const alongX = x1 - x0 >= y1 - y0;
    out.push(
      <g key={`house-${i}`}>
        <g fill={roof}>
          {g.map((p) => (
            <polygon key={`${p.x},${p.y}`} points={cellPoints(p, grid, 1.04)} />
          ))}
        </g>
        {/* Roof tiles: faint parallel lines, then the ridge. */}
        <g stroke="rgba(0,0,0,0.18)" strokeWidth="0.8">
          {g.map((p) => {
            const c = pixel(p, grid);
            return alongX ? (
              <line key={`${p.x},${p.y}`} x1={c.x - CELL / 2} y1={c.y + (c.y < (y0 + y1) / 2 ? -5 : 5)} x2={c.x + CELL / 2} y2={c.y + (c.y < (y0 + y1) / 2 ? -5 : 5)} />
            ) : (
              <line key={`${p.x},${p.y}`} x1={c.x + (c.x < (x0 + x1) / 2 ? -5 : 5)} y1={c.y - CELL / 2} x2={c.x + (c.x < (x0 + x1) / 2 ? -5 : 5)} y2={c.y + CELL / 2} />
            );
          })}
        </g>
        {alongX ? (
          <line x1={x0} y1={(y0 + y1) / 2} x2={x1} y2={(y0 + y1) / 2} stroke="rgba(30,10,5,0.55)" strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <line x1={(x0 + x1) / 2} y1={y0} x2={(x0 + x1) / 2} y2={y1} stroke="rgba(30,10,5,0.55)" strokeWidth="2.2" strokeLinecap="round" />
        )}
        {outline(map, grid, g, (k) => k === 'house', '#2a140c', 1.8, 'edge')}
      </g>,
    );
  });

  // Free-standing things.
  for (const p of all) {
    const kind = terrainAt(map, p);
    const deco = decoAt(map, p);
    const c = pixel(p, grid);
    const k = `${kind}-${p.x},${p.y}`;
    const h1 = hash(p.x, p.y);
    if (kind === 'water' && deco === 'well') {
      out.push(
        <g key={k}>
          <circle cx={c.x} cy={c.y} r={CELL * 0.45} fill="url(#stone)" stroke="#3a352f" strokeWidth="1" />
          <circle cx={c.x} cy={c.y} r={CELL * 0.27} fill="#17323f" />
        </g>,
      );
    } else if (kind === 'rock') {
      const pts = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + h1;
        const r = CELL * (0.3 + hash(p.x, p.y, i) * 0.14);
        return `${(c.x + Math.cos(a) * r).toFixed(1)},${(c.y + Math.sin(a) * r).toFixed(1)}`;
      }).join(' ');
      out.push(
        <g key={k}>
          <ellipse cx={c.x + 3} cy={c.y + 4} rx={CELL * 0.4} ry={CELL * 0.32} fill="rgba(0,0,0,0.3)" />
          <polygon points={pts} fill="url(#stone)" stroke="#3a352f" strokeWidth="1" />
        </g>,
      );
    } else if (kind === 'pillar') {
      out.push(
        <g key={k}>
          <circle cx={c.x + 2} cy={c.y + 3} r={CELL * 0.36} fill="rgba(0,0,0,0.35)" />
          <circle cx={c.x} cy={c.y} r={CELL * 0.36} fill="url(#stone)" stroke="#2f2a24" strokeWidth="1.2" />
          <circle cx={c.x} cy={c.y} r={CELL * 0.22} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        </g>,
      );
    } else if (kind === 'wall' && deco === 'hearth') {
      out.push(
        <g key={k}>
          <rect x={c.x - CELL * 0.4} y={c.y - CELL * 0.25} width={CELL * 0.8} height={CELL * 0.6} fill="#2a1a10" stroke="#8a7a66" strokeWidth="1.4" />
          <ellipse cx={c.x} cy={c.y + 3} rx={CELL * 0.25} ry={CELL * 0.16} fill="#e2762a" opacity="0.9" />
          <ellipse cx={c.x} cy={c.y + 3} rx={CELL * 0.12} ry={CELL * 0.08} fill="#ffd27a" />
        </g>,
      );
    } else if (kind === 'low') {
      out.push(<Furniture key={k} deco={deco} c={c} p={p} map={map} grid={grid} />);
    }
  }

  // Trees last: their crowns spread over the ground around them.
  for (const p of of('tree')) {
    const c = pixel(p, grid);
    const h1 = hash(p.x, p.y);
    const r = CELL * (0.62 + h1 * 0.18);
    out.push(
      <g key={`tree-${p.x},${p.y}`}>
        <circle cx={c.x + 4} cy={c.y + 5} r={r} fill="rgba(0,0,0,0.28)" />
        <circle cx={c.x} cy={c.y} r={r} fill={h1 > 0.5 ? 'url(#canopy)' : 'url(#canopy-dark)'} stroke="#1a3010" strokeWidth="0.8" />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={c.x + Math.cos(i * 2.1 + h1 * 6) * r * 0.45}
            cy={c.y + Math.sin(i * 2.1 + h1 * 6) * r * 0.45}
            r={r * 0.42}
            fill="rgba(120,160,70,0.22)"
          />
        ))}
      </g>,
    );
  }
  return <g className="terrain">{out}</g>;
});

function Furniture({ deco, c, p, map, grid }: { deco: string; c: { x: number; y: number }; p: Pos; map: BattleMap; grid: Grid }) {
  const s = CELL;
  switch (deco) {
    case 'crate':
      return (
        <g>
          <rect x={c.x - s * 0.32 + 2} y={c.y - s * 0.32 + 3} width={s * 0.64} height={s * 0.64} fill="rgba(0,0,0,0.3)" />
          <rect x={c.x - s * 0.32} y={c.y - s * 0.32} width={s * 0.64} height={s * 0.64} fill="#9a6b3a" stroke="#4a2f14" strokeWidth="1.2" />
          <path d={`M${c.x - s * 0.32},${c.y - s * 0.32} L${c.x + s * 0.32},${c.y + s * 0.32} M${c.x + s * 0.32},${c.y - s * 0.32} L${c.x - s * 0.32},${c.y + s * 0.32}`} stroke="#5a3a1a" strokeWidth="1.2" />
        </g>
      );
    case 'barrel':
      return (
        <g>
          <circle cx={c.x + 2} cy={c.y + 3} r={s * 0.3} fill="rgba(0,0,0,0.3)" />
          <circle cx={c.x} cy={c.y} r={s * 0.3} fill="#8a5a2c" stroke="#3a2410" strokeWidth="1.2" />
          <circle cx={c.x} cy={c.y} r={s * 0.2} fill="none" stroke="#4a4a4a" strokeWidth="1.2" />
          <circle cx={c.x} cy={c.y} r={s * 0.06} fill="#3a2410" />
        </g>
      );
    case 'table':
    case 'stall':
    case 'cart':
    case 'sarcophagus': {
      // Two-cell pieces: draw the half that belongs to this cell, so the pair joins up.
      const left = terrainAt(map, { x: p.x - 1, y: p.y }) === 'low' && decoAt(map, { x: p.x - 1, y: p.y }) === deco;
      const right = terrainAt(map, { x: p.x + 1, y: p.y }) === 'low' && decoAt(map, { x: p.x + 1, y: p.y }) === deco;
      const x0 = c.x - (left ? s / 2 : s * 0.4);
      const x1 = c.x + (right ? s / 2 : s * 0.4);
      const hh = deco === 'cart' ? s * 0.32 : s * 0.3;
      const fill = deco === 'sarcophagus' ? '#8d877c' : deco === 'cart' ? '#7a5228' : '#8b5e34';
      return (
        <g>
          <rect x={x0 + 2} y={c.y - hh + 3} width={x1 - x0} height={hh * 2} fill="rgba(0,0,0,0.3)" />
          <rect x={x0} y={c.y - hh} width={x1 - x0} height={hh * 2} fill={fill} stroke={deco === 'sarcophagus' ? '#3f3a33' : '#3e2610'} strokeWidth="1" />
          {deco === 'stall' && (
            <g>
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={x0 + ((x1 - x0) / 4) * i} y={c.y - hh} width={(x1 - x0) / 8} height={hh * 2} fill={i % 2 ? '#c9b48a' : '#a8352a'} opacity="0.9" />
              ))}
            </g>
          )}
          {deco === 'cart' && (
            <g fill="#3a2410">
              <rect x={c.x - 3} y={c.y - hh - 3} width={6} height={3} />
              <rect x={c.x - 3} y={c.y + hh} width={6} height={3} />
            </g>
          )}
          {deco === 'table' && <line x1={x0 + 2} y1={c.y} x2={x1 - 2} y2={c.y} stroke="rgba(0,0,0,0.15)" />}
          {deco === 'sarcophagus' && <line x1={x0 + 3} y1={c.y - hh + 3} x2={x0 + 3} y2={c.y + hh - 3} stroke="rgba(0,0,0,0.25)" />}
        </g>
      );
    }
    case 'fence': {
      // Rails to the next fence cells, posts in each.
      const rails = neighbours(p, grid)
        .filter((n) => decoAt(map, n) === 'fence')
        .map((n) => {
          const o = pixel(n, grid);
          return <line key={`${n.x},${n.y}`} x1={c.x} y1={c.y} x2={(c.x + o.x) / 2} y2={(c.y + o.y) / 2} stroke="#5e4022" strokeWidth="3" />;
        });
      return (
        <g>
          {rails}
          <rect x={c.x - 3} y={c.y - 3} width={6} height={6} fill="#6e4c28" stroke="#2e1c0c" strokeWidth="0.8" />
        </g>
      );
    }
    default:
      return <rect x={c.x - s * 0.3} y={c.y - s * 0.3} width={s * 0.6} height={s * 0.6} fill="#7a6a55" stroke="#3a3025" />;
  }
}

/** Bushes, drawn over the tokens: someone hiding in one is half lost in the leaves. */
export const BushLayer = memo(function BushLayer({ map, grid }: { map: BattleMap; grid: Grid }) {
  const out: ReactElement[] = [];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (terrainAt(map, { x, y }) !== 'bush') continue;
      const c = pixel({ x, y }, grid);
      out.push(
        <g key={`${x},${y}`}>
          {[0, 1, 2, 3].map((i) => {
            const a = i * 1.7 + hash(x, y) * 6;
            return <circle key={i} cx={c.x + Math.cos(a) * HEX_R * 0.42} cy={c.y + Math.sin(a) * HEX_R * 0.42} r={HEX_R * (0.48 + hash(x, y, i) * 0.16)} fill="url(#leaf)" stroke="#2a4a18" strokeWidth="0.6" />;
          })}
        </g>,
      );
    }
  return (
    <g className="bushes" opacity="0.78" pointerEvents="none">
      {out}
    </g>
  );
});
