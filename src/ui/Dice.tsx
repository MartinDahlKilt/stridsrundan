import type { CSSProperties, ReactNode } from 'react';

/**
 * Physical-looking dice drawn in SVG. Swedish notation: T20 = d20. T3 and T2 are read off a d6 at the
 * table, so they're shown as a d6 (with a T3/T2 label); T5 as a d10; T100 as two d10s (tens + units).
 */

export type DieTone = 'blue' | 'red' | 'ivory';

const TONES: Record<DieTone, { light: string; mid: string; dark: string; ink: string; edge: string }> = {
  blue: { light: '#6f93d6', mid: '#2f5596', dark: '#162a52', ink: '#fff6dd', edge: '#0d1a33' },
  red: { light: '#e8786a', mid: '#a4302a', dark: '#561410', ink: '#fff6dd', edge: '#330b08' },
  ivory: { light: '#fffaf0', mid: '#eadbb8', dark: '#b89f6e', ink: '#3a2410', edge: '#7a6136' },
};

interface DieProps {
  sides: number;
  value: number;
  tone: DieTone;
  size?: number;
  /** Animate the die tumbling into the tray. */
  rolling?: boolean;
  delay?: number;
}

export function Die({ sides, value, tone, size = 56, rolling, delay = 0 }: DieProps) {
  if (sides === 100) {
    // Percentile: a tens die and a units die.
    const tens = Math.floor((value % 100) / 10) * 10;
    const units = value % 10;
    return (
      <span className="die-pair" title={`1T100 → ${value}`}>
        <Die sides={10} value={tens} tone={tone} size={size} rolling={rolling} delay={delay} />
        <Die sides={10} value={units} tone={tone} size={size} rolling={rolling} delay={delay + 60} />
        <span className="die-label">T100 = {value}</span>
      </span>
    );
  }
  const label = `T${sides}`;
  const crit = sides === 20 && value === 20 ? 'nat20' : sides === 20 && value === 1 ? 'nat1' : '';
  const style: CSSProperties = { width: size };
  return (
    <span className={`die-phys ${rolling ? 'rolling' : ''} ${crit}`} style={style} title={`1${label} → ${value}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-label={`${label} showing ${value}`} style={{ animationDelay: `${delay}ms` }}>
        <Gradients tone={tone} />
        {shape(sides, value, tone)}
      </svg>
      <span className="die-label">{label}</span>
    </span>
  );
}

function Gradients({ tone }: { tone: DieTone }) {
  // Identical per tone, so repeated definitions across dice are harmless; each die stays self-contained.
  const t = TONES[tone];
  return (
    <defs>
      <linearGradient id={`dg-face-${tone}`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor={t.light} />
        <stop offset="100%" stopColor={t.mid} />
      </linearGradient>
      <linearGradient id={`dg-side-${tone}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={t.mid} />
        <stop offset="100%" stopColor={t.dark} />
      </linearGradient>
    </defs>
  );
}

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

function Num({ x, y, size, tone, children }: { x: number; y: number; size: number; tone: DieTone; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="die-num" fontSize={size} fill={TONES[tone].ink}>
      {children}
    </text>
  );
}

function shape(sides: number, value: number, tone: DieTone): ReactNode {
  const t = TONES[tone];
  const face = `url(#dg-face-${tone})`;
  const side = `url(#dg-side-${tone})`;
  const edge = { stroke: t.edge, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  const facet = { stroke: t.edge, strokeWidth: 1, strokeOpacity: 0.55, fill: 'none' };
  // The number on a 6 or 9 gets an underline so it reads the right way up, like on a real die.
  const n = (v: number) => (v === 6 || v === 9 ? <tspan textDecoration="underline">{v}</tspan> : v);

  switch (sides) {
    case 20: {
      const hex: [number, number][] = [
        [50, 3],
        [92, 27],
        [92, 73],
        [50, 97],
        [8, 73],
        [8, 27],
      ];
      const tri: [number, number][] = [
        [50, 22],
        [79, 69],
        [21, 69],
      ];
      return (
        <g>
          <polygon points={pts(hex)} fill={side} {...edge} />
          {[
            [0, 0],
            [0, 5],
            [0, 1],
            [1, 1],
            [1, 2],
            [1, 3],
            [2, 5],
            [2, 4],
            [2, 3],
          ].map(([a, b], i) => (
            <line key={i} x1={tri[a][0]} y1={tri[a][1]} x2={hex[b][0]} y2={hex[b][1]} {...facet} />
          ))}
          <polygon points={pts(tri)} fill={face} {...edge} />
          <Num x={50} y={54} size={value >= 10 ? 21 : 24} tone={tone}>
            {n(value)}
          </Num>
        </g>
      );
    }
    case 10:
    case 5: {
      const kite: [number, number][] = [
        [50, 3],
        [93, 44],
        [50, 97],
        [7, 44],
      ];
      const top: [number, number][] = [
        [50, 10],
        [78, 47],
        [50, 64],
        [22, 47],
      ];
      return (
        <g>
          <polygon points={pts(kite)} fill={side} {...edge} />
          <line x1={22} y1={47} x2={7} y2={44} {...facet} />
          <line x1={78} y1={47} x2={93} y2={44} {...facet} />
          <line x1={50} y1={64} x2={50} y2={97} {...facet} />
          <polygon points={pts(top)} fill={face} {...edge} />
          <Num x={50} y={43} size={value >= 10 ? 19 : 22} tone={tone}>
            {sides === 10 && value === 0 ? '0' : n(value)}
          </Num>
        </g>
      );
    }
    case 8: {
      return (
        <g>
          <polygon points={pts([[50, 3], [94, 50], [50, 97], [6, 50]])} fill={side} {...edge} />
          <polygon points={pts([[50, 3], [94, 50], [6, 50]])} fill={face} {...edge} />
          <line x1={6} y1={50} x2={50} y2={97} {...facet} />
          <Num x={50} y={36} size={22} tone={tone}>
            {n(value)}
          </Num>
        </g>
      );
    }
    case 4: {
      return (
        <g>
          <polygon points={pts([[50, 5], [95, 88], [5, 88]])} fill={face} {...edge} />
          <polygon points={pts([[50, 5], [95, 88], [62, 70]])} fill={side} opacity={0.55} />
          <Num x={47} y={62} size={24} tone={tone}>
            {value}
          </Num>
        </g>
      );
    }
    case 2: {
      return (
        <g>
          <ellipse cx={50} cy={55} rx={42} ry={38} fill={side} {...edge} />
          <ellipse cx={50} cy={50} rx={42} ry={38} fill={face} {...edge} />
          <ellipse cx={50} cy={50} rx={32} ry={28} fill="none" stroke={t.edge} strokeOpacity={0.35} />
          <Num x={50} y={51} size={28} tone={tone}>
            {value}
          </Num>
        </g>
      );
    }
    default: {
      // d6 (also T3): a cube seen slightly from above, pips on the top face.
      const pip = PIPS[Math.min(6, Math.max(1, value))] ?? [];
      return (
        <g>
          <polygon points={pts([[14, 26], [86, 26], [96, 36], [96, 92], [24, 92], [14, 82]])} fill={side} {...edge} />
          <rect x={10} y={14} width={74} height={74} rx={12} fill={face} {...edge} />
          {pip.map(([x, y], i) => (
            <circle key={i} cx={10 + x * 74} cy={14 + y * 74} r={7} fill={t.ink} stroke={t.edge} strokeOpacity={0.4} />
          ))}
        </g>
      );
    }
  }
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.73, 0.22],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.78],
    [0.73, 0.78],
  ],
};
