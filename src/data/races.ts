import type { Attribute, Race } from '../engine/types';

/** Races (I 551–700): attribute modifiers, the STO range and combat-relevant skill bonuses. */
export interface RaceDef {
  id: Race;
  name: string;
  sv: string;
  /** Modifiers to the rolled attributes (STO is a range instead). */
  mods: Partial<Record<Attribute, number>>;
  sto: { min: number; max: number; normal: number };
  /** Automatic FV bonuses in combat skills (sheet skill keys). */
  skillBonus?: Record<string, number>;
  /** Other traits, for the UI. */
  traits: string;
}

export const RACES: RaceDef[] = [
  { id: 'human', name: 'Human', sv: 'Människa', mods: {}, sto: { min: 8, max: 18, normal: 13 }, traits: 'Suits every profession' },
  { id: 'elf', name: 'Elf', sv: 'Alv', mods: { STY: -1, SMI: 3, INT: 3, KAR: 2 }, sto: { min: 8, max: 14, normal: 11 }, skillBonus: { spotDanger: 4 }, traits: '+4 Upptäcka fara and Lyssna; movement +1' },
  { id: 'dwarf', name: 'Dwarf', sv: 'Dvärg', mods: { STY: 3, FYS: 2, PSY: 2 }, sto: { min: 4, max: 9, normal: 7 }, traits: 'Perfect night vision, Geologi 5; movement −2' },
  { id: 'halfelf', name: 'Half-elf', sv: 'Halvalv', mods: { SMI: 2, KAR: 1 }, sto: { min: 7, max: 16, normal: 12 }, skillBonus: { spotDanger: 2 }, traits: '+2 Upptäcka fara and Lyssna' },
  { id: 'halfling', name: 'Halfling', sv: 'Halvlängdsman', mods: { STY: -4, FYS: 3, SMI: 3, PSY: 2 }, sto: { min: 3, max: 6, normal: 5 }, traits: '+4 Gömma sig; movement −2' },
  {
    id: 'halforc',
    name: 'Half-orc',
    sv: 'Halvorch',
    mods: { STY: 2, FYS: 2, SMI: -1, KAR: -3 },
    sto: { min: 8, max: 18, normal: 13 },
    skillBonus: { brawling: 4 },
    traits: '+4 Slagsmål (brawling)',
  },
  { id: 'duck', name: 'Duck', sv: 'Anka', mods: { STY: -4, FYS: 2, SMI: 2, KAR: -3 }, sto: { min: 3, max: 6, normal: 5 }, skillBonus: { sneak: 4 }, traits: 'Simma 20, +4 Smyga; movement −2' },
];

export function raceDef(id: Race): RaceDef {
  return RACES.find((r) => r.id === id) ?? RACES[0];
}

export const raceLabel = (r: RaceDef) => `${r.name} (${r.sv})`;
