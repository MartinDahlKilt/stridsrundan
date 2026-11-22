import { describe, expect, it } from 'vitest';
import { presetById } from '../src/data/presets';
import { classifySkills, setSheetSkill, unmetRequirements } from '../src/data/skills';
import { simulate } from '../src/engine/session';
import type { CharacterSheet } from '../src/engine/types';
import { changeRace, finishSheet, newCustom } from '../src/ui/CharacterEditor';
import { buildEquipment } from '../src/ui/customCharacters';

const cat = (sheet: CharacterSheet) => Object.fromEntries(classifySkills(sheet).map((r) => [r.key, r.category]));

describe('skill categories', () => {
  it('brawling, Upptäcka fara and Finna dolda ting are primary; a warrior takes any weapon skills as profession skills', () => {
    const merc = presetById('mercenary');
    expect(cat(merc)).toEqual({ broadsword: 'profession', heaterShield: 'profession', dagger: 'profession', brawling: 'primary', fallTechnique: 'profession', spotDanger: 'primary', findHidden: 'primary' });
  });

  it('a profession with a weapon-skill limit gives the slots to the highest FVs', () => {
    // Lönnmördare: at most one weapon skill (Dolk is a separate entry).
    const s: CharacterSheet = { ...presetById('cutthroat'), skills: { broadsword: 12, shortSword: 14, dagger: 15 } };
    const rows = classifySkills(s);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.dagger.category).toBe('profession');
    expect(by.shortSword.category).toBe('profession');
    expect(by.broadsword.category).toBe('secondary');
    expect(by.broadsword.notes.join()).toMatch(/at most 1 weapon skill/);
  });

  it('secondary skills above their attribute get a note but keep their FV', () => {
    // Magiker: no weapon profession skills; broadsword is STY-based.
    const s: CharacterSheet = { ...presetById('pyromancer'), profession: 'wizard', skills: { broadsword: 18 } };
    s.attributes = { ...s.attributes, STY: 10 };
    const [row] = classifySkills(s);
    expect(row.category).toBe('secondary');
    expect(row.fv).toBe(18);
    expect(row.notes.join()).toMatch(/can't exceed STY 10/);
  });

  it('weapon techniques are profession skills only where the list has Vapentekniker', () => {
    const base = setSheetSkill(presetById('mercenary'), 'tech:strike', 12);
    expect(cat(base)['tech:strike']).toBe('secondary');
    expect(cat({ ...base, profession: 'weaponmaster' })['tech:strike']).toBe('profession');
    expect(base.techniques).toEqual({ strike: 12 });
    expect(setSheetSkill(base, 'tech:strike', null).techniques).toBeUndefined();
  });

  it('reports unmet profession requirements', () => {
    const s: CharacterSheet = { ...presetById('mercenary'), profession: 'scholar' };
    expect(unmetRequirements(s)).toEqual(['INT 10 (needs 16)']);
  });
});

describe('custom characters', () => {
  it('builds one item per hand, with ammo and thrown weapons', () => {
    const eq = buildEquipment(
      [
        { main: 'throwingKnife', off: 'dagger' },
        { main: 'dagger', off: 'dagger' },
        { main: 'longbow', off: null },
      ],
      ['leather-complete'],
    );
    expect(Object.values(eq.items).map((i) => i.def).sort()).toEqual(['dagger', 'dagger', 'longbow', 'throwingKnife']);
    expect(eq.items.throwingKnife.count).toBe(3);
    expect(eq.ammo).toEqual({ arrow: 20 });
    expect(eq.loadouts[1]).toEqual({ name: 'Dagger + Dagger', main: 'dagger', off: 'dagger2' });
  });

  it('a custom character fights', () => {
    const c = newCustom(presetById('knight'));
    c.sheet = { ...setSheetSkill(c.sheet, 'battleAxe', 16), profession: 'soldier' };
    c.weapons = [{ main: 'battleAxe', off: 'kiteShield' }];
    const sheet = finishSheet(c);
    expect(sheet.professionName).toBe('Soldier (Soldat)');
    expect(sheet.eastern).toBeUndefined();
    const r = simulate([
      { sheet, team: 0, controller: 'ai' },
      { sheet: presetById('barbarian'), team: 1, controller: 'ai' },
    ], 7);
    expect(r.state.log.length).toBeGreaterThan(5);
  });

  it('changing race swaps the racial modifiers and moves STO into range', () => {
    const merc = presetById('mercenary'); // human STY 16 SMI 13 STO 14, brawling 8
    const orc = changeRace(merc, 'halforc');
    expect(orc.attributes).toMatchObject({ STY: 18, SMI: 12, KAR: 7, STO: 14 });
    expect(orc.skills.brawling).toBe(12);
    const dwarf = changeRace(orc, 'dwarf');
    expect(dwarf.attributes).toMatchObject({ STY: 19, FYS: 16, SMI: 13, PSY: 13, KAR: 10, STO: 7 });
    expect(dwarf.skills.brawling).toBe(8);
  });

  it('eastern weapons or professions mark the character eastern', () => {
    const c = newCustom(presetById('mercenary'));
    c.weapons = [{ main: 'katana', off: null }];
    expect(finishSheet(c).eastern).toBe(true);
  });
});
