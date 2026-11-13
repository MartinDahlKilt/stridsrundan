import { useMemo, useState } from 'react';
import { PRESETS } from '../data/presets';
import { DEFAULT_RULES, type RulesConfig } from '../engine/rules';
import { createCombat, placeFighters } from '../engine/state';
import type { Pos } from '../engine/types';
import { Battlefield } from './Battlefield';
import type { FightConfig } from './App';
import { CharacterEditor, newCustom } from './CharacterEditor';
import { characterById, isCustomId, type CustomCharacter } from './customCharacters';
import { SheetCard } from './SheetCard';

/** One fighter in the line-up. `key` is stable for React; `pos` is the starting square. */
export interface FighterSetup {
  key: string;
  presetId: string;
  controller: 'human' | 'ai';
  team: number;
  pos?: Pos;
  /** Starts hidden from the enemy – the only way to steal up behind someone unnoticed. */
  hidden?: boolean;
}

interface Props {
  initial: FightConfig | null;
  customs: CustomCharacter[];
  onCustomsChange: (list: CustomCharacter[]) => void;
  onStart: (c: FightConfig) => void;
}

const MAX_PER_SIDE = 6;
const SIDE_NAMES = ['A', 'B'];
let nextKey = 1;
const newKey = () => `f${nextKey++}-${Date.now().toString(36)}`;

/** Give every fighter a square: the ones they have, the default line-up for the rest. */
function withPositions(list: FighterSetup[]): FighterSetup[] {
  const pos = placeFighters(list);
  return list.map((f, i) => ({ ...f, pos: pos[i] }));
}

export function SetupScreen({ initial, customs, onCustomsChange, onStart }: Props) {
  const [fighters, setFighters] = useState<FighterSetup[]>(() =>
    withPositions(
      initial?.fighters ?? [
        { key: newKey(), presetId: 'knight', controller: 'human', team: 0 },
        { key: newKey(), presetId: 'barbarian', controller: 'ai', team: 1 },
      ],
    ),
  );
  const [seed, setSeed] = useState<number>(initial?.seed ?? Math.floor(Math.random() * 1e6));
  const [rules, setRules] = useState<Partial<RulesConfig>>(initial?.rules ?? {});
  const [pause, setPause] = useState(initial?.pauseAfterEachAction ?? false);
  const [selected, setSelected] = useState<string | null>(null);
  const r = { ...DEFAULT_RULES, ...rules };
  const noHuman = fighters.every((f) => f.controller === 'ai');
  // The character being edited, and the fighter that gets it when saved.
  const [editing, setEditing] = useState<{ fighter: string; character: CustomCharacter; isNew: boolean } | null>(null);
  const sheetOf = (id: string) => characterById(id, customs);
  const visibleCustoms = customs.filter((c) => r.easternWarriors || !c.sheet.eastern);

  const update = (key: string, patch: Partial<FighterSetup>) => setFighters(fighters.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const addFighter = (team: number) => {
    const last = [...fighters].reverse().find((f) => f.team === team);
    setFighters(withPositions([...fighters, { key: newKey(), presetId: last?.presetId ?? 'mercenary', controller: 'ai', team }]));
  };
  const removeFighter = (key: string) => setFighters(fighters.filter((f) => f.key !== key));

  const startNew = (key: string) => {
    const f = fighters.find((x) => x.key === key)!;
    setEditing({ fighter: key, character: newCustom(sheetOf(f.presetId)), isNew: true });
  };
  const startEdit = (key: string) => {
    const c = customs.find((x) => x.id === fighters.find((f) => f.key === key)?.presetId);
    if (c) setEditing({ fighter: key, character: structuredClone(c), isNew: false });
  };
  const save = (c: CustomCharacter) => {
    const exists = customs.some((x) => x.id === c.id);
    onCustomsChange(exists ? customs.map((x) => (x.id === c.id ? c : x)) : [...customs, c]);
    update(editing!.fighter, { presetId: c.id });
    setEditing(null);
  };
  const remove = (id: string) => {
    onCustomsChange(customs.filter((x) => x.id !== id));
    setFighters(fighters.map((f) => (f.presetId === id ? { ...f, presetId: 'knight' } : f)));
    setEditing(null);
  };

  // The battlefield as it will start: real combatants, so facing and names match the fight.
  const preview = useMemo(
    () => createCombat(fighters.map((f) => ({ sheet: sheetOf(f.presetId), team: f.team, controller: f.controller, pos: f.pos, hidden: f.hidden })), 1, rules).state,
    [fighters, customs, rules],
  );
  const selectedIndex = fighters.findIndex((f) => f.key === selected);
  const onSquare = (p: Pos) => {
    const at = fighters.find((f) => f.pos && f.pos.x === p.x && f.pos.y === p.y);
    if (at) setSelected(at.key === selected ? null : at.key);
    else if (selected) {
      update(selected, { pos: p });
      setSelected(null);
    }
  };

  return (
    <div className="setup">
      <header className="setup-header">
        <h1>Stridsrundan</h1>
        <p className="subtitle">a combat simulator for Drakar och Demoner</p>
        <div className="ornament" aria-hidden="true">❦</div>
        <p className="muted">
          Detailed combat from <em>Krigarens Handbok</em>, with the basic rules where it is silent. Pick the fighters on each side and place them on the
          battlefield – by default the sides start about 20 m apart.
        </p>
      </header>

      <div className="setup-sides">
        {[0, 1].map((team) => {
          const list = fighters.filter((f) => f.team === team);
          return (
            <section key={team} className={`side-card team-${team}`}>
              <div className="side-head">
                <h2>Side {SIDE_NAMES[team]}</h2>
                <button className="small" disabled={list.length >= MAX_PER_SIDE} onClick={() => addFighter(team)}>
                  + Add fighter
                </button>
              </div>
              {list.map((f, n) => (
                <div key={f.key} className={`fighter ${f.key === selected ? 'selected' : ''}`}>
                  <div className="fighter-head">
                    <select value={f.presetId} onChange={(e) => update(f.key, { presetId: e.target.value })} aria-label={`Side ${SIDE_NAMES[team]} fighter ${n + 1}`}>
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
                    <div className="seg">
                      {(['human', 'ai'] as const).map((ctl) => (
                        <button key={ctl} className={f.controller === ctl ? 'on' : ''} onClick={() => update(f.key, { controller: ctl })}>
                          {ctl === 'human' ? 'Human' : 'Computer'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="row custom-actions">
                    <button className="small" onClick={() => startNew(f.key)} title="Make your own character, starting from the one selected">
                      ✎ New character…
                    </button>
                    {isCustomId(f.presetId) && (
                      <button className="small" onClick={() => startEdit(f.key)}>
                        Edit
                      </button>
                    )}
                    {r.flanking && (
                      <label className="small" title="Hidden from the enemy at the start: only a hidden fighter can steal up behind someone (Smyga vs Upptäcka fara). Lost once it attacks, shoots, casts or is attacked.">
                        <input type="checkbox" checked={!!f.hidden} onChange={(e) => update(f.key, { hidden: e.target.checked })} /> Hidden
                      </label>
                    )}
                    <button className="small" onClick={() => setSelected(f.key === selected ? null : f.key)} title="Pick a starting square on the map below">
                      ◎ Place
                    </button>
                    {list.length > 1 && (
                      <button className="small" onClick={() => removeFighter(f.key)} title="Remove this fighter">
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <details open={list.length === 1}>
                    <summary>Character sheet</summary>
                    <SheetCard sheet={sheetOf(f.presetId)} rules={r} />
                  </details>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <section className="setup-map sheet">
        <h3>Battlefield</h3>
        <p className="muted small">
          {selectedIndex >= 0
            ? `Click a square to place ${preview.combatants[selectedIndex].sheet.name}, or the token again to cancel.`
            : 'Click a token, then a square, to move a fighter. The notch on each token shows which way it faces – everyone starts facing the nearest enemy.'}
        </p>
        <Battlefield
          state={preview}
          highlight={null}
          highlightKind={null}
          onSquare={onSquare}
          anySquare
          activeId={selectedIndex >= 0 ? preview.combatants[selectedIndex].id : null}
        />
        <button className="small" onClick={() => setFighters(withPositions(fighters.map((f) => ({ ...f, pos: undefined }))))}>
          Reset to the default line-up
        </button>
      </section>

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
                if (!e.target.checked) setFighters(fighters.map((f) => (sheetOf(f.presetId).eastern ? { ...f, presetId: 'knight' } : f)));
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
            <input type="checkbox" checked={r.flanking} onChange={(e) => setRules({ ...rules, flanking: e.target.checked })} /> Facing: attacks from the side +3 CL,
            from behind +7; a fighter hidden from the start that steals up behind someone unnoticed (Smyga vs Upptäcka fara) can’t be parried
          </label>
          <label>
            Wind (m/s, from the side){' '}
            <input type="number" min={0} max={20} value={r.windMs} onChange={(e) => setRules({ ...rules, windMs: Number(e.target.value) })} />
          </label>
        </details>
        {noHuman && <p className="warn">Every fighter is computer-controlled – you will watch the fight.</p>}
        <button className="seal" onClick={() => onStart({ fighters, seed, rules, pauseAfterEachAction: pause })}>
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
