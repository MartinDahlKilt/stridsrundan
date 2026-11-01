import { armourAt, heldItem } from '../engine/character';
import { activeConditions, currentFF, FOREVER, limbUsable } from '../engine/conditions';
import { AMMO_NAMES, itemDef } from '../data/items';
import { SCHOOL_NAMES, spellDef } from '../data/spells';
import { castBlock } from '../engine/magic';
import type { Combatant, MagicSchool } from '../engine/types';
import { HERO_ABILITY_NAMES, HERO_STATUS } from './labels';
import { LOCATIONS, LOCATION_NAMES } from '../engine/types';

export function CombatantPanel({ c, round }: { c: Combatant; round: number }) {
  const main = heldItem(c, 'main');
  const off = heldItem(c, 'off');
  const conds = c.conditions.filter((x) => x.throughRound >= round && (x.uses === undefined || x.uses > 0) && x.kind !== 'limbUnusable');
  return (
    <section className={`cpanel team-${c.team} ${c.status === 'out' ? 'out' : ''}`}>
      <header>
        <h3>
          {c.sheet.name} <span className="muted small">{c.controller === 'human' ? '(you)' : '(computer)'}</span>
        </h3>
        <span className="muted small">{c.sheet.professionName}</span>
      </header>
      {c.sheet.hero && c.hero && (
        <div className="hero-line">
          ★ {c.sheet.hero.dark ? 'Dark hero' : 'Hero'} – {HERO_STATUS[c.sheet.hero.status]} · hero points {c.hero.points}
          {c.sheet.hero.abilities.length > 0 && <span className="muted"> · {c.sheet.hero.abilities.map((a) => HERO_ABILITY_NAMES[a]).join(', ')}</span>}
          {c.hero.lastStandUntil != null && c.status === 'active' && <div className="bad">LAST STAND – falls at the end of round {c.hero.lastStandUntil}</div>}
        </div>
      )}
      {c.status === 'out' && (
        <div className="out-banner">
          {c.outKind?.toUpperCase()} – {c.outReason}
        </div>
      )}
      <Bar label="HP (KP)" cur={c.kpTotal.cur} max={c.kpTotal.max} cls="kp" />
      <Bar label="Pain (SP)" cur={c.spTotal.cur} max={c.spTotal.max} cls="sp" />
      <Bar label="PSY" cur={c.psy} max={c.psyMax} cls="psy" title="PSY points: spells cost 1 per effect grade (1 on a failure); below 0 the soul burns out" />
      {c.staffPsy && <Bar label="Staff PSY" cur={c.staffPsy.cur} max={c.staffPsy.max} cls="staff" title="PSY stored in the staff (PSY-källa) – spent before your own" />}
      {c.sheet.magic && <MagicLine c={c} round={round} />}
      <table className="body">
        <thead>
          <tr>
            <th>Location</th>
            <th title="Kroppspoäng">KP</th>
            <th title="Smärtpoäng">SP</th>
            <th title="Armour absorption KP/SP">Armour</th>
          </tr>
        </thead>
        <tbody>
          {LOCATIONS.map((l) => {
            const a = armourAt(c, l);
            const hurt = c.kp[l].cur < c.kp[l].max || c.sp[l].cur < c.sp[l].max;
            return (
              <tr key={l} className={`${hurt ? 'hurt' : ''} ${!limbUsable(c, l, round) ? 'useless' : ''} ${c.kp[l].cur <= 0 ? 'zero' : ''}`}>
                <td>
                  {LOCATION_NAMES[l]}
                  {!limbUsable(c, l, round) ? ' ✖' : ''}
                </td>
                <td>
                  {c.kp[l].cur}/{c.kp[l].max}
                </td>
                <td>
                  {c.sp[l].cur}/{c.sp[l].max}
                </td>
                <td title={a.names.join(' + ')}>{a.absKP || a.absSP ? `${a.absKP}/${a.absSP}` : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="facts">
        <div>
          <span className="muted">Actions:</span>{' '}
          {c.status === 'active'
            ? [1, 2, 3].map((o) => {
                const slots = c.slots.filter((s) => s.opp === o);
                if (!slots.length) return null;
                return (
                  <span key={o} className="opp-slots" title={`Opportunity ${o}`}>
                    {o}:
                    {slots.map((s, i) => (
                      <span
                        key={i}
                        className={`dot ${s.used ? 'used' : s.lost ? 'lost' : 'free'} ${s.weapon ? 'weapon-only' : ''}`}
                        title={`${s.used ? 'used' : s.lost ? 'lost' : 'available'}${s.weapon ? ' – only for the heroic weapon (FV 21+)' : ''}`}
                      />
                    ))}
                  </span>
                );
              })
            : '–'}
        </div>
        <div>
          <span className="muted">Wielding:</span> {main ? `${main.def.name}${main.state.bv !== null ? ` (BV ${main.state.bv})` : ''}${main.def.kind === 'thrown' ? ` ×${main.state.count}` : ''}` : 'nothing'}
          {off ? `, ${off.def.name}${off.state.bv !== null ? ` (BV ${off.state.bv})` : ''}` : ''}
        </div>
        {Object.entries(c.ammo).map(([k, v]) => (
          <div key={k}>
            <span className="muted">{AMMO_NAMES[k] ?? k}:</span> {v}
          </div>
        ))}
        <div>
          <span className="muted">Movement:</span> {currentFF(c, round)} sq
          {c.stance === 'defensive' ? ' · fighting defensively' : ''}
          {c.aimBonus ? ` · aiming +${c.aimBonus}` : ''}
        </div>
        {c.burns.length > 0 && <div className="bad">Burning: {c.burns.map((b) => `${b.dice}/round until round ${b.throughRound} (${b.source})`).join(', ')}</div>}
        {c.bleeds.length > 0 && (
          <div className="bad">Bleeding: {c.bleeds.map((b) => `${b.kp} KP/${b.every === 1 ? 'round' : `${b.every} rounds`}`).join(', ')}</div>
        )}
        {conds.length > 0 && (
          <ul className="conds">
            {conds.map((x, i) => (
              <li key={i} title={x.text}>
                {condLabel(x.kind, x.value)} {x.uses !== undefined ? `(next ${x.uses})` : x.throughRound >= FOREVER ? '(rest of fight)' : `(until round ${x.throughRound})`}
              </li>
            ))}
          </ul>
        )}
        {activeConditions(c, round, 'limbUnusable').length > 0 && (
          <div className="bad">Useless: {activeConditions(c, round, 'limbUnusable').map((x) => LOCATION_NAMES[x.location!]).join(', ')}</div>
        )}
      </div>
    </section>
  );
}

function condLabel(kind: string, value?: number): string {
  switch (kind) {
    case 'clMod':
      return `CL ${value! > 0 ? '+' : ''}${value}`;
    case 'cannotAct':
      return 'Cannot act';
    case 'onlyParry':
      return 'Only parry';
    case 'noParry':
      return 'Cannot parry';
    case 'noAttack':
      return 'Cannot attack';
    case 'autoFail':
      return 'Attacks/parries fail';
    case 'missNext':
      return 'Next attacks miss';
    case 'actionPenalty':
      return `−${value} action/round`;
    case 'opponentBonus':
      return `Opponents +${value} CL`;
    case 'autoHitAgainst':
      return 'Next attack on him hits';
    case 'prone':
      return 'On the ground';
    case 'movementFactor':
      return `Movement ×${value}`;
    case 'ffMod':
      return `Movement ${value}`;
    default:
      return kind;
  }
}

function MagicLine({ c, round }: { c: Combatant; round: number }) {
  const m = c.sheet.magic!;
  const k = c.casting;
  const block = c.status === 'active' ? castBlock(c) : null;
  const spells = c.activeSpells.filter((x) => x.throughRound >= round);
  return (
    <div className="magic-line">
      <div>
        ✦ {(Object.entries(m.schools) as [MagicSchool, number][]).map(([sch, fv]) => `${SCHOOL_NAMES[sch]} FV ${fv}`).join(', ')}{' '}
        <span className="muted">(max E)</span>
      </div>
      {k && c.status === 'active' && (
        <div className="casting">
          {k.suicide ? 'SUICIDE SPELL: ' : 'Casting '}
          {spellDef(k.spell).sv} E{k.e} – {k.done}/{k.total} actions
          {k.done >= k.total - 1 ? (k.spell === 'shield' ? ' (ready to parry)' : ' (ready to release)') : ''}
        </div>
      )}
      {spells.length > 0 && (
        <div>
          {spells.map((x, i) => (
            <span key={i} className="muted">
              {i > 0 ? ' · ' : ''}
              {x.name}
              {x.itemKey && c.items[x.itemKey] ? ` on the ${itemDef(c.items[x.itemKey].def).name.toLowerCase()}` : ''} (to round {x.throughRound})
            </span>
          ))}
        </div>
      )}
      {block && block !== 'no PSY left' && <div className="bad">Can’t cast: {block}</div>}
      {c.forgottenSpells.length > 0 && <div className="bad">Forgotten: {c.forgottenSpells.map((x) => spellDef(x).sv).join(', ')}</div>}
    </div>
  );
}

function Bar({ label, cur, max, cls, title }: { label: string; cur: number; max: number; cls: string; title?: string }) {
  const frac = Math.max(0, Math.min(1, cur / max));
  return (
    <div className="bar" title={title}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill ${cls}`} style={{ width: `${frac * 100}%` }} />
      </span>
      <span className="bar-num">
        {cur}/{max}
      </span>
    </div>
  );
}
