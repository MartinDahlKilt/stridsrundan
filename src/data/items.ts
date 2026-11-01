import type { DamageKind, ItemDef, WeaponGroup } from '../engine/types';

/**
 * Weapons and shields – combat-rules §16. Damage values are from Krigarens Handbok (KP/SP split);
 * two-handed markers, ammo and special flags from the basic rules (II/III).
 */

type W = Omit<ItemDef, 'kind' | 'group' | 'damageKind'> & { damageKind?: DamageKind };

function group(kind: ItemDef['kind'], g: WeaponGroup, damageKind: DamageKind, extra: Partial<ItemDef>, items: W[]): ItemDef[] {
  return items.map((w) => ({ kind, group: g, ...extra, ...w, damageKind: w.damageKind ?? damageKind }));
}

const daggers = group('melee', 'dagger', 'thrust', { lightForCrits: true }, [
  { id: 'dagger', name: 'Dagger', sv: 'Dolk', kp: '1T4+1', sp: '1T3', sty: 1, length: 0, weight: 0.5, bv: 9 },
  { id: 'ballockDagger', name: 'Ballock dagger', sv: 'Testikeldolk', kp: '1T6', sp: '1T3', sty: 1, length: 0, weight: 0.5, bv: 15 },
  { id: 'mainGauche', name: 'Main gauche', sv: 'Parerdolk', kp: '1T4+1', sp: '1T3', sty: 1, length: 0, weight: 0.5, bv: 15, parryBonus: 3 },
  { id: 'stiletto', name: 'Stiletto', sv: 'Stilett', kp: '1T3', sp: '1T3', sty: 1, length: 0, weight: 0.25, bv: 5 },
]);

const swords = group('melee', 'sword1h', 'cut', {}, [
  { id: 'bastardSword', name: 'Bastard sword', sv: 'Bastardsvärd', kp: '1T10+1', sp: '1T8', sty: 17, length: 0, weight: 5.5, bv: 15 },
  { id: 'broadsword', name: 'Broadsword', sv: 'Bredsvärd', kp: '1T8+1', sp: '1T6', sty: 13, length: 0, weight: 4.5, bv: 15 },
  { id: 'falchion', name: 'Falchion', sv: 'Falchion', kp: '1T8', sp: '1T6', sty: 11, length: 0, weight: 4, bv: 15 },
  { id: 'shortSword', name: 'Short sword', sv: 'Kortsvärd', kp: '1T6+1', sp: '1T4', sty: 7, length: 0, weight: 2, bv: 15 },
  { id: 'scimitar', name: 'Scimitar', sv: 'Kroksabel', kp: '1T8+1', sp: '1T6+1', sty: 9, length: 0, weight: 3, bv: 15 },
  { id: 'longsword', name: 'Longsword', sv: 'Långsvärd', kp: '1T10', sp: '1T6', sty: 11, length: 0, weight: 4, bv: 15 },
  { id: 'sabre', name: 'Sabre', sv: 'Sabel', kp: '1T8', sp: '1T4', sty: 9, length: 0, weight: 3, bv: 15 },
  { id: 'estoc', name: 'Estoc', sv: 'Stickvärja', kp: '1T6+1', sp: '1T3', sty: 7, length: 0, weight: 2, bv: 8, damageKind: 'thrust' },
  { id: 'trainingSword', name: 'Training sword', sv: 'Träningssvärd', kp: '0', sp: '1T6', sty: 7, length: 0, weight: 2, bv: 7, damageKind: 'blunt' },
  { id: 'rapier', name: 'Rapier', sv: 'Värja', kp: '1T8+1', sp: '1T6', sty: 9, length: 0, weight: 3, bv: 12, damageKind: 'thrust' },
]);

const blunt = group('melee', 'blunt1h', 'blunt', {}, [
  { id: 'helmCrusher', name: 'Helm crusher', sv: 'Hjälmkrossare', kp: '1T6', sp: '1T10', sty: 11, length: 0, weight: 4, bv: 15 },
  { id: 'club', name: 'Club', sv: 'Klubba', kp: '1T4', sp: '1T6', sty: 5, length: 0, weight: 1, bv: 7 },
  { id: 'morningStar', name: 'Morning star', sv: 'Morgonstjärna', kp: '1T8', sp: '1T10+1', sty: 13, length: 0, weight: 4.5, bv: 11 },
  { id: 'spikedClub', name: 'Spiked club', sv: 'Spikklubba', kp: '1T6', sp: '1T6', sty: 5, length: 0, weight: 1, bv: 7 },
  { id: 'warHammer', name: 'War hammer', sv: 'Stridshammare', kp: '1T6', sp: '1T10', sty: 11, length: 0, weight: 4, bv: 15 },
  { id: 'mace', name: 'Mace', sv: 'Stridsklubba', kp: '1T6', sp: '1T8', sty: 9, length: 0, weight: 3, bv: 11 },
  { id: 'heavySpikedClub', name: 'Heavy spiked club', sv: 'Tung spikklubba', kp: '2T4', sp: '1T10', sty: 21, length: 0, weight: 6, bv: 11 },
  { id: 'greatClub', name: 'Great club', sv: 'Tung träklubba', kp: '1T8', sp: '1T10', sty: 21, length: 0, weight: 6, bv: 11 },
]);

const axes = group('melee', 'axe1h', 'cut', {}, [
  { id: 'broadAxe', name: 'Broad axe', sv: 'Bredyxa', kp: '1T8+1', sp: '1T6', sty: 9, length: 0, weight: 3, bv: 11 },
  { id: 'handAxe', name: 'Hand axe', sv: 'Handyxa', kp: '1T6+1', sp: '1T4', sty: 9, length: 0, weight: 3, bv: 11 },
  { id: 'crowsBeak', name: "Crow's beak", sv: 'Korpnäbb', kp: '1T8', sp: '1T6', sty: 7, length: 0, weight: 2, bv: 15, damageKind: 'thrust' },
  { id: 'battleAxe', name: 'Battle axe', sv: 'Stridsyxa', kp: '1T8+2', sp: '1T6', sty: 11, length: 0, weight: 4, bv: 11 },
]);

const twoHanded = group('melee', 'twoHanded', 'cut', {}, [
  { id: 'flamberge', name: 'Flamberge', sv: 'Flamberge', kp: '2T10+1', sp: '1T10', sty: 31, length: 1, weight: 8, bv: 15, twoHandedOnly: true },
  { id: 'beardedAxe', name: 'Bearded axe', sv: 'Skäggyxa', kp: '2T8+1', sp: '1T8', sty: 25, length: 0, weight: 6.5, bv: 11 },
  { id: 'greatFlail', name: 'Two-handed flail', sv: 'Tvåhandsgissel', kp: '2T6', sp: '2T6+2', sty: 31, length: 1, weight: 8, bv: 15, twoHandedOnly: true, damageKind: 'blunt' },
  { id: 'greatHammer', name: 'Great hammer', sv: 'Tvåhandshammare', kp: '1T10', sp: '2T6+2', sty: 31, length: 1, weight: 8, bv: 15, twoHandedOnly: true, damageKind: 'blunt' },
  { id: 'greatSword', name: 'Two-handed sword', sv: 'Tvåhandssvärd', kp: '2T10+2', sp: '1T8+1', sty: 31, length: 1, weight: 8, bv: 15, twoHandedOnly: true },
  { id: 'greatAxe', name: 'Great axe', sv: 'Tvåhandsyxa', kp: '2T10+1', sp: '1T8', sty: 31, length: 1, weight: 8, bv: 11, twoHandedOnly: true },
]);

const spears = group('melee', 'spear', 'thrust', { noBvDamage: true }, [
  { id: 'boarSpear', name: 'Boar spear', sv: 'Jaktspjut', kp: '1T8', sp: '1T8', sty: 10, length: 1, weight: 6, bv: 20, twoHandedOnly: true },
  { id: 'shortSpear', name: 'Short spear', sv: 'Kortspjut', kp: '1T6', sp: '1T4', sty: 7, length: 1, weight: 2, bv: 11 },
  { id: 'longSpear', name: 'Long spear', sv: 'Långspjut', kp: '1T10', sp: '1T6', sty: 11, length: 2, weight: 4, bv: 11, twoHandedOnly: true },
  { id: 'pike', name: 'Pike', sv: 'Pik', kp: '2T8-1', sp: '1T8', sty: 25, length: 3, weight: 6.5, bv: 11, twoHandedOnly: true },
  { id: 'spetum', name: 'Spetum', sv: 'Spetum', kp: '2T8+1', sp: '1T8', sty: 27, length: 1, weight: 7, bv: 11, twoHandedOnly: true },
  { id: 'trident', name: 'Trident', sv: 'Treudd', kp: '3T6-1', sp: '1T6', sty: 15, length: 1, weight: 5, bv: 11 },
]);

const flails = group('melee', 'flail', 'blunt', { chain: true }, [
  { id: 'peasantFlail', name: 'Peasant flail', sv: 'Bondeslaga', kp: '1T6', sp: '1T8', sty: 15, length: 0, weight: 3, bv: 9 },
  { id: 'flail', name: 'Flail', sv: 'Stridsgissel u. spik', kp: '1T6', sp: '1T10+1', sty: 11, length: 0, weight: 4, bv: 11 },
  { id: 'spikedFlail', name: 'Spiked flail', sv: 'Stridsgissel m. spik', kp: '1T8', sp: '1T10', sty: 13, length: 0, weight: 4.5, bv: 11 },
  { id: 'warFlail', name: 'War flail', sv: 'Stridsslaga', kp: '1T8+1', sp: '2T6', sty: 25, length: 0, weight: 6.5, bv: 11 },
]);

const whips = group('melee', 'whip', 'blunt', { chain: true }, [
  { id: 'catONineTails', name: "Cat o' nine tails", sv: 'Niosvansad katt', kp: '1T4', sp: '1T8', sty: 12, length: 0, weight: 3, bv: 3 },
  { id: 'bullwhip', name: 'Bullwhip', sv: 'Oxpiska', kp: '1T3', sp: '1T6+1', sty: 11, length: 1, weight: 4, bv: 5 },
  { id: 'whip', name: 'Whip', sv: 'Piska', kp: '1T2', sp: '1T4+1', sty: 9, length: 1, weight: 3, bv: 3 },
]);

const polearms = group('melee', 'polearm', 'cut', { twoHandedOnly: true }, [
  { id: 'glaive', name: 'Glaive', sv: 'Glav', kp: '2T10', sp: '1T10', sty: 27, length: 1, weight: 7, bv: 11 },
  { id: 'halberd', name: 'Halberd', sv: 'Hillebard', kp: '3T6+1', sp: '1T8', sty: 29, length: 1, weight: 7.5, bv: 11 },
  { id: 'partisan', name: 'Partisan', sv: 'Partisan', kp: '2T8+2', sp: '1T8', sty: 27, length: 1, weight: 7, bv: 11, damageKind: 'thrust' },
  { id: 'poleaxe', name: 'Poleaxe', sv: 'Pålyxa', kp: '3T6', sp: '1T8', sty: 29, length: 1, weight: 7.5, bv: 11 },
  { id: 'quarterstaff', name: 'Quarterstaff', sv: 'Trästav', kp: '1T3', sp: '1T8', sty: 7, length: 0, weight: 2, bv: 7, damageKind: 'blunt', noBvDamage: true },
  { id: 'warStaff', name: 'War staff', sv: 'Trästav, strids-', kp: '1T4', sp: '1T10', sty: 9, length: 0, weight: 3, bv: 11, damageKind: 'blunt', noBvDamage: true },
]);

const bows = group('projectile', 'bow', 'thrust', { twoHandedOnly: true, ammo: 'arrow', reload: 0, lightForCrits: true }, [
  { id: 'shortBow', name: 'Short bow', sv: 'Kortbåge', kp: '1T6+1', sp: '1T4', sty: 18, length: 0, weight: 2, bv: null, range: 135, pv: { kp: 0, sp: 0 } },
  { id: 'longbow', name: 'Longbow', sv: 'Långbåge', kp: '1T8+1', sp: '1T6', sty: 30, length: 0, weight: 3, bv: null, range: 180, pv: { kp: 2, sp: 1 } },
  { id: 'smallBow', name: 'Small bow', sv: 'Pilbåge', kp: '1T4+1', sp: '1T3', sty: 10, length: 0, weight: 1.5, bv: null, range: 135, pv: { kp: 1, sp: 0 } },
  { id: 'horseBow', name: 'Horse bow', sv: 'Ryttarbåge', kp: '1T8', sp: '1T6', sty: 25, length: 0, weight: 3, bv: null, range: 100, pv: { kp: 1, sp: 1 } },
  { id: 'compositeBow', name: 'Composite bow', sv: 'Sammansatt båge', kp: '1T10+1', sp: '1T8', sty: 30, length: 0, weight: 3.5, bv: null, range: 180, pv: { kp: 2, sp: 2 } },
]);

const crossbows = group('projectile', 'crossbow', 'thrust', { twoHandedOnly: true, ammo: 'bolt', lightForCrits: true }, [
  { id: 'arbalest', name: 'Arbalest', sv: 'Arbalest', kp: '3T6+3', sp: '1T10', sty: 32, length: 0, weight: 8, bv: null, range: 250, reload: 12, pv: { kp: 4, sp: 2 } },
  { id: 'lightCrossbow', name: 'Light crossbow', sv: 'Lätt armborst', kp: '2T4+2', sp: '1T6', sty: 26, length: 0, weight: 5, bv: null, range: 150, reload: 3, pv: { kp: 2, sp: 1 } },
  { id: 'heavyCrossbow', name: 'Heavy crossbow', sv: 'Tungt armborst', kp: '2T6+2', sp: '1T8', sty: 28, length: 0, weight: 6, bv: null, range: 225, reload: 6, pv: { kp: 2, sp: 2 } },
]);

const slings = group('projectile', 'sling', 'blunt', { twoHandedOnly: true, ammo: 'stone' }, [
  { id: 'sling', name: 'Sling', sv: 'Slunga', kp: '1T6', sp: '1T4', sty: 10, length: 0, weight: 0.5, bv: null, range: 90, reload: 0, pv: { kp: 0, sp: 0 } },
  { id: 'staffSling', name: 'Staff sling', sv: 'Stavslunga', kp: '1T8', sp: '1T6', sty: 22, length: 0, weight: 2, bv: null, range: 120, reload: 1, pv: { kp: 0, sp: 0 } },
]);

const thrown = group('thrown', 'thrown', 'thrust', { oneHandedOnly: true, rangeIsSty: true, pv: { kp: 0, sp: 0 } }, [
  { id: 'throwingKnife', name: 'Throwing knife', sv: 'Kastkniv', kp: '1T4+1', sp: '1T3', sty: 3, length: 0, weight: 0.5, bv: 9, lightForCrits: true },
  { id: 'javelin', name: 'Javelin', sv: 'Kastspjut', kp: '1T6+1', sp: '1T4', sty: 7, length: 0, weight: 1, bv: 11 },
  { id: 'throwingAxe', name: 'Throwing axe', sv: 'Kastyxa', kp: '1T6+2', sp: '1T4', sty: 11, length: 0, weight: 3, bv: 11, damageKind: 'cut' },
]);

const shields = group('shield', 'shield', 'blunt', {}, [
  { id: 'buckler', name: 'Buckler', sv: 'Targ', kp: '1T3', sp: '1T3', sty: 1, length: 0, weight: 1, bv: 9, covers: ['shieldArm'] },
  { id: 'smallRoundShield', name: 'Small round shield', sv: 'Rundsköld, liten', kp: '1T3', sp: '1T4', sty: 3, length: 0, weight: 2, bv: 9, covers: ['shieldArm'] },
  { id: 'largeRoundShield', name: 'Large round shield', sv: 'Rundsköld, stor', kp: '1T4', sp: '1T6', sty: 11, length: 0, weight: 7, bv: 11, covers: ['shieldArm', 'abdomen', 'chest'] },
  { id: 'kiteShield', name: 'Kite shield', sv: 'Långsköld', kp: '1T4', sp: '1T6', sty: 7, length: 0, weight: 6, bv: 11, covers: ['shieldArm', 'chest', 'shieldLeg'] },
  { id: 'heaterShield', name: 'Heater shield', sv: 'Vanlig sköld', kp: '1T4', sp: '1T6', sty: 7, length: 0, weight: 6, bv: 11, covers: ['shieldArm', 'chest'] },
  { id: 'scutum', name: 'Scutum', sv: 'Scutata', kp: '1T4+1', sp: '1T6', sty: 7, length: 0, weight: 8, bv: 13, covers: ['shieldArm', 'abdomen', 'chest'] },
  { id: 'pavise', name: 'Pavise', sv: 'Pavise', kp: '1T4+1', sp: '1T6', sty: 18, length: 0, weight: 16, bv: 11, covers: ['shieldArm', 'abdomen', 'chest', 'shieldLeg'] },
]);

/** Eastern weapons (KH 7074–7150) – only used with the eastern-warriors rules option. */
const easternSwords = group('melee', 'sword1h', 'cut', { eastern: true }, [
  { id: 'katana', name: 'Katana', sv: 'Katana', kp: '1T8+2', sp: '1T6', sty: 9, length: 0, weight: 3, bv: 12, twoHandedDamage: { kp: '1T10+2', sp: '1T8' } },
  { id: 'wakizashi', name: 'Wakizashi', sv: 'Wakizashi', kp: '1T6+1', sp: '1T4', sty: 7, length: 0, weight: 2, bv: 12 },
  { id: 'ninjato', name: 'Ninjato', sv: 'Ninjato', kp: '1T8', sp: '1T6', sty: 9, length: 0, weight: 3, bv: 12 },
]);
const easternDaggers = group('melee', 'dagger', 'thrust', { eastern: true, lightForCrits: true }, [
  { id: 'tanto', name: 'Tanto', sv: 'Tanto', kp: '1T4+1', sp: '1T3', sty: 1, length: 0, weight: 0.5, bv: 9 },
  { id: 'aiguchi', name: 'Aiguchi', sv: 'Aiguchi', kp: '1T4', sp: '1T3', sty: 1, length: 0, weight: 0.5, bv: 7 },
]);
const easternPolearms = group('melee', 'polearm', 'cut', { eastern: true, twoHandedOnly: true }, [
  { id: 'naginata', name: 'Naginata', sv: 'Naginata', kp: '2T8+1', sp: '1T8', sty: 21, length: 1, weight: 6, bv: 11 },
  { id: 'nodachi', name: 'Nodachi', sv: 'Nodachi', kp: '2T8+2', sp: '1T8', sty: 27, length: 1, weight: 7, bv: 13 },
]);
const easternBows = group('projectile', 'bow', 'thrust', { eastern: true, twoHandedOnly: true, ammo: 'arrow', reload: 0, lightForCrits: true }, [
  { id: 'daikyu', name: 'Daikyū', sv: 'Dai-kyu', kp: '1T8+1', sp: '1T6', sty: 30, length: 0, weight: 3, bv: null, range: 180, pv: { kp: 2, sp: 1 } },
  { id: 'hankyu', name: 'Hankyū', sv: 'Han-kyu', kp: '1T8', sp: '1T6', sty: 24, length: 0, weight: 3, bv: null, range: 135, pv: { kp: 1, sp: 1 } },
]);

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [...easternSwords, ...easternDaggers, ...easternPolearms, ...easternBows, ...daggers, ...swords, ...blunt, ...axes, ...twoHanded, ...spears, ...flails, ...whips, ...polearms, ...bows, ...crossbows, ...slings, ...thrown, ...shields].map((i) => [i.id, i]),
);

/**
 * Items without iron – a wizard may hold them and still cast (III 507–520). Everything else counts as iron:
 * blades, iron-headed weapons, shields with iron bosses and rims (🔧 SIM-20).
 */
const NON_IRON = new Set(['quarterstaff', 'warStaff', 'club', 'greatClub', 'trainingSword', 'sling', 'staffSling', 'shortBow', 'longbow', 'smallBow', 'horseBow', 'compositeBow', 'daikyu', 'hankyu']);

export function isIron(def: ItemDef): boolean {
  return !NON_IRON.has(def.id);
}

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item "${id}"`);
  return d;
}

// ---------------------------------------------------------------------------
// Unarmed attacks (KH table §16). Punch needs a free hand; martial-art attacks need the technique.
// ---------------------------------------------------------------------------

export interface UnarmedAttackDef {
  id: string;
  name: string;
  sv: string;
  kp: string;
  sp: string;
  length: number;
  needsFreeHand: boolean;
  /** Martial-art technique required (otherwise available through Slagsmål / brawling). */
  technique?: string;
  initiativePenalty?: number;
}

export const UNARMED: Record<string, UnarmedAttackDef> = {
  punch: { id: 'punch', name: 'Punch', sv: 'Normalt slag', kp: '1T2', sp: '1T3', length: 0, needsFreeHand: true },
  kick: { id: 'kick', name: 'Kick', sv: 'Normal spark', kp: '1T4', sp: '1T6', length: 0, needsFreeHand: false },
  crushingPunch: { id: 'crushingPunch', name: 'Crushing punch', sv: 'Krosslag', kp: '1T4', sp: '1T6', length: 0, needsFreeHand: true, technique: 'crushingPunch' },
  roundKick: { id: 'roundKick', name: 'Round kick', sv: 'Rundspark', kp: '1T6', sp: '1T6+1', length: 0, needsFreeHand: false, technique: 'roundKick' },
  jumpKick: { id: 'jumpKick', name: 'Jump kick', sv: 'Hoppspark', kp: '1T6', sp: '1T6+1', length: 1, needsFreeHand: false, technique: 'jumpKick' },
  fallingKick: { id: 'fallingKick', name: 'Falling kick', sv: 'Fallande spark', kp: '1T6', sp: '1T8', length: 1, needsFreeHand: false, technique: 'fallingKick' },
};

/** Attribute each weapon group's skill is based on (§2.7). Used for the carrying-capacity penalty. */
export const GROUP_ATTRIBUTE: Record<WeaponGroup, 'STY' | 'SMI'> = {
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
  unarmed: 'SMI',
};

export const AMMO_NAMES: Record<string, string> = { arrow: 'arrows', bolt: 'bolts', stone: 'sling stones' };
