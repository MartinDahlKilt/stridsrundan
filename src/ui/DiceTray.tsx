import type { CombatState, DieRoll } from '../engine/types';
import { Die, type DieTone } from './Dice';

/** A throw = the dice rolled for one log line (an attack, a parry, a damage roll, …). */
interface Throw {
  logId: number;
  rolls: DieRoll[];
  caption: string;
  tone: DieTone;
}

const RECENT = 6;

function throwsOf(state: CombatState): Throw[] {
  const groups: Throw[] = [];
  for (const r of state.rolls) {
    const last = groups[groups.length - 1];
    if (last && last.logId === r.logId) last.rolls.push(r);
    else groups.push({ logId: r.logId, rolls: [r], caption: '', tone: 'ivory' });
  }
  const byId = new Map(state.log.map((e) => [e.id, e]));
  const teamOf = new Map(state.combatants.map((c) => [c.id, c.team]));
  const toneOf = (team: number | undefined): DieTone => (team === 0 ? 'blue' : team === 1 ? 'red' : 'ivory');
  let lastAttacker: number | undefined;
  for (const g of groups) {
    const entry = byId.get(g.logId);
    g.caption = entry ? entry.text : 'Rolling…';
    const team = entry?.actorId ? teamOf.get(entry.actorId) : undefined;
    // Damage lines ("X takes 7 KP…") belong to the defender, but the attacker rolled the damage dice.
    const isDamage = !!entry && (/ takes \d+ KP/.test(entry.text) || /^Parried|The blow goes through/.test(entry.text));
    if (isDamage) g.tone = toneOf(lastAttacker !== undefined && lastAttacker !== team ? lastAttacker : team === 0 ? 1 : team === 1 ? 0 : undefined);
    else {
      g.tone = toneOf(team);
      if (entry && /attacks|shoots|throws|hurls/.test(entry.text)) lastAttacker = team;
    }
  }
  return groups.slice(-RECENT).reverse();
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function DiceTray({ state }: { state: CombatState }) {
  const throws = throwsOf(state);
  const [latest, ...older] = throws;
  return (
    <aside className="dice-tray" aria-label="Dice tray">
      <h3>Dice</h3>
      <div className="tray-felt">
        {latest ? (
          // Keyed by the throw so a new throw remounts and tumbles in.
          <div className="throw latest" key={latest.logId}>
            <div className="throw-dice">
              {latest.rolls.map((r, i) => (
                <Die key={r.id} sides={r.sides} value={r.value} tone={latest.tone} size={latest.rolls.length > 4 ? 46 : 60} rolling delay={i * 90} />
              ))}
            </div>
            <p className="throw-caption">{short(latest.caption, 150)}</p>
          </div>
        ) : (
          <p className="throw-caption empty">The dice wait…</p>
        )}
      </div>
      {older.length > 0 && (
        <ol className="older-throws">
          {older.map((t) => (
            <li key={t.logId} className="throw older">
              <span className="throw-dice">
                {t.rolls.map((r) => (
                  <Die key={r.id} sides={r.sides} value={r.value} tone={t.tone} size={28} />
                ))}
              </span>
              <span className="throw-caption" title={t.caption}>
                {short(t.caption, 70)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
