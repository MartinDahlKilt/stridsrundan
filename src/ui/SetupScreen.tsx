import { useMemo, useState } from 'react';
import { armourDef } from '../data/armour';
import { itemDef } from '../data/items';
import { PRESETS, presetById } from '../data/presets';
import { SCHOOL_NAMES, spellDef } from '../data/spells';
import { castActions } from '../engine/magic';
import { countActions, createCombatant, weaponFV } from '../engine/character';
import { applyRuleOptions, DEFAULT_RULES, type RulesConfig } from '../engine/rules';
import { TECHNIQUES } from '../engine/requests';
import { HERO_ABILITY_NAMES, HERO_STATUS } from './labels';
import { ATTRIBUTE_NAMES, type Attribute, type MagicSchool } from '../engine/types';
import type { FightConfig } from './App';

export interface SideSetup {
  presetId: string;
  controller: 'human' | 'ai';
}

export function SetupScreen({ initial, onStart }: { initial: FightConfig | null; onStart: (c: FightConfig) => void }) {
  const [sides, setSides] = useState<SideSetup[]>(
    initial?.sides ?? [
      { presetId: 'knight', controller: 'human' },
      { presetId: 'barbarian', controller: 'ai' },
    ],
  );
  const [seed, setSeed] = useState<number>(initial?.seed ?? Math.floor(Math.random() * 1e6));
  const [rules, setRules] = useState<Partial<RulesConfig>>(initial?.rules ?? {});
  const [pause, setPause] = useState(initial?.pauseAfterEachAction ?? false);
  const r = { ...DEFAULT_RULES, ...rules };
  const noHuman = sides.every((s) => s.controller === 'ai');

  const update = (i: number, patch: Partial<SideSetup>) => setSides(sides.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="setup">
      <header className="setup-header">
        <h1>Stridsrundan</h1>
        <p className="subtitle">a combat simulator for Drakar och Demoner</p>
        <div className="ornament" aria-hidden="true">❦</div>
        <p className="muted">
          Detailed combat from <em>Krigarens Handbok</em>, with the basic rules where it is silent. Pick two fighters; they start about 20 m apart.
        </p>
      </header>

      <div className="setup-sides">
        {sides.map((s, i) => (
          <section key={i} className={`side-card team-${i}`}>
            <div className="side-head">
              <h2>Side {i === 0 ? 'A' : 'B'}</h2>
              <div className="seg">
                {(['human', 'ai'] as const).map((ctl) => (
                  <button key={ctl} className={s.controller === ctl ? 'on' : ''} onClick={() => update(i, { controller: ctl })}>
                    {ctl === 'human' ? 'Human' : 'Computer'}
                  </button>
                ))}
              </div>
            </div>
            <select value={s.presetId} onChange={(e) => update(i, { presetId: e.target.value })}>
              {PRESETS.filter((p) => r.easternWarriors || !p.eastern).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.hero ? '★ ' : p.magic ? '✦ ' : ''}
                  {p.name} – {p.professionName}
                </option>
              ))}
            </select>
            <PresetCard id={s.presetId} rules={r} />
          </section>
        ))}
      </div>

      <section className="setup-options">
        <h3>Options</h3>
        <label>
          Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          <button className="small" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>
            New
          </button>
        </label>
        <label>
          <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} /> Pause after each computer action
        </label>
        <details>
          <summary>Rules options</summary>
          <label>
            <input
              type="checkbox"
              checked={r.perfectAttackParry === 'perfectParry'}
              onChange={(e) => setRules({ ...rules, perfectAttackParry: e.target.checked ? 'perfectParry' : 'never' })}
            />{' '}
            House rule: a perfect parry can stop a perfect attack
          </label>
          <label>
            <input type="checkbox" checked={r.sbOnSp} onChange={(e) => setRules({ ...rules, sbOnSp: e.target.checked })} /> Damage bonus also adds to SP (pain)
          </label>
          <label>
            <input type="checkbox" checked={r.longerWeaponStrikesFirst} onChange={(e) => setRules({ ...rules, longerWeaponStrikesFirst: e.target.checked })} /> Longer weapon
            strikes first when closing in
          </label>
          <label>
            Offer “roll with the blow” at SP ≥{' '}
            <input type="number" min={1} max={20} value={r.rollWithBlowThreshold} onChange={(e) => setRules({ ...rules, rollWithBlowThreshold: Number(e.target.value) })} />
          </label>
          <label>
            <input
              type="checkbox"
              checked={r.easternWarriors}
              onChange={(e) => {
                setRules({ ...rules, easternWarriors: e.target.checked });
                if (!e.target.checked) setSides(sides.map((s) => (presetById(s.presetId).eastern ? { ...s, presetId: 'knight' } : s)));
              }}
            />{' '}
            Eastern warriors (Österländska krigare): eastern martial-art techniques such as projectile parry, eastern weapons and professions
          </label>
          <label>
            Fumbles at FV above 20:{' '}
            <select value={r.heroicFumble} onChange={(e) => setRules({ ...rules, heroicFumble: e.target.value as 'hh' | 'base' })}>
              <option value="hh">Hjältarnas Handbok – after a 20, a 2nd roll above FV/2 (always 16–20) fumbles</option>
              <option value="base">Basic rules – only two 20s in a row</option>
            </select>
          </label>
          <label>
            Favoured by the gods: chance to be restored at 0 KP{' '}
            <input type="number" min={25} max={50} value={r.favouredByGodsChance} onChange={(e) => setRules({ ...rules, favouredByGodsChance: Number(e.target.value) })} /> %
          </label>
          <label>
            Wind (m/s, from the side){' '}
            <input type="number" min={0} max={20} value={r.windMs} onChange={(e) => setRules({ ...rules, windMs: Number(e.target.value) })} />
          </label>
        </details>
        {noHuman && <p className="warn">Both sides are computer-controlled – you will watch the fight.</p>}
        <button className="seal" onClick={() => onStart({ sides, seed, rules, pauseAfterEachAction: pause })}>
          ⚔ To battle! ⚔
        </button>
      </section>
    </div>
  );
}

function PresetCard({ id, rules }: { id: string; rules: RulesConfig }) {
  const base = presetById(id);
  const p = applyRuleOptions(base, rules);
  const disabled = (base.martialArtTechniques ?? []).filter((t) => !(p.martialArtTechniques ?? []).includes(t));
  const info = useMemo(() => {
    const c = createCombatant(p, 'preview', 0, 'ai', { x: 0, y: 0 });
    return { c, actions: countActions(c) };
  }, [base, rules.easternWarriors]);
  const { c, actions } = info;
  const d = c.derived;
  return (
    <div className="preset">
      <p className="muted">{p.description}</p>
      <table className="attrs">
        <tbody>
          <tr>
            {(Object.keys(p.attributes) as Attribute[]).map((a) => (
              <th key={a} title={ATTRIBUTE_NAMES[a]}>
                {a}
              </th>
            ))}
          </tr>
          <tr>
            {(Object.keys(p.attributes) as Attribute[]).map((a) => (
              <td key={a}>{p.attributes[a]}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <dl className="stats">
        <dt title="Kroppspoäng – hit points">HP (KP)</dt>
        <dd>{d.kpTotalMax}</dd>
        <dt title="Smärtpoäng – pain points">Pain (SP)</dt>
        <dd>{d.spTotalMax}</dd>
        <dt title="Skadebonus">Damage bonus</dt>
        <dd>{d.sbText === '0' ? '–' : d.sbText}</dd>
        <dt title="Förflyttning, squares of 1.5 m per round">Movement</dt>
        <dd>
          {d.ffBase + d.loadPenalty} sq
        </dd>
        <dt>Actions / round</dt>
        <dd title={actions.parts.map((x) => `${x.label} ${x.value > 0 ? '+' : ''}${x.value}`).join(', ')}>{actions.total}</dd>
        <dt title="Load: worn armour counts half">Load</dt>
        <dd>
          {d.load} kg{d.loadPenalty ? ` (${d.loadPenalty} SMI/move)` : ''}
        </dd>
      </dl>
      <div className="gear">
        <strong>Weapons:</strong>{' '}
        {Object.values(p.equipment.items)
          .map((it) => {
            const def = itemDef(it.def);
            return `${def.name}${it.count && it.count > 1 ? ` ×${it.count}` : ''} (FV ${weaponFV(p, it.def)})`;
          })
          .join(', ') || `Unarmed (martial art FV ${p.skills.martialArt ?? p.skills.brawling ?? 0})`}
        {p.equipment.ammo &&
          Object.entries(p.equipment.ammo).map(([k, v]) => (
            <span key={k}>
              {' '}
              · {v} {k}s
            </span>
          ))}
        <br />
        <strong>Armour:</strong> {p.equipment.armour.map((a) => armourDef(a).name).join(', ')} ({d.armourWeightAdjusted} kg)
        {p.techniques && (
          <>
            <br />
            <strong>Techniques:</strong> {Object.keys(p.techniques).map((t) => TECHNIQUES[t]?.name ?? t).join(', ')}
          </>
        )}
        {p.hero && (
          <>
            <br />
            <strong>★ {p.hero.dark ? 'Dark hero' : 'Hero'}:</strong> {HERO_STATUS[p.hero.status]}, {p.hero.heroPoints} hero points
            {p.hero.abilities.length > 0 && <> – {p.hero.abilities.map((a) => HERO_ABILITY_NAMES[a]).join(', ')}</>}
          </>
        )}
        {p.magic && (
          <>
            <br />
            <strong>✦ Magic:</strong> {(Object.entries(p.magic.schools) as [MagicSchool, number][]).map(([sch, fv]) => `${SCHOOL_NAMES[sch]} FV ${fv}`).join(', ')} · PSY {p.attributes.PSY}
            {p.magic.staffPsy ? ` + ${p.magic.staffPsy} in the staff` : ''}
            <br />
            <strong>Spells:</strong>{' '}
            {Object.entries(p.magic.spells)
              .map(([id, sv]) => {
                const def = spellDef(id);
                const n = castActions(def, sv);
                return `${def.sv} S${sv} (${n} action${n === 1 ? '' : 's'})`;
              })
              .join(', ')}
          </>
        )}
        {p.martialArtTechniques && (
          <>
            <br />
            <strong>Martial art:</strong> {p.martialArtTechniques.map(techName).join(', ')}
            {disabled.length > 0 && <span className="muted"> (off: {disabled.map(techName).join(', ')} – needs the eastern-warriors option)</span>}
          </>
        )}
      </div>
    </div>
  );
}

const TECH_NAMES: Record<string, string> = {
  crushingPunch: 'Crushing punch',
  roundKick: 'Round kick',
  jumpKick: 'Jump kick',
  fallingKick: 'Falling kick',
  feint: 'Feint',
  initiativeBonus: 'Initiative bonus',
  unarmedWeaponParry: 'Unarmed weapon parry',
  projectileParry: 'Projectile parry',
  predictAttack: 'Predict attack',
  kiai: 'Kiai',
  rollingAttack: 'Rolling attack',
  armouredFighting: 'Armoured fighting',
};

function techName(id: string): string {
  return TECH_NAMES[id] ?? id;
}
