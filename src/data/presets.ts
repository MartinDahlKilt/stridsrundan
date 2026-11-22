import type { CharacterSheet } from '../engine/types';

/**
 * Pregenerated characters (implementation-plan §4). Static data – there is no character builder.
 * Skill keys: item ids for weapon/shield skills, plus twoWeapons, brawling, martialArt, fallTechnique.
 */

export const PRESETS: CharacterSheet[] = [
  {
    id: 'mercenary',
    name: 'Mercenary',
    profession: 'warrior',
    professionName: 'Warrior (Krigare)',
    race: 'human',
    description: 'A veteran sell-sword with broadsword and shield in chainmail. Warriors get +5 initiative.',
    attributes: { STY: 16, FYS: 14, SMI: 13, INT: 10, PSY: 11, KAR: 10, STO: 14 },
    handedness: 'right',
    skills: { spotDanger: 10, findHidden: 8, broadsword: 15, heaterShield: 13, dagger: 10, brawling: 8, fallTechnique: 8 },
    equipment: {
      items: { sword: { def: 'broadsword' }, shield: { def: 'heaterShield' }, dagger: { def: 'dagger' } },
      loadouts: [
        { name: 'Broadsword + shield', main: 'sword', off: 'shield' },
        { name: 'Dagger + shield', main: 'dagger', off: 'shield' },
      ],
      armour: ['chain-hauberk', 'openHelm'],
    },
  },
  {
    id: 'barbarian',
    name: 'Northern Barbarian',
    profession: 'barbarian',
    professionName: 'Barbarian (Barbar)',
    race: 'human',
    description: 'A huge northerner with a great axe and little armour. Barbarians get extra KP and SP.',
    attributes: { STY: 18, FYS: 16, SMI: 13, INT: 8, PSY: 12, KAR: 8, STO: 16 },
    handedness: 'right',
    skills: { spotDanger: 12, findHidden: 7, greatAxe: 15, throwingAxe: 11, brawling: 11, fallTechnique: 10 },
    equipment: {
      items: { axe: { def: 'greatAxe' }, throwingAxe: { def: 'throwingAxe', count: 1 } },
      loadouts: [
        { name: 'Great axe', main: 'axe', off: null },
        { name: 'Throwing axe', main: 'throwingAxe', off: null },
      ],
      armour: ['leather-complete', 'leatherCap'],
    },
  },
  {
    id: 'knight',
    name: 'Knight',
    profession: 'knight',
    professionName: 'Knight (Riddare)',
    race: 'human',
    description: 'Full plate and a great helm: hard to hurt, but slow (−1 action).',
    attributes: { STY: 16, FYS: 14, SMI: 12, INT: 11, PSY: 14, KAR: 13, STO: 14 },
    handedness: 'right',
    skills: { spotDanger: 9, findHidden: 8, longsword: 15, kiteShield: 13, dagger: 10, brawling: 8 },
    equipment: {
      items: { sword: { def: 'longsword' }, shield: { def: 'kiteShield' }, dagger: { def: 'dagger' } },
      loadouts: [
        { name: 'Longsword + shield', main: 'sword', off: 'shield' },
        { name: 'Longsword (two hands)', main: 'sword', off: null },
      ],
      armour: ['plate-complete', 'greatHelm'],
    },
  },
  {
    id: 'duellist',
    name: 'Beyural Duellist',
    profession: 'swashbuckler',
    professionName: 'Swashbuckler (Sprätthök)',
    race: 'human',
    description: 'Rapier and main gauche from the fencing school of Beyural: many actions, light armour.',
    attributes: { STY: 14, FYS: 12, SMI: 17, INT: 13, PSY: 12, KAR: 14, STO: 11 },
    handedness: 'right',
    skills: { spotDanger: 10, findHidden: 9, rapier: 16, mainGauche: 14, twoWeapons: 13, brawling: 8, fallTechnique: 12 },
    techniques: { lunge: 12, thrust: 12, predictOpening: 11, strike: 10 },
    equipment: {
      items: { rapier: { def: 'rapier' }, mainGauche: { def: 'mainGauche' } },
      loadouts: [{ name: 'Rapier + main gauche', main: 'rapier', off: 'mainGauche' }],
      armour: ['padded-complete'],
    },
  },
  {
    id: 'kane',
    name: 'Disciple of Kane',
    profession: 'weaponmaster',
    professionName: 'Weapon master (Vapenmästare)',
    race: 'human',
    description: 'Trained in the order of Kane: longsword and small shield, with sword techniques.',
    attributes: { STY: 15, FYS: 13, SMI: 16, INT: 12, PSY: 14, KAR: 11, STO: 13 },
    handedness: 'right',
    skills: { spotDanger: 12, findHidden: 10, longsword: 16, smallRoundShield: 14, brawling: 9, fallTechnique: 11 },
    techniques: { strike: 12, thrust: 12, killingBlow: 9 },
    equipment: {
      items: { sword: { def: 'longsword' }, shield: { def: 'smallRoundShield' } },
      loadouts: [{ name: 'Longsword + shield', main: 'sword', off: 'shield' }],
      armour: ['brigandine-complete', 'openHelm'],
    },
  },
  {
    id: 'huscarl',
    name: 'Hauksheim Huscarl',
    profession: 'soldier',
    professionName: 'Soldier (Soldat)',
    race: 'human',
    description: 'A hirdman from the axe school of Hauksheim with battle axe and large round shield.',
    attributes: { STY: 17, FYS: 15, SMI: 12, INT: 9, PSY: 12, KAR: 10, STO: 15 },
    handedness: 'right',
    skills: { spotDanger: 10, findHidden: 7, battleAxe: 15, largeRoundShield: 13, brawling: 10, fallTechnique: 9 },
    techniques: { strike: 12 },
    equipment: {
      items: { axe: { def: 'battleAxe' }, shield: { def: 'largeRoundShield' } },
      loadouts: [{ name: 'Battle axe + shield', main: 'axe', off: 'shield' }],
      armour: ['chain-mailShirt', 'leather-legs', 'openHelm'],
    },
  },
  {
    id: 'gladiator',
    name: 'Arena Gladiator',
    profession: 'gladiator',
    professionName: 'Gladiator',
    race: 'human',
    description: 'Trident and buckler, patchwork studded leather. The trident reaches an extra square.',
    attributes: { STY: 15, FYS: 14, SMI: 14, INT: 10, PSY: 12, KAR: 12, STO: 13 },
    handedness: 'right',
    skills: { spotDanger: 11, findHidden: 7, trident: 15, buckler: 12, brawling: 11, fallTechnique: 10 },
    equipment: {
      items: { trident: { def: 'trident' }, buckler: { def: 'buckler' } },
      loadouts: [{ name: 'Trident + buckler', main: 'trident', off: 'buckler' }],
      armour: ['studded-harness', 'studded-arms', 'leatherCap'],
    },
  },
  {
    id: 'cutthroat',
    name: 'Cutthroat',
    profession: 'assassin',
    professionName: 'Assassin (Lönnmördare)',
    race: 'human',
    description: 'Throws knives as you close in, then fights with a dagger in each hand.',
    attributes: { STY: 12, FYS: 12, SMI: 16, INT: 12, PSY: 13, KAR: 10, STO: 11 },
    handedness: 'right',
    skills: { spotDanger: 13, findHidden: 12, sneak: 14, hide: 13, dagger: 15, throwingKnife: 14, twoWeapons: 13, brawling: 9, fallTechnique: 12 },
    equipment: {
      items: { knives: { def: 'throwingKnife', count: 3 }, dagger1: { def: 'dagger' }, dagger2: { def: 'dagger' } },
      loadouts: [
        { name: 'Throwing knives + dagger', main: 'knives', off: 'dagger1' },
        { name: 'Two daggers', main: 'dagger1', off: 'dagger2' },
      ],
      armour: ['leather-complete'],
    },
  },
  {
    id: 'ranger',
    name: 'Ranger',
    profession: 'ranger',
    professionName: 'Ranger (Utbygdsjägare)',
    race: 'human',
    description: 'A longbow archer who shoots as long as possible, then draws a short sword.',
    attributes: { STY: 15, FYS: 13, SMI: 15, INT: 12, PSY: 12, KAR: 10, STO: 12 },
    handedness: 'right',
    skills: { spotDanger: 14, findHidden: 13, sneak: 11, hide: 10, longbow: 15, shortSword: 12, brawling: 9, fallTechnique: 8 },
    equipment: {
      items: { bow: { def: 'longbow' }, sword: { def: 'shortSword' } },
      ammo: { arrow: 20 },
      loadouts: [
        { name: 'Longbow', main: 'bow', off: null },
        { name: 'Short sword', main: 'sword', off: null },
      ],
      armour: ['hardLeather-complete', 'hardLeatherCap'],
    },
  },
  {
    id: 'monk',
    name: 'Warrior Monk',
    profession: 'warriorMonk',
    professionName: 'Warrior monk (Krigarmunk)',
    race: 'human',
    description: 'Fights unarmed with a martial art and can parry weapons bare-handed. With the eastern-warriors option on, he can also parry arrows.',
    attributes: { STY: 13, FYS: 13, SMI: 16, INT: 12, PSY: 15, KAR: 10, STO: 12 },
    handedness: 'right',
    skills: { spotDanger: 13, findHidden: 10, martialArt: 15, brawling: 10, fallTechnique: 13 },
    martialArtTechniques: ['crushingPunch', 'roundKick', 'feint', 'initiativeBonus', 'unarmedWeaponParry', 'projectileParry'],
    equipment: {
      items: {},
      loadouts: [{ name: 'Unarmed', main: null, off: null }],
      armour: ['cloth-complete', 'clothHood'],
    },
  },
];

PRESETS.push({
  id: 'samurai',
  name: 'Samurai',
  profession: 'samurai',
  professionName: 'Samurai (eastern)',
  race: 'human',
  eastern: true,
  description: 'An eastern noble warrior in o-yoroi with katana and wakizashi. Eastern armour never costs actions; the katana does extra damage two-handed.',
  attributes: { STY: 15, FYS: 13, SMI: 15, INT: 11, PSY: 13, KAR: 12, STO: 13 },
  handedness: 'right',
  skills: { spotDanger: 12, findHidden: 9, katana: 16, wakizashi: 13, twoWeapons: 12, tanto: 11, brawling: 9, fallTechnique: 10 },
  techniques: { strike: 12, predictOpening: 11, killingBlow: 9 },
  equipment: {
    items: { katana: { def: 'katana' }, wakizashi: { def: 'wakizashi' } },
    loadouts: [
      { name: 'Katana (two hands)', main: 'katana', off: null },
      { name: 'Daishō (katana + wakizashi)', main: 'katana', off: 'wakizashi' },
    ],
    armour: ['kabutoMempo', 'kote', 'laminatedDoMaru', 'suneAteHaidate'],
  },
});

/**
 * Heroes (Hjältarnas Handbok). Hero status follows the hero-point table (HH 532–538); skill values
 * above 20 unlock extra actions and manoeuvres (HH 796–864).
 */
PRESETS.push(
  {
    id: 'aldric',
    name: 'Sir Aldric Dragonslayer',
    profession: 'knight',
    professionName: 'Hero · Knight – Celebrated hero (4)',
    race: 'human',
    description:
      'A sung-about knight who slew a dragon. Longsword FV 24: an extra sword action, Double strike, Lightning attack and Heroic pain strike. Hero abilities: Power strike, Favoured by the gods.',
    attributes: { STY: 17, FYS: 16, SMI: 15, INT: 12, PSY: 16, KAR: 15, STO: 15 },
    handedness: 'right',
    skills: { spotDanger: 17, findHidden: 15, longsword: 24, kiteShield: 20, dagger: 15, brawling: 12, fallTechnique: 14 },
    techniques: { strike: 15 },
    hero: { status: 4, heroPoints: 15, abilities: ['powerStrike', 'favouredByGods'], title: 'Dragonslayer' },
    equipment: {
      items: { sword: { def: 'longsword' }, shield: { def: 'kiteShield' } },
      loadouts: [
        { name: 'Longsword + shield', main: 'sword', off: 'shield' },
        { name: 'Longsword (two hands)', main: 'sword', off: null },
      ],
      armour: ['chain-hauberk', 'openHelm'],
    },
  },
  {
    id: 'vargan',
    name: 'Vargan the Wild Beast',
    profession: 'barbarian',
    professionName: 'Hero · Barbarian – Experienced hero (2)',
    race: 'human',
    description:
      'Half beast, all fury. Great axe FV 23 (extra axe action, Double strike, Heroic pain strike). Wild beast: once blood flows, +1T6 damage, +3 CL and an extra action. Steeling: shrugs off wounds.',
    attributes: { STY: 19, FYS: 17, SMI: 14, INT: 9, PSY: 13, KAR: 9, STO: 17 },
    handedness: 'right',
    skills: { spotDanger: 15, findHidden: 11, greatAxe: 23, throwingAxe: 14, brawling: 15, fallTechnique: 12 },
    hero: { status: 2, heroPoints: 8, abilities: ['wildBeast', 'steeled'], title: 'the Wild Beast' },
    equipment: {
      items: { axe: { def: 'greatAxe' } },
      loadouts: [{ name: 'Great axe', main: 'axe', off: null }],
      armour: ['leather-complete', 'leatherCap'],
    },
  },
  {
    id: 'ilsabet',
    name: 'Ilsabet Swiftblade',
    profession: 'swashbuckler',
    professionName: 'Hero · Swashbuckler – Veteran (3)',
    race: 'human',
    description:
      'The fastest blade in Ereb. Rapier FV 32: Triple strike, Lightning attack, an extra rapier action. Always strikes first (Quick striker) and parries arrows and thrown weapons with her blade.',
    attributes: { STY: 14, FYS: 13, SMI: 18, INT: 14, PSY: 14, KAR: 15, STO: 11 },
    handedness: 'right',
    skills: { spotDanger: 16, findHidden: 21, rapier: 32, mainGauche: 22, twoWeapons: 22, brawling: 12, fallTechnique: 18, drawWeapon: 21 },
    techniques: { lunge: 18, thrust: 18, predictOpening: 16 },
    hero: { status: 3, heroPoints: 12, abilities: ['quickStriker', 'projectileParry'], title: 'Swiftblade' },
    equipment: {
      items: { rapier: { def: 'rapier' }, mainGauche: { def: 'mainGauche' } },
      loadouts: [{ name: 'Rapier + main gauche', main: 'rapier', off: 'mainGauche' }],
      armour: ['padded-complete'],
    },
  },
  {
    id: 'morgrath',
    name: 'Morgrath the Black',
    profession: 'warrior',
    professionName: 'Dark hero · Warrior – Veteran (3, counts as 4)',
    race: 'human',
    description:
      'A dark hero in black plate wielding a bastard sword with both hands (FV 26). Steeling and Power strike; as a dark hero he is one step more frightening when psyching out his foes.',
    attributes: { STY: 18, FYS: 16, SMI: 13, INT: 14, PSY: 17, KAR: 8, STO: 16 },
    handedness: 'right',
    skills: { spotDanger: 18, findHidden: 16, bastardSword: 26, dagger: 14, brawling: 12, fallTechnique: 10 },
    hero: { status: 3, heroPoints: 14, dark: true, abilities: ['steeled', 'powerStrike'], title: 'the Black' },
    equipment: {
      items: { sword: { def: 'bastardSword' } },
      loadouts: [{ name: 'Bastard sword (two hands)', main: 'sword', off: null }],
      armour: ['plate-complete', 'visorHelm'],
    },
  },
);

/**
 * Wizards (Magiker, basic rules + Magikerns Handbok). All elementalists: school FV caps the effect grade, and every
 * spell has S ≥ 1 with skolvärde ≤ the school FV. No iron – wooden staves and leather or cloth only (§22.1).
 * At most (INT + PSY)/4 spells memorised (III 278).
 */
PRESETS.push(
  {
    id: 'pyromancer',
    name: 'Pyromancer',
    profession: 'wizard',
    professionName: 'Wizard (Magiker) – fire',
    race: 'human',
    description:
      'A fire wizard in thick robes. ELD and ELDKLOT from afar – four actions each, so two rounds of chanting – INRE ELD that burns from within (resisted by PSY), FLAMMANDE HAND for close work and SKÖLD to turn a blow.',
    attributes: { STY: 10, FYS: 12, SMI: 13, INT: 16, PSY: 17, KAR: 12, STO: 11 },
    handedness: 'right',
    skills: { spotDanger: 9, findHidden: 11, quarterstaff: 10, brawling: 6 },
    magic: { schools: { elemental: 16 }, spells: { shield: 12, flamingHand: 10, fire: 14, fireball: 14, innerFire: 11 } },
    equipment: {
      items: { staff: { def: 'quarterstaff' } },
      loadouts: [{ name: 'Quarterstaff', main: 'staff', off: null }],
      armour: ['cloth-complete'],
    },
  },
  {
    id: 'frostWitch',
    name: 'Frost Witch',
    profession: 'wizard',
    professionName: 'Wizard (Magiker) – cold',
    race: 'human',
    description:
      'A wizard of the cold. KALLA HANDEN (quick, 2 actions) freezes a foe in place for the round; ISKLOT and ISMISSILER batter from range, FROST chills the whole body and FÖRFRYSA ignores armour if it beats the target’s PSY.',
    attributes: { STY: 9, FYS: 13, SMI: 14, INT: 16, PSY: 16, KAR: 13, STO: 10 },
    handedness: 'right',
    skills: { spotDanger: 9, findHidden: 11, quarterstaff: 10, brawling: 6 },
    magic: { schools: { elemental: 15 }, spells: { shield: 13, coldHand: 14, frost: 12, iceBall: 14, iceMissiles: 11, freeze: 12 } },
    equipment: {
      items: { staff: { def: 'quarterstaff' } },
      loadouts: [{ name: 'Quarterstaff', main: 'staff', off: null }],
      armour: ['cloth-complete', 'clothHood'],
    },
  },
  {
    id: 'stormCaller',
    name: 'Storm Caller',
    profession: 'wizard',
    professionName: 'Wizard (Magiker) – air',
    race: 'human',
    description:
      'A wizard of wind and lightning. BLIXT is quick (2 actions) and ignores armour – deadly against knights. VIRVELSKÖLD blows arrows aside, VINDSTÖT strikes where aimed, and KVÄVA tears the breath from a foe who fails to resist.',
    attributes: { STY: 11, FYS: 12, SMI: 15, INT: 15, PSY: 16, KAR: 11, STO: 12 },
    handedness: 'right',
    skills: { spotDanger: 10, findHidden: 10, quarterstaff: 11, brawling: 7 },
    magic: { schools: { elemental: 15 }, spells: { shield: 12, lightning: 14, gust: 13, whirlwind: 13, suffocate: 10 } },
    equipment: {
      items: { staff: { def: 'quarterstaff' } },
      loadouts: [{ name: 'Quarterstaff', main: 'staff', off: null }],
      armour: ['leather-complete'],
    },
  },
  {
    id: 'stoneShaper',
    name: 'Stone Shaper',
    profession: 'wizard',
    professionName: 'Wizard (Magiker) – earth',
    race: 'human',
    description:
      'A sturdy earth wizard in hardened leather with a war staff. KNÄCKA (quick) shatters weapons and shields, FÖRBANNA VAPEN blunts them, KROSSANDE KLIPPBLOCK drops a boulder on a chosen spot – usually the head – and KLIPPSVÄRM buries everything nearby.',
    attributes: { STY: 13, FYS: 15, SMI: 11, INT: 15, PSY: 16, KAR: 9, STO: 13 },
    handedness: 'right',
    skills: { spotDanger: 9, findHidden: 12, warStaff: 11, brawling: 8 },
    magic: { schools: { elemental: 16 }, spells: { shield: 12, shatter: 14, curseWeapon: 11, boulder: 14, rockSwarm: 10 } },
    equipment: {
      items: { staff: { def: 'warStaff' } },
      loadouts: [{ name: 'War staff', main: 'staff', off: null }],
      armour: ['hardLeather-complete', 'hardLeatherCap'],
    },
  },
);

/**
 * Hero magician. Ärkemagiker are always heroes (MH 1053–1086). Skill values above 30 make spells faster
 * (MH 1903): SKÖLD and KALLA HANDEN take one action.
 */
PRESETS.push({
  id: 'vaelis',
  name: 'Vaelis the Archmage',
  profession: 'archmage',
  professionName: 'Hero · Archmage (Ärkemagiker) – Celebrated hero (4)',
  race: 'human',
  description:
    'A celebrated hero of the arcane. With S above 30, SKÖLD snaps up as a one-action parry and KALLA HANDEN freezes a foe with a single action; BLIXT is quick anyway. PSY 21 plus 5 stored in her staff, effect grades up to 20, and hero points to force a spell through.',
  attributes: { STY: 11, FYS: 14, SMI: 15, INT: 19, PSY: 21, KAR: 15, STO: 12 },
  handedness: 'right',
  skills: { spotDanger: 18, findHidden: 22, quarterstaff: 14, brawling: 8 },
  hero: { status: 4, heroPoints: 12, abilities: ['fearless'], title: 'the Archmage' },
  magic: {
    schools: { elemental: 20 },
    spells: { shield: 31, coldHand: 31, lightning: 22, fireball: 24, boulder: 24, freeze: 22, innerFire: 20, explosion: 18, whirlwind: 22, drown: 18 },
    staffPsy: 5,
  },
  equipment: {
    items: { staff: { def: 'quarterstaff' } },
    loadouts: [{ name: 'Staff of the Seventh Tower', main: 'staff', off: null }],
    armour: ['padded-complete'],
  },
});

export function presetById(id: string): CharacterSheet {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset "${id}"`);
  return p;
}
