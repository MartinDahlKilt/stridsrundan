import { useState } from 'react';
import { describeCl, type ClResult } from '../engine/cl';
import type { CastingInfo, MagicOptions, SpellOption, SpellTarget, SpellTargetOption } from '../engine/magic';
import type { AttackChoice, AttackOption, DecisionAnswer, DecisionRequest, LocOption, Maneuver } from '../engine/requests';
import { byId, type Ctx } from '../engine/state';
import type { Location, Pos } from '../engine/types';
import { LOCATIONS, LOCATION_NAMES } from '../engine/types';

export type BoardMode = { kind: 'move' | 'run'; squares: Pos[] } | null;

interface Props {
  ctx: Ctx;
  request: DecisionRequest;
  onAnswer: (a: DecisionAnswer) => void;
  boardMode: BoardMode;
  setBoardMode: (m: BoardMode) => void;
}

export function DecisionPanel(p: Props) {
  const actor = byId(p.ctx, p.request.actorId);
  const r = p.request;
  return (
    <section className={`decision team-${actor.team}`}>
      {r.kind === 'action' && <ActionPanel {...p} request={r} name={actor.sheet.name} />}
      {r.kind === 'parry' && <ParryPrompt request={r} name={actor.sheet.name} onAnswer={p.onAnswer} />}
      {r.kind === 'rollWithBlow' && (
        <div>
          <h3>{actor.sheet.name}: roll with the blow?</h3>
          <p>
            The hit will cause <strong>{r.spDamage} SP</strong> (pain) to the {LOCATION_NAMES[r.location].toLowerCase()}. Rolling with the blow is an SMI roll (CL {r.cl}): success
            halves the SP damage. Either way you <strong>lose your next action</strong>.
          </p>
          <div className="row">
            <button className="primary" onClick={() => p.onAnswer(true)}>
              Roll with it
            </button>
            <button onClick={() => p.onAnswer(false)}>Take the blow</button>
          </div>
        </div>
      )}
      {r.kind === 'firstStrike' && (
        <div>
          <h3>{actor.sheet.name}: strike first?</h3>
          <p className="muted">
            {byId(p.ctx, r.targetId).sheet.name} is coming into the reach of your longer weapon. You may use your next action now.
            {r.spearSet ? ' Your spear is set against the charge: a hit adds the attacker’s damage bonus.' : ''}
          </p>
          <AttackChooser options={r.options} heroPoints={actor.hero?.points ?? 0} onChoose={(c) => p.onAnswer(c)} />
          <div className="row">
            <button onClick={() => p.onAnswer(null)}>Don’t strike</button>
          </div>
        </div>
      )}
      {r.kind === 'powerStrike' && (
        <div>
          <h3>{actor.sheet.name}: power strike?</h3>
          <p>
            Your blow hits {byId(p.ctx, r.targetId).sheet.name}. <strong>Kraftslag</strong>: spend 1T6 PSY (you have {r.psy}) to make it do <strong>maximum damage</strong>, including
            damage bonus. {r.usesLeft} use{r.usesLeft === 1 ? '' : 's'} left today.
          </p>
          <div className="row">
            <button className="primary" onClick={() => p.onAnswer(true)}>
              Power strike
            </button>
            <button onClick={() => p.onAnswer(false)}>Normal damage</button>
          </div>
        </div>
      )}
      {r.kind === 'lastStand' && (
        <div>
          <h3>{actor.sheet.name} has fallen – {r.reason}.</h3>
          <p>
            A hero can make a <strong>suicide attack</strong>: rise with full KP and normal skill for <strong>{r.rounds} rounds</strong>, ignoring every wound except perfect hits – and
            then fall and die.
          </p>
          <div className="row">
            <button className="primary" onClick={() => p.onAnswer(true)}>
              Rise for a last stand
            </button>
            <button onClick={() => p.onAnswer(false)}>Stay down</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function ActionPanel({ ctx, request, onAnswer, boardMode, setBoardMode, name }: Props & { request: Extract<DecisionRequest, { kind: 'action' }>; name: string }) {
  const o = request.options;
  const actor = byId(ctx, request.actorId);
  const free = actor.slots.filter((s) => !s.used && !s.lost);
  const inOpp = free.filter((s) => s.opp === request.opp).length;
  return (
    <div>
      <h3>
        Your action – {name} <span className="muted small">(opportunity {request.opp}; {inOpp} action{inOpp === 1 ? '' : 's'} here, {free.length} left this round)</span>
      </h3>
      {o.restrictions.map((t) => (
        <p key={t} className="muted small">
          {t}
        </p>
      ))}

      {o.attacks.length > 0 && (
        <div className="group">
          <h4>Attack</h4>
          <AttackChooser options={o.attacks} heroPoints={o.heroPoints} onChoose={(c) => onAnswer(c)} />
        </div>
      )}

      {o.magic && (o.magic.spells.length > 0 || o.magic.casting) && (
        <div className="group">
          <h4>
            Magic{' '}
            <span className="muted small">
              – PSY {o.magic.psy}
              {o.magic.staffPsy !== null ? ` + staff ${o.magic.staffPsy}` : ''}
            </span>
          </h4>
          <MagicPanel magic={o.magic} heroPoints={o.heroPoints} onAnswer={onAnswer} />
        </div>
      )}

      {o.swordThrows.length > 0 && (
        <div className="group">
          <h4>Throw your sword (FV 21+)</h4>
          <div className="row wrap">
            {o.swordThrows.map((t) => (
              <ClButton key={t.targetId + t.weapon} cl={t.cl} label={`Throw the ${t.weaponName} at ${t.targetName}`} onClick={() => onAnswer({ kind: 'throwSword', targetId: t.targetId, weapon: t.weapon })} />
            ))}
          </div>
        </div>
      )}

      {(o.shots.length > 0 || o.blockedShots.length > 0) && (
        <div className="group">
          <h4>Shoot / throw</h4>
          {o.shots.map((s) => (
            <div key={s.targetId}>
              <div className="row">
                <ClButton cl={s.random} label={`${s.weaponName} at ${s.targetName} (${s.distanceM} m)`} onClick={() => onAnswer({ kind: 'shoot', targetId: s.targetId, location: null })} primary />
              </div>
              <details>
                <summary className="small">Aim at a location (−5)</summary>
                <div className="row wrap">
                  {s.aimed.map((lo) => (
                    <ClButton key={lo.location} cl={lo.cl} label={LOCATION_NAMES[lo.location]} onClick={() => onAnswer({ kind: 'shoot', targetId: s.targetId, location: lo.location })} />
                  ))}
                </div>
              </details>
            </div>
          ))}
          {o.blockedShots.map((b) => (
            <p key={b.targetName} className="muted small">
              Can’t shoot at {b.targetName}: {b.reason}.
            </p>
          ))}
        </div>
      )}

      <div className="group">
        <h4>Other</h4>
        <div className="row wrap">
          {o.move && (
            <button className={boardMode?.kind === 'move' ? 'on' : ''} onClick={() => setBoardMode(boardMode?.kind === 'move' ? null : { kind: 'move', squares: o.move!.squares })}>
              Move (up to {o.move.maxSquares} sq)
            </button>
          )}
          {o.run && (
            <button
              className={boardMode?.kind === 'run' ? 'on' : ''}
              title="Uses the whole round: no attacks and no parries"
              onClick={() => setBoardMode(boardMode?.kind === 'run' ? null : { kind: 'run', squares: o.run!.squares })}
            >
              Run (up to {o.run.maxSquares} sq, whole round)
            </button>
          )}
          {o.canAim && <button onClick={() => onAnswer({ kind: 'aim' })}>Aim (+1, max +3)</button>}
          {o.canReload && <button onClick={() => onAnswer({ kind: 'reload' })}>Reload ({o.reloadInfo})</button>}
          {o.loadouts.map((lo) => (
            <button key={lo.index} onClick={() => onAnswer({ kind: 'ready', loadout: lo.index })}>
              Switch to {lo.name}
            </button>
          ))}
          {o.canIntimidate && (
            <button title="Spend the whole round staring the opposition down: they roll PSY against your hero status or fight at a penalty (HH)" onClick={() => onAnswer({ kind: 'intimidate' })}>
              Psych out the opponent (whole round)
            </button>
          )}
          {o.canDefensive && (
            <button title="Act last in each opportunity, must parry, leave no exposed area; +2 parry per extra action" onClick={() => onAnswer({ kind: 'defensive' })}>
              Fight defensively this round
            </button>
          )}
          <button onClick={() => onAnswer({ kind: 'hold' })} title="End your turn in this opportunity, keeping the action for a parry">
            Wait (keep action to parry)
          </button>
        </div>
        {boardMode && <p className="muted small">Click a highlighted square on the battlefield.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const BODY_LAYOUT: (Location | null)[][] = [
  [null, 'head', null],
  ['rightArm', 'chest', 'leftArm'],
  [null, 'abdomen', null],
  ['rightLeg', null, 'leftLeg'],
];

/** How a manoeuvre changes the CL shown in the body grid. */
function maneuverShift(m: Maneuver | null, fv: number): number {
  switch (m) {
    case 'double':
      return Math.floor(fv / 2) - fv;
    case 'triple':
      return Math.floor(fv / 3) - fv;
    case 'lightning':
      return -10;
    case 'heroPainStrike':
      return -7;
    case 'breakWeapon':
      return -6;
    default:
      return 0;
  }
}

function AttackChooser({ options, onChoose, heroPoints }: { options: AttackOption[]; onChoose: (c: AttackChoice) => void; heroPoints: number }) {
  const [sel, setSel] = useState(0);
  const [techs, setTechs] = useState<string[]>([]);
  const [maneuver, setManeuver] = useState<Maneuver | null>(null);
  const [heroPoint, setHeroPoint] = useState(false);
  const opt = options[Math.min(sel, options.length - 1)];
  if (!opt) return null;
  const byLoc = new Map<Location, LocOption>(opt.locations.map((l) => [l.location, l]));
  const m = opt.maneuvers.some((x) => x.id === maneuver) ? maneuver : null;
  const shift = maneuverShift(m, opt.fv);
  const choose = (location: Location | 'wild') =>
    onChoose({
      kind: 'attack',
      targetId: opt.targetId,
      weapon: opt.weapon,
      location,
      techniques: techs.filter((t) => opt.techniques.some((x) => x.id === t)),
      maneuver: m ?? undefined,
      heroPoint: heroPoint && heroPoints > 0,
    });

  return (
    <div className="attack">
      {options.length > 1 && (
        <div className="row wrap">
          {options.map((x, i) => (
            <button key={i} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
              {x.weaponName} → {x.targetName}
            </button>
          ))}
        </div>
      )}
      <p className="small muted">
        {opt.weaponName} against {opt.targetName}. {opt.exposed ? `Exposed area: ${LOCATION_NAMES[opt.exposed].toLowerCase()} (no penalty).` : 'No exposed area – every location is aimed.'}
      </p>
      <div className="attack-body">
        <div className="body-grid">
          {BODY_LAYOUT.flat().map((loc, i) =>
            loc ? (
              <button
                key={i}
                className={`loc ${byLoc.get(loc)!.exposed ? 'exposed' : ''}`}
                title={describeCl(byLoc.get(loc)!.cl) + (shift ? ` (${shift} for the manoeuvre)` : '')}
                onClick={() => choose(loc)}
              >
                <span>{LOCATION_NAMES[loc]}</span>
                <strong>
                  CL {byLoc.get(loc)!.cl.cl + shift}
                  {m === 'double' ? ' ×2' : m === 'triple' ? ' ×3' : ''}
                </strong>
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <div className="attack-side">
          <ClButton cl={opt.wild} label="Wild swing (random location)" onClick={() => choose('wild')} />
          {opt.maneuvers.length > 0 && (
            <fieldset className="techs">
              <legend>Hero manoeuvre (replaces a normal attack)</legend>
              <label>
                <input type="radio" checked={!m} onChange={() => setManeuver(null)} /> Normal attack
              </label>
              {opt.maneuvers.map((x) => (
                <label key={x.id} title={x.description}>
                  <input type="radio" checked={m === x.id} onChange={() => setManeuver(x.id)} /> {x.name} <span className="muted small">– {x.description}</span>
                </label>
              ))}
              {m && <p className="muted small">{m === 'breakWeapon' ? 'Click any location to make the attempt.' : 'The body grid shows the CL for the manoeuvre.'}</p>}
            </fieldset>
          )}
          {heroPoints > 0 && (
            <label className="hero-point" title="Höja CL: fumble → failure, failure → success, success → perfect (a perfect refunds the point)">
              <input type="checkbox" checked={heroPoint} onChange={(e) => setHeroPoint(e.target.checked)} /> Spend a hero point on this roll ({heroPoints} left)
            </label>
          )}
          {opt.techniques.length > 0 && (
            <fieldset className="techs">
              <legend>Techniques (rolled first; once per round)</legend>
              {opt.techniques.map((t) => (
                <label key={t.id} title={t.description}>
                  <input type="checkbox" checked={techs.includes(t.id)} onChange={(e) => setTechs(e.target.checked ? [...techs, t.id] : techs.filter((x) => x !== t.id))} /> {t.name}{' '}
                  <span className="muted small">
                    FV {t.fv} – {t.description}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>
    </div>
  );
}

function ClButton({ cl, label, onClick, primary }: { cl: ClResult; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button className={primary ? 'primary' : ''} title={describeCl(cl)} onClick={onClick}>
      {label} <strong>CL {cl.cl}</strong>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Magic (§22)
// ---------------------------------------------------------------------------

function MagicPanel({ magic, heroPoints, onAnswer }: { magic: MagicOptions; heroPoints: number; onAnswer: (a: DecisionAnswer) => void }) {
  const k = magic.casting;
  if (!k) return <SpellChooser spells={magic.spells} heroPoints={heroPoints} onAnswer={onAnswer} />;
  return (
    <div className="spells">
      <CastingPanel k={k} heroPoints={heroPoints} onAnswer={onAnswer} />
      {magic.spells.length > 0 && (
        <details>
          <summary className="small">Start a different spell instead (the {k.sv} is lost, 1 PSY)</summary>
          <SpellChooser spells={magic.spells} heroPoints={heroPoints} onAnswer={onAnswer} />
        </details>
      )}
    </div>
  );
}

function CastingPanel({ k, heroPoints, onAnswer }: { k: CastingInfo; heroPoints: number; onAnswer: (a: DecisionAnswer) => void }) {
  const head = (
    <p className="small">
      {k.suicide ? <strong className="bad">Suicide spell: </strong> : null}
      <strong>
        {k.sv} E{k.e}
      </strong>{' '}
      ({k.name}) – {k.done}/{k.total} actions done. Anything but <em>Wait</em> gives the spell up (1 PSY); a wound breaks it too.
    </p>
  );
  if (!k.ready)
    return (
      <div className="spell-detail">
        {head}
        <button className="primary" onClick={() => onAnswer({ kind: 'castContinue' })}>
          Continue casting (action {k.done + 1}/{k.total})
        </button>
      </div>
    );
  if (k.reactionOnly)
    return (
      <div className="spell-detail">
        {head}
        <p className="small">The shield is ready: it is offered as a parry (CL {k.cl.cl}) when you are attacked. Wait to keep it.</p>
      </div>
    );
  return (
    <div className="spell-detail">
      {head}
      <TargetPicker
        targets={k.targets}
        aimable={k.aimable}
        clText={`CL ${k.cl.cl}`}
        clTitle={describeCl(k.cl)}
        heroPoints={heroPoints}
        verb="Release"
        onPick={(target, heroPoint) => onAnswer({ kind: 'castRelease', target, heroPoint })}
      />
    </div>
  );
}

function SpellChooser({ spells, heroPoints, onAnswer }: { spells: SpellOption[]; heroPoints: number; onAnswer: (a: DecisionAnswer) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [e, setE] = useState(1);
  const [suicide, setSuicide] = useState(false);
  const sp = spells.find((x) => x.id === sel) ?? null;
  const max = sp ? (suicide && sp.suicideMaxE ? sp.suicideMaxE : sp.maxE) : 1;
  const grade = Math.min(Math.max(1, e), max);
  const cl = sp ? (suicide ? { ...sp.cls[0], mods: [], cl: sp.s, notes: ['suicide spell: unmodified S'] } : sp.cls[grade - 1]) : null;
  return (
    <div className="spells">
      <div className="spell-pick">
        {spells.map((x) => (
          <button key={x.id} className={x.id === sel ? 'on' : ''} title={x.description} onClick={() => setSel(x.id === sel ? null : x.id)}>
            {x.sv} <span className="muted small">S {x.s} · {x.actions === 1 ? '1 action' : `${x.actions} actions`}</span>
          </button>
        ))}
      </div>
      {sp && cl && (
        <div className="spell-detail">
          <p className="small">
            <strong>{sp.name}</strong> {sp.physical ? '(physical)' : '(must beat the target’s PSY)'} – {sp.description}
          </p>
          <label>
            Effect grade E{grade}{' '}
            <input type="range" min={1} max={max} value={grade} onChange={(ev) => setE(Number(ev.target.value))} />{' '}
            <strong title={describeCl(cl)}>CL {cl.cl}</strong> · <span className="psy-cost">{grade} PSY</span>
            <span className="muted small"> (1 on a failure, half on a perfect)</span>
          </label>
          {sp.suicideMaxE > 0 && (
            <label className="hero-point" title="III 225: spend your remaining PSY plus half your normal PSY; CL is your unmodified S whatever the grade – and you die when PSY drops below 0">
              <input type="checkbox" checked={suicide} onChange={(ev) => setSuicide(ev.target.checked)} /> Suicide spell – up to E{sp.suicideMaxE}, CL = S {sp.s}, you die if PSY drops below 0
            </label>
          )}
          <div className="row wrap">
            {sp.actions === 1 ? (
              <TargetPicker
                targets={sp.targets}
                aimable={sp.aimable}
                clText={`CL ${cl.cl}`}
                clTitle={describeCl(cl)}
                heroPoints={heroPoints}
                verb="Cast"
                onPick={(target, heroPoint) => onAnswer({ kind: 'cast', spell: sp.id, e: grade, suicide, target, heroPoint })}
              />
            ) : (
              <>
                <button className="primary" onClick={() => onAnswer({ kind: 'cast', spell: sp.id, e: grade, suicide })}>
                  {sp.reactionOnly ? 'Prepare the shield' : 'Begin casting'} (action 1/{sp.actions})
                </button>
                <span className="muted small">
                  {sp.reactionOnly
                    ? 'Once prepared it is offered as a parry.'
                    : `The target is chosen when you release it.${sp.targets.length ? '' : ' Nothing is in range right now.'}`}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TargetPicker(p: {
  targets: SpellTargetOption[];
  aimable: boolean;
  clText: string;
  clTitle: string;
  heroPoints: number;
  verb: string;
  onPick: (t: SpellTarget, heroPoint: boolean) => void;
}) {
  const [loc, setLoc] = useState<Location>('head');
  const [heroPoint, setHeroPoint] = useState(false);
  if (!p.targets.length) return <p className="muted small">No target in range – wait, or move closer (which gives up the spell).</p>;
  return (
    <div>
      {p.aimable && (
        <label className="small">
          Aim at{' '}
          <select value={loc} onChange={(e) => setLoc(e.target.value as Location)}>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {LOCATION_NAMES[l]}
              </option>
            ))}
          </select>{' '}
          <span className="muted">(the caster directs it – no aiming penalty)</span>
        </label>
      )}
      <div className="row wrap">
        {p.targets.map((t, i) => (
          <button key={i} className="primary" title={p.clTitle} onClick={() => p.onPick(p.aimable ? { ...t.target, location: loc } : t.target, heroPoint && p.heroPoints > 0)}>
            {p.verb} {t.label === 'yourself' ? 'on yourself' : `at ${t.label}`} <strong>{p.clText}</strong>
          </button>
        ))}
      </div>
      {p.heroPoints > 0 && (
        <label className="hero-point" title="Höja CL: fumble → failure, failure → success, success → perfect (a perfect refunds the point)">
          <input type="checkbox" checked={heroPoint} onChange={(e) => setHeroPoint(e.target.checked)} /> Spend a hero point on the casting roll ({p.heroPoints} left)
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ParryPrompt({ request, name, onAnswer }: { request: Extract<DecisionRequest, { kind: 'parry' }>; name: string; onAnswer: (a: DecisionAnswer) => void }) {
  const [heroPoint, setHeroPoint] = useState(false);
  const a = request.attack;
  const where = a.location === 'wild' ? 'a wild swing' : `your ${LOCATION_NAMES[a.location].toLowerCase()}`;
  return (
    <div>
      <h3>{name}: parry?</h3>
      <p>
        {a.attackerName} {a.ranged ? 'shoots/throws' : 'attacks'} with {a.weaponName} at {where}: CL {a.cl}, rolled {a.roll} – <strong>{a.outcome}</strong>.
        {request.mustParry ? ' You are fighting defensively and must parry.' : ' Parrying uses an action in this opportunity.'}
      </p>
      <div className="row wrap">
        {request.options.map((o, i) => (
          <ClButton key={i} cl={o.cl} label={`Parry with ${o.name}`} onClick={() => onAnswer(heroPoint ? { index: i, heroPoint: true } : i)} primary={i === 0} />
        ))}
        {!request.mustParry && <button onClick={() => onAnswer(null)}>Don’t parry</button>}
      </div>
      {request.heroPoints > 0 && (
        <label className="hero-point" title="Höja CL: fumble → failure, failure → success, success → perfect (a perfect refunds the point)">
          <input type="checkbox" checked={heroPoint} onChange={(e) => setHeroPoint(e.target.checked)} /> Spend a hero point on the parry ({request.heroPoints} left)
        </label>
      )}
    </div>
  );
}
