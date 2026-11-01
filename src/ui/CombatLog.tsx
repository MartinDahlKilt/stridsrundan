import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Combatant, LogEntry } from '../engine/types';

/** Round and opportunity headings get their own ornament style. */
function headingKind(e: LogEntry): string {
  if (e.depth !== 0) return '';
  if (/^Round \d+$/.test(e.text)) return 'round';
  if (/^Opportunity \d$/.test(e.text)) return 'opp';
  return '';
}

/** Render the d20 results in "rolled 14" / "rolled 1→7" as little dice. */
function withDice(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /rolled ((?:\d+→)*\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(text.slice(last, m.index), 'rolled ');
    m[1].split('→').forEach((v, i) => {
      if (i > 0) out.push('→');
      out.push(
        <span key={`${m!.index}-${i}`} className={`die ${v === '20' ? 'nat20' : v === '1' ? 'nat1' : ''}`}>
          {v}
        </span>,
      );
    });
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export function CombatLog({ log, combatants }: { log: LogEntry[]; combatants: Combatant[] }) {
  const [details, setDetails] = useState(true);
  const [aiNotes, setAiNotes] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  const team = new Map(combatants.map((c) => [c.id, c.team]));
  const shown = log.filter((e) => (details || e.depth < 2 || e.tone === 'critical' || e.tone === 'status') && (aiNotes || e.tone !== 'ai'));

  return (
    <aside className="log">
      <div className="log-head">
        <h3>Combat log</h3>
        <label>
          <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} /> details
        </label>
        <label>
          <input type="checkbox" checked={aiNotes} onChange={(e) => setAiNotes(e.target.checked)} /> AI reasons
        </label>
      </div>
      <div className="log-body">
        {shown.map((e) => (
          <div key={e.id} className={`entry d${e.depth} tone-${e.tone} ${headingKind(e)} ${e.actorId !== undefined ? `team-${team.get(e.actorId)}` : ''}`}>
            {e.depth === 0 ? e.text : withDice(e.text)}
          </div>
        ))}
        <div ref={end} />
      </div>
    </aside>
  );
}
