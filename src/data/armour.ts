import type { ArmourPieceDef, GlanceClass, Location } from '../engine/types';

/** Armour – combat-rules §17 (Krigarens Handbok values, separate KP/SP absorption). */

interface Material {
  id: string;
  name: string;
  sv: string;
  absKP: number;
  absSP: number;
  type: 1 | 2 | 3;
  glance: GlanceClass;
  heavierThanLeather: boolean;
}

const M = (id: string, name: string, sv: string, absKP: number, absSP: number, type: 1 | 2 | 3, glance: GlanceClass): Material => ({
  id,
  name,
  sv,
  absKP,
  absSP,
  type,
  glance,
  heavierThanLeather: absKP > 2,
});

export const MATERIALS: Record<string, Material> = Object.fromEntries(
  [
    M('cloth', 'Thick cloth', 'Tjockt tyg', 1, 2, 1, null),
    M('leather', 'Leather', 'Läder', 2, 2, 1, null),
    M('padded', 'Padded', 'Vadderat', 3, 5, 1, null),
    M('studded', 'Studded leather', 'Nitläder', 3, 2, 3, null),
    M('hardLeather', 'Hardened leather', 'Härdat läder', 4, 3, 3, null),
    M('boneLamellar', 'Bone lamellar', 'Benlamell', 4, 3, 3, 'lamellar'),
    M('brigandine', 'Brigandine', 'Brigandin', 5, 3, 3, null),
    M('ringArmour', 'Ring armour', 'Ringpansar', 5, 3, 3, 'chain'),
    M('scale', 'Scale', 'Fjällpansar', 5, 3, 3, 'lamellar'),
    M('chain', 'Chainmail', 'Ringbrynja', 5, 4, 2, 'chain'),
    M('reinforcedChain', 'Reinforced chainmail', 'Förstärkt ringbrynja', 6, 4, 2, 'chain'),
    M('doubleChain', 'Double chainmail', 'Dubbel ringbrynja', 7, 4, 2, 'chain'),
    M('lamellar', 'Lamellar', 'Lamell', 7, 3, 3, 'lamellar'),
    M('laminated', 'Laminated', 'Laminerat', 8, 4, 3, 'metal'),
    M('plate', 'Plate', 'Metall', 8, 4, 3, 'metal'),
    M('fluted', 'Fluted plate', 'Räfflad metall', 9, 4, 3, 'metal'),
  ].map((m) => [m.id, m]),
);

/**
 * Materials containing iron (III 507: a wizard can't cast while enclosed in iron). Brigandine has riveted
 * iron plates; studded leather's rivets and bone lamellar don't count (🔧 SIM-20).
 */
const IRON_MATERIALS = new Set(['brigandine', 'ringArmour', 'scale', 'chain', 'reinforcedChain', 'doubleChain', 'lamellar', 'laminated', 'plate', 'fluted', 'parade']);
const IRON_HELMETS = new Set(['mailCoif', 'doubleMailCoif', 'openHelm', 'visorHelm', 'greatHelm']);

const ALL_BUT_HEAD: Location[] =['chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

/** Weights per slot (KH 4045–4157). Arm/leg weights are per limb; pieces here are pairs. */
const SLOT_WEIGHTS: Record<string, Partial<Record<string, number>>> = {
  arms: { cloth: 0.3, leather: 0.6, studded: 1.2, padded: 0.6, hardLeather: 0.6, boneLamellar: 0.8, brigandine: 1.5, ringArmour: 2.5, chain: 2.5, reinforcedChain: 3.5, doubleChain: 2.7, lamellar: 2.5, laminated: 3.5, plate: 3.0, fluted: 3.5 },
  legs: { cloth: 0.45, leather: 0.9, studded: 1.8, padded: 0.9, hardLeather: 0.9, boneLamellar: 1.2, ringArmour: 3.75, chain: 3.75, reinforcedChain: 5.25, doubleChain: 4.05, lamellar: 3.75, laminated: 5.25, plate: 4.5, fluted: 5.25 },
  harness: { cloth: 1.2, leather: 2.4, studded: 4.8, hardLeather: 2.4, padded: 2.4, boneLamellar: 3.2, brigandine: 6, ringArmour: 10, scale: 10, chain: 10, reinforcedChain: 14, doubleChain: 10.8, lamellar: 10, laminated: 14, plate: 12, fluted: 14 },
  mailShirt: { cloth: 1.8, leather: 3.6, studded: 7.2, hardLeather: 3.6, padded: 3.6, boneLamellar: 4.8, brigandine: 9, ringArmour: 15, scale: 15, chain: 15, reinforcedChain: 21, doubleChain: 16.2 },
  hauberk: { cloth: 2.7, leather: 5.4, studded: 10.8, hardLeather: 5.4, padded: 5.4, boneLamellar: 7.2, brigandine: 12.5, ringArmour: 22.5, scale: 22.5, chain: 22.5, reinforcedChain: 31.5, doubleChain: 24.3 },
};

const SLOT_INFO: Record<string, { name: string; sv: string; covers: Location[]; pair: boolean }> = {
  arms: { name: 'arm guards', sv: 'Armskydd', covers: ['leftArm', 'rightArm'], pair: true },
  legs: { name: 'leg guards', sv: 'Benskydd', covers: ['leftLeg', 'rightLeg'], pair: true },
  harness: { name: 'cuirass', sv: 'Harnesk', covers: ['chest', 'abdomen'], pair: false },
  mailShirt: { name: 'shirt', sv: 'Brynja', covers: ['chest', 'abdomen', 'leftArm', 'rightArm'], pair: false },
  hauberk: { name: 'hauberk', sv: 'Hauberk', covers: ALL_BUT_HEAD, pair: false },
};

const pieces: ArmourPieceDef[] = [];

for (const [slot, weights] of Object.entries(SLOT_WEIGHTS)) {
  const info = SLOT_INFO[slot];
  for (const [matId, w] of Object.entries(weights)) {
    const m = MATERIALS[matId];
    pieces.push({
      id: `${matId}-${slot}`,
      name: `${m.name} ${info.name}`,
      sv: `${info.sv}, ${m.sv}`,
      absKP: m.absKP,
      absSP: m.absSP,
      type: m.type,
      glance: m.glance,
      weight: info.pair ? w! * 2 : w!,
      covers: info.covers,
      heavierThanLeather: m.heavierThanLeather,
      iron: IRON_MATERIALS.has(matId),
    });
  }
}

const helmets: [string, string, string, number, number, 1 | 2 | 3, GlanceClass, number][] = [
  ['clothHood', 'Cloth hood', 'Tyghuva', 1, 2, 1, null, 0.3],
  ['leatherCap', 'Leather cap', 'Läderhuva', 2, 2, 1, null, 0.6],
  ['studdedCap', 'Studded leather cap', 'Nitläderhuva', 3, 2, 3, null, 1.2],
  ['hardLeatherCap', 'Hardened leather cap', 'Härdad läderhuva', 4, 3, 3, null, 0.6],
  ['paddedHood', 'Padded hood', 'Vadderad huva', 3, 5, 1, null, 0.6],
  ['mailCoif', 'Mail coif', 'Ringbrynjehuva', 5, 4, 2, 'chain', 4],
  ['doubleMailCoif', 'Double mail coif', 'Dubbel ringbrynjehuva', 7, 4, 2, 'chain', 6],
  ['openHelm', 'Open helm', 'Öppen hjälm', 6, 4, 3, 'metal', 4],
  ['visorHelm', 'Helm with visor', 'Hjälm med visir', 7, 4, 3, 'metal', 6],
  ['greatHelm', 'Great helm', 'Tunnhjälm', 8, 4, 3, 'metal', 6],
];
for (const [id, name, sv, kp, sp, type, glance, weight] of helmets) {
  pieces.push({ id, name, sv, absKP: kp, absSP: sp, type, glance, weight, covers: ['head'], heavierThanLeather: kp > 2, iron: IRON_HELMETS.has(id) });
}

/** Complete armours (Rustningstyp): all locations except the head (SIM-2); HB = action penalty. */
const complete: [string, string, string, number, number, number, number, 1 | 2 | 3, GlanceClass, boolean?][] = [
  ['cloth', 'Thick cloth armour', 'Tjockt tyg', 1, 2, 7.5, 0, 1, null],
  ['leather', 'Leather armour', 'Läderrustning', 2, 2, 11, 0, 1, null],
  ['studded', 'Studded leather armour', 'Nitläder', 3, 2, 16, 0, 3, null],
  ['hardLeather', 'Hardened leather armour', 'Härdad läderrustning', 4, 3, 13, 0, 3, null],
  ['padded', 'Padded armour', 'Vadderad rustning', 3, 5, 12, 0, 1, null],
  ['boneLamellar', 'Bone lamellar armour', 'Benlamellrustning', 4, 3, 18, 0, 3, 'lamellar'],
  ['brigandine', 'Brigandine armour', 'Brigandinrustning', 5, 3, 17, 0, 3, null],
  ['ringArmour', 'Ring armour', 'Ringpansar', 5, 3, 20, 0, 3, 'chain'],
  ['scale', 'Scale armour', 'Fjällpansar', 5, 3, 40, 0, 3, 'lamellar'],
  ['chain', 'Chainmail armour', 'Ringbrynja', 5, 4, 35, -1, 2, 'chain'],
  ['reinforcedChain', 'Reinforced chainmail armour', 'Förstärkt ringbrynja', 6, 4, 51, -1, 2, 'chain'],
  ['doubleChain', 'Double chainmail armour', 'Dubbel ringbrynja', 7, 4, 54, -1, 2, 'chain', true],
  ['lamellar', 'Lamellar armour', 'Lamellrustning', 7, 3, 28, 0, 3, 'lamellar', true],
  ['laminated', 'Laminated armour', 'Laminerad rustning', 8, 4, 38, -1, 3, 'metal', true],
  ['plate', 'Full plate', 'Metallrustning', 8, 4, 31, -1, 3, 'metal', true],
  ['fluted', 'Fluted full plate', 'Räfflad metallrustning', 9, 4, 42, -1, 3, 'metal', true],
  ['parade', 'Parade armour', 'Paradrustning', 10, 5, 45, -1, 3, 'metal', true],
];
for (const [id, name, sv, kp, sp, weight, hb, type, glance, forbids] of complete) {
  pieces.push({
    id: `${id}-complete`,
    name,
    sv,
    absKP: kp,
    absSP: sp,
    type,
    glance,
    weight,
    hb,
    covers: ALL_BUT_HEAD,
    heavierThanLeather: kp > 2,
    forbidsMartialArts: forbids ?? false,
    iron: IRON_MATERIALS.has(id),
  });
}

/**
 * Eastern armour (KH 7354–7500) – eastern-warriors option. Can't be layered and never costs actions.
 * Kote really is abs 13/6 (confirmed against the printed book, 2026-10-26).
 */
const eastern: [string, string, string, number, number, GlanceClass, number, Location[]][] = [
  ['kabuto', 'Kabuto', 'Kabuto', 7, 4, 'metal', 4, ['head']],
  ['kabutoMempo', 'Kabuto with mempo and nodowa', 'Kabuto + Mempo + Nodowa', 8, 5, 'metal', 4.5, ['head']],
  ['jingasa', 'Jingasa', 'Jingasa', 4, 4, 'metal', 2, ['head']],
  ['kote', 'Kote sleeves', 'Kote', 13, 6, 'chain', 10, ['leftArm', 'rightArm']],
  ['laminatedSode', 'Laminated sode', 'Laminerad sode', 8, 4, 'metal', 6, ['leftArm', 'rightArm']],
  ['laminatedDoMaru', 'Laminated do-maru', 'Laminerad do-maru', 8, 4, 'metal', 14, ['chest', 'abdomen']],
  ['lamellarDoMaru', 'Lamellar do-maru', 'Lamellerad do-maru', 6, 3, 'lamellar', 10, ['chest', 'abdomen']],
  ['suneAteHaidate', 'Sune-ate and haidate', 'Sune-ate + Haidate', 8, 4, 'metal', 13, ['leftLeg', 'rightLeg']],
  ['kyahan', 'Kyahan leggings', 'Kyahan', 2, 2, null, 2, ['leftLeg', 'rightLeg']],
];
for (const [id, name, sv, kp, sp, glance, weight, covers] of eastern) {
  pieces.push({ id, name, sv, absKP: kp, absSP: sp, type: 3, glance, weight, covers, heavierThanLeather: kp > 2, eastern: true, iron: glance !== null });
}

export const ARMOUR: Record<string, ArmourPieceDef> = Object.fromEntries(pieces.map((p) => [p.id, p]));

export function armourDef(id: string): ArmourPieceDef {
  const d = ARMOUR[id];
  if (!d) throw new Error(`Unknown armour piece "${id}"`);
  return d;
}
