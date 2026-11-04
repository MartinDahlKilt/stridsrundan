import { TECHNIQUES } from '../engine/requests';
import type { Attribute, CharacterSheet, WeaponGroup } from '../engine/types';
import { ITEMS } from './items';
import { professionDef, type ProfessionSkillKey } from './professions';

/**
 * The combat skills a character sheet can hold, with their type from the skill table (I 1897–1960):
 * primary skills every character has and can raise without limit; secondary skills that can't exceed the
 * attribute they're based on (I 427) unless they're profession skills (I 438–441).
 */

export interface SkillDef {
  /** Key in sheet.skills, or `tech:<id>` for a weapon technique in sheet.techniques. */
  key: string;
  name: string;
  sv: string;
  kind: 'primary' | 'secondary';
  /** Governing attribute; null where it varies (weapon techniques follow the weapon). */
  attribute: Attribute | null;
  /** How the skill appears in profession lists: a weapon skill, or a named entry. */
  listKey: ProfessionSkillKey | 'weapon';
  /** Heading in the "add skill" menu. */
  group: string;
  eastern?: boolean;
  /** Weapon skills: the item's weapon group. */
  weaponGroup?: WeaponGroup;
}

export const WEAPON_GROUP_NAMES: Record<WeaponGroup, string> = {
  dagger: 'Daggers (Dolkar)',
  sword1h: 'One-handed swords (Enhandssvärd)',
  blunt1h: 'One-handed crushing weapons (Enhands krossvapen)',
  axe1h: 'One-handed axes (Enhandsyxor)',
  twoHanded: 'Two-handed weapons (Tvåhandsvapen)',
  spear: 'Thrusting weapons (Stickvapen)',
  flail: 'Chain weapons (Kättingvapen)',
  whip: 'Whips (Piska)',
  polearm: 'Polearms (Stångvapen)',
  bow: 'Bows (Bågar)',
  crossbow: 'Crossbows (Armborst)',
  sling: 'Slings (Slunga)',
  thrown: 'Thrown weapons (Kastvapen)',
  shield: 'Shields (Sköldar)',
  unarmed: 'Unarmed',
};

/** Weapon-group attributes (I 4348). */
const GROUP_ATTRIBUTE: Record<WeaponGroup, Attribute> = {
  dagger: 'SMI',
  sword1h: 'STY',
  blunt1h: 'STY',
  axe1h: 'STY',
  twoHanded: 'STY',
  spear: 'STY',
  flail: 'SMI',
  whip: 'SMI',
  polearm: 'STY',
  bow: 'SMI',
  crossbow: 'SMI',
  sling: 'SMI',
  thrown: 'SMI',
  shield: 'SMI',
  unarmed: 'STY',
};

const GENERAL = 'Combat skills';

const SPECIAL: SkillDef[] = [
  { key: 'brawling', name: 'Brawling', sv: 'Slagsmål', kind: 'primary', attribute: 'STY', listKey: 'weapon', group: 'Primary skills' },
  { key: 'twoWeapons', name: 'Two weapons', sv: 'Två vapen', kind: 'secondary', attribute: 'SMI', listKey: 'twoWeapons', group: GENERAL },
  { key: 'martialArt', name: 'Martial art', sv: 'Stridskonster', kind: 'secondary', attribute: 'SMI', listKey: 'martialArt', group: GENERAL },
  { key: 'fallTechnique', name: 'Fall technique', sv: 'Fallteknik', kind: 'secondary', attribute: 'SMI', listKey: 'fallTechnique', group: GENERAL },
  { key: 'drawWeapon', name: 'Draw weapon', sv: 'Dra vapen', kind: 'secondary', attribute: 'SMI', listKey: 'drawWeapon', group: GENERAL },
];

const WEAPONS: SkillDef[] = Object.values(ITEMS).map((d) => ({
  key: d.id,
  name: d.name,
  sv: d.sv,
  kind: 'secondary',
  attribute: GROUP_ATTRIBUTE[d.group],
  // Dolk and Trästav are separate entries in the profession lists; other weapons count as weapon skills.
  listKey: d.group === 'dagger' ? 'dagger' : d.id === 'quarterstaff' ? 'staff' : 'weapon',
  group: WEAPON_GROUP_NAMES[d.group],
  eastern: d.eastern,
  weaponGroup: d.group,
}));

const WEAPON_TECHNIQUES: SkillDef[] = Object.values(TECHNIQUES)
  .filter((t) => !t.martial)
  .map((t) => ({
    key: `tech:${t.id}`,
    name: t.name.replace(/ \(.*\)$/, ''),
    sv: t.name.match(/\((.*)\)/)?.[1] ?? t.name,
    kind: 'secondary',
    attribute: null,
    listKey: 'techniques',
    group: 'Weapon techniques (Vapentekniker)',
  }));

export const SKILLS: SkillDef[] = [...SPECIAL, ...WEAPONS, ...WEAPON_TECHNIQUES];
const BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));

export function skillDef(key: string): SkillDef | undefined {
  return BY_KEY.get(key);
}

/** All the sheet's skills as [key, FV] pairs, weapon techniques as `tech:<id>`. */
export function sheetSkills(sheet: CharacterSheet): [string, number][] {
  return [...Object.entries(sheet.skills), ...Object.entries(sheet.techniques ?? {}).map(([k, v]) => [`tech:${k}`, v] as [string, number])];
}

export function setSheetSkill(sheet: CharacterSheet, key: string, fv: number | null): CharacterSheet {
  if (key.startsWith('tech:')) {
    const techniques = { ...(sheet.techniques ?? {}) };
    const id = key.slice(5);
    if (fv === null) delete techniques[id];
    else techniques[id] = fv;
    return { ...sheet, techniques: Object.keys(techniques).length ? techniques : undefined };
  }
  const skills = { ...sheet.skills };
  if (fv === null) delete skills[key];
  else skills[key] = fv;
  return { ...sheet, skills };
}

export type SkillCategory = 'primary' | 'profession' | 'secondary';

export interface ClassifiedSkill {
  key: string;
  fv: number;
  def: SkillDef;
  category: SkillCategory;
  /** Why an eligible skill didn't become a profession skill, or why the FV breaks a limit. */
  notes: string[];
}

/**
 * Sort the sheet's skills into primary, profession and secondary skills for its profession. Profession slots
 * go to the highest FVs first, within the profession's weapon-skill limit and its 12 (magiker 9) choices.
 * Nothing is forbidden – the notes only say where the basic rules would object.
 */
export function classifySkills(sheet: CharacterSheet): ClassifiedSkill[] {
  const prof = professionDef(sheet.profession);
  const rows: ClassifiedSkill[] = sheetSkills(sheet)
    .map(([key, fv]) => ({ key, fv, def: skillDef(key) }))
    .filter((r): r is { key: string; fv: number; def: SkillDef } => !!r.def)
    .map((r) => ({ ...r, category: r.def.kind === 'primary' ? 'primary' : 'secondary', notes: [] }));

  let weapons = 0;
  let total = 0;
  for (const r of [...rows].sort((a, b) => b.fv - a.fv)) {
    if (r.category === 'primary' || !prof) continue;
    const d = r.def;
    if (d.listKey === 'weapon') {
      const allowed = prof.weaponSkills !== 0 && (!prof.weaponFilter || prof.weaponFilter(d.key, d.weaponGroup ?? ''));
      if (!allowed) {
        r.notes.push(prof.weaponSkills === 0 ? `${prof.sv} has no weapon profession skills` : `not a weapon profession skill for ${prof.sv}`);
        continue;
      }
      if (prof.weaponSkills !== 'any' && weapons >= prof.weaponSkills) {
        r.notes.push(`${prof.sv} can take at most ${prof.weaponSkills} weapon skill${prof.weaponSkills === 1 ? '' : 's'} as profession skills`);
        continue;
      }
    } else if (!prof.skills.includes(d.listKey)) {
      r.notes.push(`not on the ${prof.sv} list`);
      continue;
    }
    if (total >= prof.maxProfessionSkills) {
      r.notes.push(`${prof.sv} chooses only ${prof.maxProfessionSkills} profession skills`);
      continue;
    }
    r.category = 'profession';
    total++;
    if (d.listKey === 'weapon') weapons++;
  }

  for (const r of rows) {
    const cap = r.def.attribute ? sheet.attributes[r.def.attribute] : null;
    if (r.category === 'secondary' && cap !== null && r.fv > cap) r.notes.push(`a secondary skill can't exceed ${r.def.attribute} ${cap}`);
  }
  return rows;
}

/** Attribute requirements of the profession that the sheet doesn't meet. */
export function unmetRequirements(sheet: CharacterSheet): string[] {
  const prof = professionDef(sheet.profession);
  if (!prof) return [];
  return (Object.entries(prof.requires) as [Attribute, number][])
    .filter(([a, min]) => sheet.attributes[a] < min)
    .map(([a, min]) => `${a} ${sheet.attributes[a]} (needs ${min})`);
}
