import { useEffect, useRef, useState } from 'react';
import type { Combatant, LogEntry } from '../engine/types';

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
          <div key={e.id} className={`entry d${e.depth} tone-${e.tone} ${e.actorId !== undefined ? `team-${team.get(e.actorId)}` : ''}`}>
            {e.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </aside>
  );
}
