import { useMemo, useState } from 'react';
import { armourDef } from '../data/armour';
import { ITEMS, itemDef } from '../data/items';
import { PRESETS } from '../data/presets';
import { RACES, raceDef, raceLabel } from '../data/races';
import { PROFESSIONS, professionDef, professionLabel } from '../data/professions';
import { classifySkills, setSheetSkill, sheetSkills, SKILLS, unmetRequirements, type SkillCategory } from '../data/skills';
import { EASTERN_TECHNIQUES, type RulesConfig } from '../engine/rules';
import { ATTRIBUTE_NAMES, type Attribute, type CharacterSheet, type ItemDef, type Race } from '../engine/types';
import { buildEquipment, weaponPicks, type CustomCharacter, type WeaponPick } from './customCharacters';
import { MARTIAL_TECHNIQUE_NAMES } from './labels';
import { SheetCard } from './SheetCard';

/** A newly added skill starts at a trained-but-ordinary level; the player sets the real value. */
const NEW_SKILL_FV = 10;

const ATTRS: Attribute[] = ['STY', 'FYS', 'SMI', 'INT', 'PSY', 'KAR', 'STO'];

const CATEGORY_LABEL: Record<SkillCategory, string> = { primary: 'Primary', profession: 'Profession', secondary: 'Secondary' };
const CATEGORY_TITLE: Record<SkillCategory, string> = {
  primary: 'Primary skill (primär färdighet): every character has it, no upper limit',
  profession: 'Profession skill (yrkesfärdighet): on the profession’s list, no upper limit',
  secondary: 'Secondary skill (sekundär färdighet): FV normally limited by its attribute',
};

/** The sheet as it will fight: equipment from the weapon picks, profession name and the eastern flag. */
export function finishSheet(c: CustomCharacter): CharacterSheet {
  const s = c.sheet;
  const prof = professionDef(s.profession);
  const equipment = buildEquipment(c.weapons, s.equipment.armour);
  const eastern =
    prof?.source === 'eastern' ||
    Object.values(equipment.items).some((it) => itemDef(it.def).eastern) ||
    equipment.armour.some((a) => armourDef(a).eastern) ||
    Object.keys(s.skills).some((k) => ITEMS[k]?.eastern);
  return { ...s, id: c.id, professionName: prof ? professionLabel(prof) : s.professionName, equipment, eastern: eastern || undefined };
}

/** A new custom character, starting as a copy of a fighter (its armour and any hero/magic features come along). */
export function newCustom(from: CharacterSheet): CustomCharacter {
  const id = `custom-${Date.now().toString(36)}`;
  const sheet: CharacterSheet = { ...structuredClone(from), id, name: `My ${from.name}`, description: `Custom character, started from ${from.name}.` };
  return { id, sheet, weapons: weaponPicks(from) };
}

/**
 * Change race: swap the old race's attribute modifiers and skill bonuses for the new one's (I 551–700),
 * and move STO into the new race's range.
 */
export function changeRace(sheet: CharacterSheet, race: Race): CharacterSheet {
  const from = raceDef(sheet.race);
  const to = raceDef(race);
  const attributes = { ...sheet.attributes };
  for (const a of ATTRS) if (a !== 'STO') attributes[a] = Math.max(1, attributes[a] - (from.mods[a] ?? 0) + (to.mods[a] ?? 0));
  if (attributes.STO < to.sto.min || attributes.STO > to.sto.max) attributes.STO = to.sto.normal;
  const skills = { ...sheet.skills };
  for (const k of new Set([...Object.keys(from.skillBonus ?? {}), ...Object.keys(to.skillBonus ?? {})])) {
    if (skills[k] === undefined) continue;
    skills[k] = Math.max(0, skills[k] - (from.skillBonus?.[k] ?? 0) + (to.skillBonus?.[k] ?? 0));
  }
  return { ...sheet, race, attributes, skills };
}

interface Props {
  initial: CustomCharacter;
  rules: RulesConfig;
  isNew: boolean;
  onSave: (c: CustomCharacter) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function CharacterEditor({ initial, rules, isNew, onSave, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<CustomCharacter>(initial);
  const [adding, setAdding] = useState('');
  const sheet = draft.sheet;
  const eastern = rules.easternWarriors;
  const setSheet = (patch: Partial<CharacterSheet>) => setDraft({ ...draft, sheet: { ...sheet, ...patch } });
  const finished = useMemo(() => finishSheet(draft), [draft]);
  const rows = classifySkills(sheet);
  const unmet = unmetRequirements(sheet);
  const prof = professionDef(sheet.profession);
  const race = raceDef(sheet.race);
  const stoOutside = sheet.attributes.STO < race.sto.min || sheet.attributes.STO > race.sto.max;
  const owned = new Set(sheetSkills(sheet).map(([k]) => k));
  const addable = SKILLS.filter((s) => !owned.has(s.key) && (eastern || !s.eastern));
  const groups = [...new Set(addable.map((s) => s.group))];

  const addSkill = (key: string) => {
    if (!key) return;
    const next = setSheetSkill(sheet, key, NEW_SKILL_FV);
    if (key === 'martialArt' && !next.martialArtTechniques) next.martialArtTechniques = [];
    setDraft({ ...draft, sheet: next });
    setAdding('');
  };
  const removeSkill = (key: string) => {
    const next = setSheetSkill(sheet, key, null);
    if (key === 'martialArt') delete next.martialArtTechniques;
    setDraft({ ...draft, sheet: next });
  };
  const setWeapons = (weapons: WeaponPick[]) => setDraft({ ...draft, weapons });
  const toggleTechnique = (t: string, on: boolean) => {
    const cur = sheet.martialArtTechniques ?? [];
    setSheet({ martialArtTechniques: on ? [...cur, t] : cur.filter((x) => x !== t) });
  };

  const professions = PROFESSIONS.filter((p) => eastern || p.source !== 'eastern' || p.id === sheet.profession);
  const usableItems = Object.values(ITEMS).filter((d) => eastern || !d.eastern);
  const armourSets = useMemo(() => {
    const seen = new Map<string, { label: string; armour: string[] }>();
    for (const p of PRESETS) {
      if (!eastern && p.eastern) continue;
      const k = p.equipment.armour.join(',');
      if (!seen.has(k)) seen.set(k, { label: `${p.equipment.armour.map((a) => armourDef(a).name).join(', ')} (as ${p.name})`, armour: p.equipment.armour });
    }
    return [...seen.entries()];
  }, [eastern]);
  const armourKey = sheet.equipment.armour.join(',');
  const canSave = sheet.name.trim().length > 0;

  return (
    <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label="Custom character">
      <div className="editor sheet">
        <header className="editor-head">
          <h2>{isNew ? 'New character' : 'Edit character'}</h2>
          <p className="muted small">
            Pick race, profession and the combat skills. Any skill can be given any FV – the sheet only notes where the basic rules
            would object.
          </p>
        </header>

        <div className="editor-body">
          <div className="editor-main">
            <section className="editor-section editor-grid">
              <label>
                Name
                <input type="text" value={sheet.name} onChange={(e) => setSheet({ name: e.target.value })} maxLength={40} />
              </label>
              <label title="Changing race swaps the racial attribute modifiers">
                Race
                <select value={sheet.race} onChange={(e) => setDraft({ ...draft, sheet: changeRace(sheet, e.target.value as Race) })}>
                  {RACES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {raceLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profession
                <select value={prof?.id ?? sheet.profession} onChange={(e) => setSheet({ profession: e.target.value as CharacterSheet['profession'] })}>
                  {(['basic', 'kh', 'eastern'] as const).map((src) => (
                    <optgroup key={src} label={src === 'basic' ? 'Basic rules' : src === 'kh' ? 'Krigarens Handbok' : 'Eastern warriors'}>
                      {professions
                        .filter((p) => p.source === src)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {professionLabel(p)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </section>
            <p className="small prof-ability">
              <strong>Race:</strong> {race.traits}
              {Object.keys(race.mods).length > 0 && (
                <span className="muted">
                  {' '}
                  · attributes{' '}
                  {(Object.entries(race.mods) as [Attribute, number][]).map(([a, m]) => `${a} ${m > 0 ? '+' : '−'}${Math.abs(m)}`).join(', ')}
                </span>
              )}
              <span className="muted">
                {' '}
                · STO {race.sto.min}–{race.sto.max}
              </span>
              .
            </p>
            {prof && (
              <p className="small prof-ability">
                <strong>Profession ability:</strong> {prof.ability}
                {!prof.abilityInSim && <span className="muted"> (not used by the simulator)</span>}.{' '}
                <span className="muted">
                  Profession skills: {prof.weaponSkills === 'any' ? 'any weapon skills' : prof.weaponSkills === 0 ? 'no weapon skills' : `up to ${prof.weaponSkills} weapon skills`}
                  {prof.skills.length > 0 && `, ${prof.skills.map(listName).join(', ')}`}; {prof.maxProfessionSkills} in all.
                  {prof.note && ` ${prof.note}`}
                </span>
              </p>
            )}

            <section className="editor-section">
              <h4>Attributes</h4>
              <div className="attr-inputs">
                {ATTRS.map((a) => (
                  <label key={a} title={ATTRIBUTE_NAMES[a]}>
                    <span>{a}</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={sheet.attributes[a]}
                      onChange={(e) => setSheet({ attributes: { ...sheet.attributes, [a]: clamp(Number(e.target.value), 1, 40) } })}
                    />
                  </label>
                ))}
              </div>
              {unmet.length > 0 && <p className="warn small">Below the {prof?.sv} requirements: {unmet.join(', ')}.</p>}
              {stoOutside && (
                <p className="warn small">
                  STO {sheet.attributes.STO} is outside the {race.sv} range {race.sto.min}–{race.sto.max}.
                </p>
              )}
            </section>

            <section className="editor-section">
              <h4>Skills</h4>
              <table className="skill-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Type</th>
                    <th>Base</th>
                    <th>FV</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={r.notes.length ? 'has-note' : ''}>
                      <td>
                        {r.def.name} <span className="muted small">({r.def.sv})</span>
                        {r.notes.length > 0 && <div className="warn small">{r.notes.join('; ')}</div>}
                      </td>
                      <td>
                        <span className={`skill-tag ${r.category}`} title={CATEGORY_TITLE[r.category]}>
                          {CATEGORY_LABEL[r.category]}
                        </span>
                      </td>
                      <td className="muted small">{r.def.attribute ? `${r.def.attribute} ${sheet.attributes[r.def.attribute]}` : 'var.'}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={r.fv}
                          aria-label={`${r.def.name} FV`}
                          onChange={(e) => setDraft({ ...draft, sheet: setSheetSkill(sheet, r.key, clamp(Number(e.target.value), 0, 99)) })}
                        />
                      </td>
                      <td>
                        <button className="small" title="Remove skill" onClick={() => removeSkill(r.key)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No skills yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="row">
                <select value={adding} onChange={(e) => addSkill(e.target.value)} aria-label="Add a skill">
                  <option value="">+ Add a skill…</option>
                  {groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {addable
                        .filter((s) => s.group === g)
                        .map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name} ({s.sv})
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {sheet.skills.martialArt !== undefined && (
                <div className="martial">
                  <strong className="small">Martial-art techniques</strong> <span className="muted small">(all use the Martial art FV)</span>
                  <div className="tech-checks">
                    {Object.entries(MARTIAL_TECHNIQUE_NAMES).map(([id, name]) => {
                      const east = EASTERN_TECHNIQUES.includes(id);
                      if (east && !eastern && !(sheet.martialArtTechniques ?? []).includes(id)) return null;
                      return (
                        <label key={id}>
                          <input type="checkbox" checked={(sheet.martialArtTechniques ?? []).includes(id)} onChange={(e) => toggleTechnique(id, e.target.checked)} /> {name}
                          {east && <span className="muted"> (eastern)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="editor-section">
              <h4>Weapons</h4>
              {draft.weapons.map((w, i) => (
                <WeaponRow
                  key={i}
                  index={i}
                  pick={w}
                  items={usableItems}
                  sty={sheet.attributes.STY}
                  onChange={(p) => setWeapons(draft.weapons.map((x, j) => (j === i ? p : x)))}
                  onRemove={draft.weapons.length > 1 ? () => setWeapons(draft.weapons.filter((_, j) => j !== i)) : undefined}
                />
              ))}
              {draft.weapons.length < 3 && (
                <button className="small" onClick={() => setWeapons([...draft.weapons, { main: null, off: null }])}>
                  + Another weapon set
                </button>
              )}
              <p className="muted small">The first set is held when the fight starts; switching costs an action. Thrown weapons come three at a time, missile weapons with 20 shots.</p>
              <label className="armour-pick">
                Armour{' '}
                <select
                  value={armourKey}
                  onChange={(e) => setSheet({ equipment: { ...sheet.equipment, armour: armourSets.find(([k]) => k === e.target.value)?.[1].armour ?? [] } })}
                >
                  {!armourSets.some(([k]) => k === armourKey) && <option value={armourKey}>{sheet.equipment.armour.map((a) => armourDef(a).name).join(', ') || 'None'}</option>}
                  {armourSets.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </div>

          <aside className="editor-preview">
            <h4>As it will fight</h4>
            <SheetCard sheet={finished} rules={rules} />
          </aside>
        </div>

        <footer className="editor-foot">
          {onDelete && (
            <button className="small danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!canSave} onClick={() => onSave({ ...draft, sheet: finishSheet(draft) })}>
            Save character
          </button>
        </footer>
      </div>
    </div>
  );
}

function WeaponRow({
  index,
  pick,
  items,
  sty,
  onChange,
  onRemove,
}: {
  index: number;
  pick: WeaponPick;
  items: ItemDef[];
  sty: number;
  onChange: (p: WeaponPick) => void;
  onRemove?: () => void;
}) {
  const main = pick.main ? itemDef(pick.main) : null;
  // A weapon that needs both hands leaves nothing for the off hand (III 2690–2715).
  const bothHands = !!main && main.kind !== 'shield' && (!!main.twoHandedOnly || main.sty > sty);
  const offItems = items.filter((d) => d.kind === 'shield' || ((d.kind === 'melee' || d.kind === 'thrown') && !d.twoHandedOnly));
  const mainItems = items.filter((d) => d.kind !== 'shield');
  return (
    <div className="row wrap weapon-row">
      <span className="muted small">{index + 1}.</span>
      <label>
        Main hand{' '}
        <ItemSelect value={pick.main} items={mainItems} none="Unarmed" onChange={(v) => onChange({ main: v, off: v && needsBoth(v, sty) ? null : pick.off })} />
      </label>
      <label>
        Off hand <ItemSelect value={bothHands ? null : pick.off} items={offItems} none={bothHands ? '(both hands on the main weapon)' : 'Empty'} disabled={bothHands} onChange={(v) => onChange({ ...pick, off: v })} />
      </label>
      {onRemove && (
        <button className="small" title="Remove this weapon set" onClick={onRemove}>
          ✕
        </button>
      )}
    </div>
  );
}

function needsBoth(id: string, sty: number): boolean {
  const d = itemDef(id);
  return !!d.twoHandedOnly || d.sty > sty;
}

function ItemSelect({ value, items, none, disabled, onChange }: { value: string | null; items: ItemDef[]; none: string; disabled?: boolean; onChange: (v: string | null) => void }) {
  const groups = [...new Set(items.map((d) => d.group))];
  return (
    <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{none}</option>
      {groups.map((g) => (
        <optgroup key={g} label={GROUP_LABEL[g] ?? g}>
          {items
            .filter((d) => d.group === g)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

const GROUP_LABEL: Record<string, string> = Object.fromEntries(SKILLS.filter((s) => s.weaponGroup).map((s) => [s.weaponGroup!, s.group]));

function listName(k: string): string {
  return (
    {
      dagger: 'Dolk',
      staff: 'Trästav',
      twoWeapons: 'Två vapen',
      martialArt: 'Stridskonster',
      fallTechnique: 'Fallteknik',
      drawWeapon: 'Dra vapen',
      techniques: 'Vapentekniker',
    } as Record<string, string>
  )[k];
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo);
