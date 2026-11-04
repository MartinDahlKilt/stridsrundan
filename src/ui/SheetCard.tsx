import { useMemo } from 'react';
import { armourDef } from '../data/armour';
import { ITEMS, itemDef } from '../data/items';
import { skillDef } from '../data/skills';
import { SCHOOL_NAMES, spellDef } from '../data/spells';
import { castActions } from '../engine/magic';
import { countActions, createCombatant, weaponFV } from '../engine/character';
import { applyRuleOptions, type RulesConfig } from '../engine/rules';
import { TECHNIQUES } from '../engine/requests';
import { HERO_ABILITY_NAMES, HERO_STATUS, MARTIAL_TECHNIQUE_NAMES } from './labels';
import { ATTRIBUTE_NAMES, type Attribute, type CharacterSheet, type MagicSchool } from '../engine/types';

/** A character's sheet as it will fight under the chosen rules: attributes, derived values and gear. */
export function SheetCard({ sheet: base, rules }: { sheet: CharacterSheet; rules: RulesConfig }) {
  const p = applyRuleOptions(base, rules);
  const disabled = (base.martialArtTechniques ?? []).filter((t) => !(p.martialArtTechniques ?? []).includes(t));
  const info = useMemo(() => {
    const c = createCombatant(p, 'preview', 0, 'ai', { x: 0, y: 0 });
    return { c, actions: countActions(c) };
  }, [base, rules.easternWarriors]);
  const { c, actions } = info;
  const d = c.derived;
  // Skills that aren't weapon skills (those are listed with the weapons).
  const otherSkills = Object.entries(p.skills)
    .filter(([k]) => !ITEMS[k])
    .map(([k, fv]) => `${skillDef(k)?.name ?? k} ${fv}`);
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
            <strong>Techniques:</strong> {Object.entries(p.techniques).map(([t, fv]) => `${TECHNIQUES[t]?.name ?? t} ${fv}`).join(', ')}
          </>
        )}
        {otherSkills.length > 0 && (
          <>
            <br />
            <strong>Other skills:</strong> {otherSkills.join(', ')}
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
        {p.martialArtTechniques && p.martialArtTechniques.length > 0 && (
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

function techName(id: string): string {
  return MARTIAL_TECHNIQUE_NAMES[id] ?? id;
}
