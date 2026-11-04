import { itemDef } from '../data/items';
import { PRESETS, presetById } from '../data/presets';
import type { CharacterSheet } from '../engine/types';

/** A hand pair in a weapon configuration, by item definition id. */
export interface WeaponPick {
  main: string | null;
  off: string | null;
}

/** A player-made character: race, profession, skills and weapons chosen by the player. */
export interface CustomCharacter {
  id: string;
  sheet: CharacterSheet;
  /** Weapon configurations; the first is the starting one. */
  weapons: WeaponPick[];
}

const KEY = 'stridsrundan.customCharacters';

export function loadCustoms(): CustomCharacter[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CustomCharacter[]) : [];
    // Drop entries that refer to items that no longer exist.
    return list.filter((c) => {
      try {
        c.weapons.forEach((w) => [w.main, w.off].forEach((d) => d && itemDef(d)));
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function saveCustoms(list: CustomCharacter[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const isCustomId = (id: string) => id.startsWith('custom-');

/** Resolve a fighter id: a saved custom character or a preset. */
export function characterById(id: string, customs: CustomCharacter[]): CharacterSheet {
  const c = customs.find((x) => x.id === id);
  if (c) return c.sheet;
  return isCustomId(id) ? PRESETS[0] : presetById(id);
}

/** The weapon configurations of a sheet, as item definition ids. */
export function weaponPicks(sheet: CharacterSheet): WeaponPick[] {
  const def = (key: string | null) => (key ? (sheet.equipment.items[key]?.def ?? null) : null);
  const picks = sheet.equipment.loadouts.map((l) => ({ main: def(l.main), off: def(l.off) }));
  return picks.length ? picks : [{ main: null, off: null }];
}

/** Thrown weapons carried when picked (the presets carry 1–3). */
const THROWN_COUNT = 3;
const AMMO = 20;

/**
 * Equipment for a set of weapon configurations: one item per weapon (two when the same weapon is in both hands),
 * ammunition for every missile weapon and the template's armour.
 */
export function buildEquipment(picks: WeaponPick[], armour: string[]): CharacterSheet['equipment'] {
  const items: CharacterSheet['equipment']['items'] = {};
  const ammo: Record<string, number> = {};
  const loadouts: CharacterSheet['equipment']['loadouts'] = [];
  for (const p of picks) {
    const used: string[] = [];
    const keyFor = (defId: string | null): string | null => {
      if (!defId) return null;
      let key = Object.keys(items).find((k) => items[k].def === defId && !used.includes(k));
      if (!key) {
        let n = 1;
        while (items[`${defId}${n === 1 ? '' : n}`]) n++;
        key = `${defId}${n === 1 ? '' : n}`;
        const d = itemDef(defId);
        items[key] = d.kind === 'thrown' ? { def: defId, count: THROWN_COUNT } : { def: defId };
        if (d.ammo) ammo[d.ammo] = AMMO;
      }
      used.push(key);
      return key;
    };
    const main = keyFor(p.main);
    const off = keyFor(p.off);
    loadouts.push({ name: loadoutName(p), main, off });
  }
  return { items, ...(Object.keys(ammo).length ? { ammo } : {}), loadouts, armour };
}

export function loadoutName(p: WeaponPick): string {
  const n = (d: string | null) => (d ? itemDef(d).name : null);
  const main = n(p.main);
  const off = n(p.off);
  if (!main && !off) return 'Unarmed';
  if (main && off) return `${main} + ${off}`;
  return main ?? off!;
}
