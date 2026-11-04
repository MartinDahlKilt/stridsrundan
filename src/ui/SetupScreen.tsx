import { useState } from 'react';
import { PRESETS } from '../data/presets';
import { DEFAULT_RULES, type RulesConfig } from '../engine/rules';
import type { FightConfig } from './App';
import { CharacterEditor, newCustom } from './CharacterEditor';
import { characterById, isCustomId, type CustomCharacter } from './customCharacters';
import { SheetCard } from './SheetCard';

export interface SideSetup {
  presetId: string;
  controller: 'human' | 'ai';
}

interface Props {
  initial: FightConfig | null;
  customs: CustomCharacter[];
  onCustomsChange: (list: CustomCharacter[]) => void;
  onStart: (c: FightConfig) => void;
}

export function SetupScreen({ initial, customs, onCustomsChange, onStart }: Props) {
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
  // The character being edited, and the side that gets it when saved.
  const [editing, setEditing] = useState<{ side: number; character: CustomCharacter; isNew: boolean } | null>(null);
  const sheetOf = (id: string) => characterById(id, customs);
  const visibleCustoms = customs.filter((c) => r.easternWarriors || !c.sheet.eastern);

  const startNew = (side: number) => {
    setEditing({ side, character: newCustom(sheetOf(sides[side].presetId)), isNew: true });
  };
  const startEdit = (side: number) => {
    const c = customs.find((x) => x.id === sides[side].presetId);
    if (c) setEditing({ side, character: structuredClone(c), isNew: false });
  };
  const save = (c: CustomCharacter) => {
    const exists = customs.some((x) => x.id === c.id);
    onCustomsChange(exists ? customs.map((x) => (x.id === c.id ? c : x)) : [...customs, c]);
    update(editing!.side, { presetId: c.id });
    setEditing(null);
  };
  const remove = (id: string) => {
    onCustomsChange(customs.filter((x) => x.id !== id));
    setSides(sides.map((s) => (s.presetId === id ? { ...s, presetId: 'knight' } : s)));
    setEditing(null);
  };

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
              <optgroup label="Presets">
                {PRESETS.filter((p) => r.easternWarriors || !p.eastern).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.hero ? '★ ' : p.magic ? '✦ ' : ''}
                    {p.name} – {p.professionName}
                  </option>
                ))}
              </optgroup>
              {visibleCustoms.length > 0 && (
                <optgroup label="Your characters">
                  {visibleCustoms.map((c) => (
                    <option key={c.id} value={c.id}>
                      ✎ {c.sheet.hero ? '★ ' : c.sheet.magic ? '✦ ' : ''}
                      {c.sheet.name} – {c.sheet.professionName}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="row custom-actions">
              <button className="small" onClick={() => startNew(i)} title="Make your own character, starting from the one selected">
                ✎ New character…
              </button>
              {isCustomId(s.presetId) && (
                <button className="small" onClick={() => startEdit(i)}>
                  Edit
                </button>
              )}
            </div>
            <SheetCard sheet={sheetOf(s.presetId)} rules={r} />
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
                if (!e.target.checked) setSides(sides.map((s) => (sheetOf(s.presetId).eastern ? { ...s, presetId: 'knight' } : s)));
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
      {editing && (
        <CharacterEditor
          key={editing.character.id}
          initial={editing.character}
          rules={r}
          isNew={editing.isNew}
          onSave={save}
          onCancel={() => setEditing(null)}
          onDelete={editing.isNew ? undefined : () => remove(editing.character.id)}
        />
      )}
    </div>
  );
}
