import type { Attribute, Profession } from '../engine/types';

/**
 * Professions (yrken) and which combat skills they may take as profession skills (yrkesfärdigheter).
 * Only the combat-relevant part of each list is kept: weapon skills, Dolk, Trästav, Två vapen, Stridskonster,
 * Fallteknik, Dra vapen, Anfall bakifrån and Vapentekniker. Sources: basic rules I 700–1200, KH 72–390, eastern KH 6600–6770.
 */

/** Profession-list entries the editor knows about (beyond plain weapon skills). */
export type ProfessionSkillKey = 'dagger' | 'staff' | 'twoWeapons' | 'martialArt' | 'fallTechnique' | 'drawWeapon' | 'techniques' | 'backstab';

export interface ProfessionDef {
  id: Profession;
  name: string;
  /** Swedish name in the rule books. */
  sv: string;
  source: 'basic' | 'kh' | 'eastern';
  /** Minimum attributes to belong to the profession. */
  requires: Partial<Record<Attribute, number>>;
  /** Weapon skills that may be profession skills: a number, 'any' (Vapenfärdigheter) or 0. */
  weaponSkills: number | 'any';
  /** Restriction on which weapons count (Budoka: no swords; Kensai: katana, wakizashi and bows). */
  weaponFilter?: (itemId: string, group: string) => boolean;
  skills: ProfessionSkillKey[];
  /** Number of profession skills chosen in total (12, magiker 9). */
  maxProfessionSkills: number;
  /** Profession ability, as it matters in a duel. */
  ability: string;
  /** Whether the simulator applies the ability. */
  abilityInSim: boolean;
  note?: string;
}

// KH 1130: Anfall bakifrån is a profession skill for Barbar, Gladiator, Krigarmunk, Soldat, Prisjägare, Vapenmästare,
// Tjuv and Lönnmördare.
// KH 1191: Fallteknik is a profession skill for all warrior professions, Lönnmördare, Munk, Tjuv and Utbygdsjägare.
export const PROFESSIONS: ProfessionDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    sv: 'Krigare',
    source: 'basic',
    requires: { STY: 14, FYS: 12 },
    weaponSkills: 'any',
    skills: ['dagger', 'staff', 'twoWeapons', 'martialArt', 'drawWeapon', 'fallTechnique'],
    maxProfessionSkills: 12,
    ability: '+5 on every initiative roll',
    abilityInSim: true,
  },
  {
    id: 'knight',
    name: 'Knight',
    sv: 'Riddare',
    source: 'basic',
    requires: { STY: 14, FYS: 12, PSY: 12 },
    weaponSkills: 5,
    skills: ['dagger', 'staff', 'twoWeapons', 'drawWeapon', 'fallTechnique', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'Spend 5 PSY to hit any location without aiming, or to do maximum damage',
    abilityInSim: false,
  },
  {
    id: 'assassin',
    name: 'Assassin',
    sv: 'Lönnmördare',
    source: 'basic',
    requires: { SMI: 14, PSY: 12 },
    weaponSkills: 1,
    skills: ['dagger', 'staff', 'martialArt', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Backstab for double to quadruple damage – needs stealth, not in a face-off',
    abilityInSim: false,
  },
  {
    id: 'thief',
    name: 'Thief',
    sv: 'Tjuv',
    source: 'basic',
    requires: { SMI: 16 },
    weaponSkills: 2,
    skills: ['dagger', 'staff', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Spend PSY for +1 CL per point (max +3)',
    abilityInSim: false,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    sv: 'Utbygdsjägare',
    source: 'basic',
    requires: { FYS: 12, SMI: 12, PSY: 12 },
    weaponSkills: 3,
    skills: ['dagger', 'staff', 'fallTechnique'],
    maxProfessionSkills: 12,
    ability: 'Animism spells – no effect on the weapon fight',
    abilityInSim: false,
  },
  {
    id: 'mariner',
    name: 'Mariner',
    sv: 'Sjöfarare',
    source: 'basic',
    requires: { FYS: 12, SMI: 12 },
    weaponSkills: 3,
    skills: ['dagger', 'staff'],
    maxProfessionSkills: 12,
    ability: 'Seafaring – no effect in a fight',
    abilityInSim: false,
  },
  {
    id: 'monk',
    name: 'Monk',
    sv: 'Munk',
    source: 'basic',
    requires: { INT: 12, PSY: 12 },
    weaponSkills: 0,
    skills: ['dagger', 'martialArt', 'fallTechnique'],
    maxProfessionSkills: 12,
    ability: 'Meditation – no effect in a fight',
    abilityInSim: false,
  },
  {
    id: 'bard',
    name: 'Bard',
    sv: 'Bard',
    source: 'basic',
    requires: { SMI: 12, KAR: 14 },
    weaponSkills: 1,
    skills: ['dagger', 'staff'],
    maxProfessionSkills: 12,
    ability: 'Music raises KAR by 5 – no effect in a fight',
    abilityInSim: false,
  },
  {
    id: 'healer',
    name: 'Healer',
    sv: 'Helare',
    source: 'basic',
    requires: { INT: 12, PSY: 12 },
    weaponSkills: 0,
    skills: ['dagger', 'staff'],
    maxProfessionSkills: 12,
    ability: 'Healing by laying on hands – not used during the fight',
    abilityInSim: false,
  },
  {
    id: 'scholar',
    name: 'Scholar',
    sv: 'Lärd man',
    source: 'basic',
    requires: { INT: 16 },
    weaponSkills: 0,
    skills: ['dagger', 'staff'],
    maxProfessionSkills: 12,
    ability: '−5 on the fear table – no fear rolls in the simulator',
    abilityInSim: false,
  },
  {
    id: 'wizard',
    name: 'Wizard',
    sv: 'Magiker',
    source: 'basic',
    requires: { INT: 12, PSY: 14 },
    weaponSkills: 0,
    skills: ['staff'],
    maxProfessionSkills: 9,
    ability: 'Spells (kept from the class template)',
    abilityInSim: true,
  },
  {
    id: 'barbarian',
    name: 'Barbarian',
    sv: 'Barbar',
    source: 'kh',
    requires: { STY: 14, FYS: 15 },
    weaponSkills: 5,
    skills: ['dagger', 'staff', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: '+3 STO and FYS for KP, +7 FYS for SP',
    abilityInSim: true,
  },
  {
    id: 'gladiator',
    name: 'Gladiator',
    sv: 'Gladiator',
    source: 'kh',
    requires: { STY: 14, FYS: 12, SMI: 12 },
    weaponSkills: 6,
    skills: ['dagger', 'staff', 'twoWeapons', 'martialArt', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: '+3 base chance in weapon profession skills – set the FV directly here',
    abilityInSim: false,
  },
  {
    id: 'warriorMonk',
    name: 'Warrior monk',
    sv: 'Krigarmunk',
    source: 'kh',
    requires: { STY: 14, FYS: 12, SMI: 16, PSY: 15, INT: 11 },
    weaponSkills: 1,
    skills: ['staff', 'martialArt', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Martial-art techniques cost half – no effect once the character is made',
    abilityInSim: false,
  },
  {
    id: 'paladin',
    name: 'Paladin',
    sv: 'Paladin',
    source: 'kh',
    requires: { STY: 15, FYS: 12, PSY: 14, INT: 12 },
    weaponSkills: 4,
    skills: ['dagger', 'staff', 'twoWeapons', 'drawWeapon', 'fallTechnique'],
    maxProfessionSkills: 12,
    ability: 'Mentalism spells (SV ≤ 12)',
    abilityInSim: false,
  },
  {
    id: 'bountyHunter',
    name: 'Bounty hunter',
    sv: 'Prisjägare',
    source: 'kh',
    requires: { STY: 14, FYS: 12, SMI: 14 },
    weaponSkills: 4,
    skills: ['dagger', 'staff', 'martialArt', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Always CL 17 or more in Upptäcka fara – no effect in a face-off',
    abilityInSim: false,
  },
  {
    id: 'soldier',
    name: 'Soldier',
    sv: 'Soldat',
    source: 'kh',
    requires: { STY: 14, FYS: 12 },
    weaponSkills: 5,
    skills: ['dagger', 'staff', 'twoWeapons', 'drawWeapon', 'fallTechnique', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Army contacts – no effect in a duel',
    abilityInSim: false,
  },
  {
    id: 'swashbuckler',
    name: 'Swashbuckler',
    sv: 'Sprätthök',
    source: 'kh',
    requires: { STY: 14, FYS: 12, SMI: 15 },
    weaponSkills: 3,
    skills: ['dagger', 'staff', 'twoWeapons', 'drawWeapon', 'fallTechnique'],
    maxProfessionSkills: 12,
    ability: 'Daring stunts succeed at the game master’s discretion',
    abilityInSim: false,
  },
  {
    id: 'weaponmaster',
    name: 'Weapon master',
    sv: 'Vapenmästare',
    source: 'kh',
    requires: { STY: 14, FYS: 12, SMI: 15, PSY: 12 },
    weaponSkills: 2,
    skills: ['dagger', 'staff', 'martialArt', 'drawWeapon', 'fallTechnique', 'techniques', 'backstab'],
    maxProfessionSkills: 12,
    ability: 'Spend 5 PSY for one extra parry or attack in a round',
    abilityInSim: false,
    note: 'One weapon skill, or two if weapon + shield, two one-handed weapons (with Two weapons) or a two-handed weapon (KH 378).',
  },
  {
    id: 'samurai',
    name: 'Samurai',
    sv: 'Samuraj',
    source: 'eastern',
    requires: { STY: 14, FYS: 12, SMI: 12 },
    weaponSkills: 'any',
    skills: ['dagger', 'twoWeapons', 'drawWeapon', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'Commanding voice – no effect in a duel',
    abilityInSim: false,
  },
  {
    id: 'ronin',
    name: 'Ronin',
    sv: 'Ronin',
    source: 'eastern',
    requires: { STY: 14, FYS: 12, SMI: 12 },
    weaponSkills: 'any',
    skills: ['dagger', 'twoWeapons', 'drawWeapon', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'Frighten common people – no effect in a duel',
    abilityInSim: false,
  },
  {
    id: 'kensai',
    name: 'Kensai',
    sv: 'Kensai',
    source: 'eastern',
    requires: { SMI: 15, PSY: 14 },
    weaponSkills: 'any',
    weaponFilter: (id, group) => id === 'katana' || id === 'wakizashi' || group === 'bow',
    skills: ['dagger', 'twoWeapons', 'drawWeapon', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'Spend 5 PSY to hit a chosen location for double damage',
    abilityInSim: false,
    note: 'Weapon profession skills: Katana, Wakizashi and Båge (bows).',
  },
  {
    id: 'budoka',
    name: 'Budoka',
    sv: 'Budoka',
    source: 'eastern',
    requires: { SMI: 14, PSY: 14 },
    weaponSkills: 'any',
    weaponFilter: (_id, group) => group !== 'sword1h',
    skills: ['dagger', 'staff', 'twoWeapons', 'martialArt', 'drawWeapon', 'fallTechnique', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'Spend 5 PSY for a blow that armour doesn’t absorb',
    abilityInSim: false,
    note: 'Weapon profession skills: any weapon except swords.',
  },
  {
    id: 'ninja',
    name: 'Ninja',
    sv: 'Ninja',
    source: 'eastern',
    requires: { SMI: 14, PSY: 12 },
    weaponSkills: 'any',
    skills: ['dagger', 'staff', 'twoWeapons', 'martialArt', 'drawWeapon', 'fallTechnique', 'techniques'],
    maxProfessionSkills: 12,
    ability: 'No penalties at night or by torchlight',
    abilityInSim: false,
  },
];

export function professionDef(id: Profession): ProfessionDef | undefined {
  // The archmage preset is a magiker with a hero's status.
  return PROFESSIONS.find((p) => p.id === (id === 'archmage' ? 'wizard' : id));
}

export function professionLabel(p: ProfessionDef): string {
  return p.name === p.sv ? p.name : `${p.name} (${p.sv})`;
}
