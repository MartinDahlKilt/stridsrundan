import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombatSession } from '../engine/session';
import type { DecisionAnswer } from '../engine/requests';
import type { Pos } from '../engine/types';
import type { FightConfig } from './App';
import { Battlefield } from './Battlefield';
import { CombatantPanel } from './CombatantPanel';
import { CombatLog } from './CombatLog';
import { DecisionPanel, type BoardMode } from './DecisionPanel';
import { DiceTray } from './DiceTray';

export function CombatScreen({ session, config, onNewFight, onRematch }: { session: CombatSession; config: FightConfig; onNewFight: () => void; onRematch: () => void }) {
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [boardMode, setBoardMode] = useState<BoardMode>(null);
  const [auto, setAuto] = useState(false);
  const started = useRef(false);
  const mode = config.pauseAfterEachAction ? 'step' : 'untilHuman';
  const s = session.state;
  const allAi = s.combatants.every((c) => c.controller === 'ai');
  const winners = s.combatants.filter((c) => c.team === s.winner && c.status === 'active').map((c) => c.sheet.name);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    session.advance(allAi ? 'step' : mode);
    refresh();
  }, [session, mode, allAi, refresh]);

  // Auto-play for computer-only fights.
  useEffect(() => {
    if (!auto || s.over || session.pending) return;
    const t = setTimeout(() => {
      session.advance('step');
      refresh();
    }, 450);
    return () => clearTimeout(t);
  });

  const answer = (a: DecisionAnswer) => {
    setBoardMode(null);
    session.answer(a, mode);
    refresh();
  };
  const cont = () => {
    session.advance(allAi ? 'step' : mode);
    refresh();
  };

  const pending = session.pending;
  const onSquare = (p: Pos) => {
    if (!boardMode || !pending) return;
    answer({ kind: boardMode.kind, to: p });
  };

  return (
    <div className="combat">
      <header className="topbar">
        <div className="title">
          <span className="brand">Stridsrundan</span>
          <strong>Round {s.round || '–'}</strong>
          {s.opp > 0 && !s.over && <span className="muted"> · opportunity {s.opp}</span>}
        </div>
        <div className="controls">
          {!pending && !s.over && (
            <button className="primary" onClick={cont}>
              Continue ▶
            </button>
          )}
          {allAi && !s.over && <button onClick={() => setAuto(!auto)}>{auto ? 'Pause' : 'Auto-play'}</button>}
          {pending && (
            <button onClick={() => { setBoardMode(null); session.autoAnswer(mode); refresh(); }} title="Let the computer make this decision">
              Let the AI decide
            </button>
          )}
          <button onClick={onRematch}>Rematch (new seed)</button>
          <button onClick={onNewFight}>New fight</button>
          <span className="muted seed">seed {s.seed}</span>
        </div>
      </header>

      <main className="combat-main">
        <div className="left">
          <div className="table-row">
            <Battlefield state={s} highlight={boardMode?.squares ?? null} highlightKind={boardMode?.kind ?? null} onSquare={onSquare} activeId={pending?.actorId ?? null} />
            <DiceTray state={s} />
          </div>
          {s.over && (
            <div className="result">
              <h2>⚔ {s.winner === null ? 'No winner' : `${winners.join(' & ')} win${winners.length === 1 ? 's' : ''}!`} ⚔</h2>
              <p className="muted">After {s.round} round{s.round === 1 ? '' : 's'}.</p>
            </div>
          )}
          {pending && <DecisionPanel ctx={session.ctx} request={pending} onAnswer={answer} boardMode={boardMode} setBoardMode={setBoardMode} />}
          <div className="panels">
            {s.combatants.map((c) => (
              <CombatantPanel key={c.id} c={c} round={s.round} />
            ))}
          </div>
        </div>
        <CombatLog log={s.log} combatants={s.combatants} />
      </main>
    </div>
  );
}
