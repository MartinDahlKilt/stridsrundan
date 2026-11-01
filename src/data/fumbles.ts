import type { Effect, TableEntry } from '../engine/types';

/**
 * Fumble tables (combat-rules §10.1, III 3119–3234). Condensed English text; effects are engine
 * primitives. Durations: "this SR" = from 0 through 0, "next SR" = from 1 through 1. Effects that
 * last days in the source last for the rest of the fight (SIM-10).
 */

const e = (roll: number, text: string, ...effects: Effect[]): TableEntry => ({ roll, text, effects });
const fight = { from: 0, through: 'fight' as const };
const next = (n = 1) => ({ uses: n });
const rounds = (from: number, through: number) => ({ from, through });

export type FumbleTable = 'shield' | 'melee' | 'ranged' | 'unarmed';

export const FUMBLE_SHIELD: TableEntry[] = [
  e(1, 'A violent parry splits the shield in two – destroyed.', { t: 'breakItem', which: 'shield' }),
  e(2, 'The shield cracks from edge to edge – destroyed.', { t: 'breakItem', which: 'shield' }),
  e(3, 'Cut on a nail sticking out of the shield: −5 CL on the next parry.', { t: 'clMod', value: -5, scope: 'parry', span: next() }),
  e(4, 'Thrown off by a gust of wind; next round only parries, at −10.', { t: 'onlyParry', from: 1, through: 1 }, { t: 'clMod', value: -10, scope: 'parry', span: rounds(1, 1) }),
  e(5, 'The shield ends up askew: −3 CL on all parries for two rounds.', { t: 'clMod', value: -3, scope: 'parry', span: rounds(0, 1) }),
  e(6, 'The shield is in the way: −5 CL on the next attack and the next parry.', { t: 'clMod', value: -5, scope: 'attack', span: next() }, { t: 'clMod', value: -5, scope: 'parry', span: next() }),
  e(7, 'The shield catches in the gear – this and next round spent freeing it.', { t: 'cannotAct', from: 0, through: 1 }),
  e(8, 'Loses a shoe and all balance: every attack and parry fails this round and the next 1T3.', { t: 'autoFail', span: { from: 0, throughDice: '1T3' } }),
  e(9, 'Trips – this and next round to get up.', { t: 'prone', through: 1 }, { t: 'cannotAct', from: 0, through: 1 }),
  e(10, 'Sudden dizziness: −2 CL on attacks and parries for 1T4+1 rounds.', { t: 'clMod', value: -2, scope: 'attackParry', span: { from: 0, throughDice: '1T4' } }),
  e(11, 'Loses part of the armour (random location).', { t: 'loseArmour' }),
  e(12, 'Sprains a foot: movement −2.', { t: 'ffMod', value: -2 }),
  e(13, 'Brooding over the awful parry: −5 CL on everything next round.', { t: 'clMod', value: -5, scope: 'all', span: rounds(1, 1) }),
  e(14, 'The shield straps snap – the shield falls to the ground.', { t: 'dropItem', which: 'shield' }),
  e(15, 'Falls over the shield; the shield arm is dislocated – arm and shield useless.', { t: 'limbUnusable', which: 'shieldArm' }, { t: 'dropItem', which: 'shield' }),
  e(16, 'Enormously clumsy: the opponent gets +5 CL on the next attack.', { t: 'opponentBonus', value: 5, span: next() }),
  e(17, 'The shield flies 1T3 squares away.', { t: 'dropItem', which: 'shield', squares: '1T3' }),
  e(18, 'Knocks the nearest friend over with the shield.', { t: 'hitFriend' }),
  e(19, 'The shield blocks the view – the next attack against him succeeds automatically.', { t: 'autoHitAgainst', uses: 1, noParry: false }),
  e(20, 'Real clumsiness – roll twice.', { t: 'rollTwice' }),
];

export const FUMBLE_MELEE: TableEntry[] = [
  e(1, 'Swings into the ground – the weapon snaps in two.', { t: 'breakItem', which: 'main' }),
  e(2, 'A hidden crack: the weapon breaks and a piece hits his head (1 KP).', { t: 'breakItem', which: 'main' }, { t: 'selfDamage', kp: 1, location: 'head' }),
  e(3, 'Weak at the knees; next round only parries, at −10.', { t: 'onlyParry', from: 1, through: 1 }, { t: 'clMod', value: -10, scope: 'parry', span: rounds(1, 1) }),
  e(4, 'Pulls a back muscle: −4 CL on all STY- and SMI-based skills.', { t: 'clMod', value: -4, scope: 'all', span: fight }),
  e(5, 'Wrong grip: −3 CL with the weapon for 1T4+1 rounds.', { t: 'clMod', value: -3, scope: 'mainHand', span: { from: 0, throughDice: '1T4' } }),
  e(6, 'A sudden sneeze: next round only parries, at −2.', { t: 'onlyParry', from: 1, through: 1 }, { t: 'clMod', value: -2, scope: 'parry', span: rounds(1, 1) }),
  e(7, 'Sweaty hands – the weapon flies 1T3 squares away.', { t: 'dropItem', which: 'main', squares: '1T3' }),
  e(8, 'Shocked by his own ferocity: every attack and parry fails this round and the next 1T3.', { t: 'autoFail', span: { from: 0, throughDice: '1T3' } }),
  e(9, 'Trips over his own feet – this and next round to get up.', { t: 'prone', through: 1 }, { t: 'cannotAct', from: 0, through: 1 }),
  e(10, 'Falls flat – three rounds to recover and get up.', { t: 'prone', through: 2 }, { t: 'cannotAct', from: 0, through: 2 }),
  e(11, 'Loses part of the armour (random location).', { t: 'loseArmour' }),
  e(12, 'Lands badly and sprains a foot: movement −2.', { t: 'ffMod', value: -2 }),
  e(13, 'A juggler’s flourish that impresses nobody: opponent +5 CL on the next attack.', { t: 'opponentBonus', value: 5, span: next() }),
  e(14, 'Drops the weapon at his feet.', { t: 'dropItem', which: 'main' }),
  e(15, 'Loses his grip and can only stare at the opponent next round (no attack).', { t: 'noAttack', from: 1, through: 1 }),
  e(16, 'Drops the weapon on his foot (1 KP).', { t: 'dropItem', which: 'main' }, { t: 'selfDamage', kp: 1, location: 'randomLeg' }),
  e(17, 'Swats at an insect and hits the nearest friend.', { t: 'hitFriend' }),
  e(18, 'Horribly clumsy: the next enemy attack hits automatically and can’t be parried.', { t: 'autoHitAgainst', uses: 1, noParry: true }),
  e(19, 'Swallows his tongue and collapses, choking.', { t: 'out', kind: 'incapacitated', reason: 'choking on his tongue' }),
  e(20, 'Real clumsiness – roll twice.', { t: 'rollTwice' }),
];

export const FUMBLE_RANGED: TableEntry[] = [
  e(1, 'Overstrains the weapon – it breaks.', { t: 'breakItem', which: 'main' }),
  e(2, 'The bowstring snaps (or the sling tears, or the thrown weapon breaks).', { t: 'breakItem', which: 'main' }),
  e(3, 'Distracted by a memory – can do nothing this round and the next.', { t: 'cannotAct', from: 0, through: 1 }),
  e(4, 'Misjudges distances: −4 CL on all ranged attacks.', { t: 'clMod', value: -4, scope: 'ranged', span: fight }),
  e(5, 'Spends the whole next round watching where the missile lands.', { t: 'cannotAct', from: 1, through: 1 }),
  e(6, 'Not his day – spends the whole next round regaining confidence.', { t: 'cannotAct', from: 1, through: 1 }),
  e(7, 'A flea under the armour: −4 CL for three rounds.', { t: 'clMod', value: -4, scope: 'all', span: rounds(0, 2) }),
  e(8, 'Fumbles with the ammunition this round and the next.', { t: 'noAttack', from: 0, through: 1 }),
  e(9, 'Someone up there dislikes him: the next two attacks miss automatically.', { t: 'missNext', uses: 2 }),
  e(10, 'Forgets what balance is: −5 on everything next round.', { t: 'clMod', value: -5, scope: 'all', span: rounds(1, 1) }),
  e(11, 'Drops the weapon at his feet.', { t: 'dropItem', which: 'main' }),
  e(12, 'Shoots without aiming, this round and the next: −15 CL.', { t: 'clMod', value: -15, scope: 'ranged', span: rounds(0, 1) }),
  e(13, 'Cuts his hand on the weapon: −2 CL.', { t: 'clMod', value: -2, scope: 'all', span: fight }),
  e(14, 'Sweat and blood in the eyes: the next attack misses automatically.', { t: 'missNext', uses: 1 }),
  e(15, 'Drops the weapon (a thrown weapon flies 1T6 squares).', { t: 'dropItem', which: 'main', squares: '1T6' }),
  e(16, 'Drops the missile and can’t shoot next round.', { t: 'noAttack', from: 1, through: 1 }),
  e(17, 'Injures himself on the weapon (1 KP to the arm).', { t: 'selfDamage', kp: 1, location: 'mainArm' }),
  e(18, 'The shot hits the nearest friend in the line of fire.', { t: 'hitFriend' }),
  e(19, 'Shoots himself in the foot: 1 KP, movement halved.', { t: 'selfDamage', kp: 1, location: 'randomLeg' }, { t: 'movementFactor', factor: 0.5 }),
  e(20, 'Real clumsiness – roll twice.', { t: 'rollTwice' }),
];

export const FUMBLE_UNARMED: TableEntry[] = [
  e(1, 'Trips over an invisible tortoise: the next attack or parry fails.', { t: 'autoFail', span: next() }),
  e(2, 'Torn clothes hamper movement: −3 on attacks and parries.', { t: 'clMod', value: -3, scope: 'attackParry', span: fight }),
  e(3, 'Pulls a shoulder (or thigh): −3 CL.', { t: 'clMod', value: -3, scope: 'all', span: fight }),
  e(4, 'Next round must parry, at −5.', { t: 'onlyParry', from: 1, through: 1 }, { t: 'clMod', value: -5, scope: 'parry', span: rounds(1, 1) }),
  e(5, 'A gnawing hunger: no attacks or parries next round.', { t: 'cannotAct', from: 1, through: 1 }),
  e(6, 'Decides attack is the best defence: no parries for two rounds.', { t: 'noParry', from: 1, through: 2 }),
  e(7, 'Pokes himself in the eye: next round may only parry.', { t: 'onlyParry', from: 1, through: 1 }),
  e(8, 'A moment of clarity: −5 on the next attack or parry.', { t: 'clMod', value: -5, scope: 'attackParry', span: next() }),
  e(9, 'Does everything right – backwards: −10 on the next attack or parry.', { t: 'clMod', value: -10, scope: 'attackParry', span: next() }),
  e(10, 'Loses part of the armour (random location).', { t: 'loseArmour' }),
  e(11, 'Falls flat and loses 1T2 teeth – this and next round to get up.', { t: 'prone', through: 1 }, { t: 'cannotAct', from: 0, through: 1 }),
  e(12, 'Distracted by a blister: everyone attacking him next round gets +3 CL.', { t: 'opponentBonus', value: 3, span: rounds(1, 1) }),
  e(13, 'So laughable the opponent gets +3 CL on the next two attacks.', { t: 'opponentBonus', value: 3, span: next(2) }),
  e(14, 'Sprains a foot: movement −2.', { t: 'ffMod', value: -2 }),
  e(15, 'A stiff neck: −6 CL on all SMI-based skills for 1T20 rounds.', { t: 'clMod', value: -6, scope: 'all', span: { from: 0, throughDice: '1T20' } }),
  e(16, 'Back spasm: −10 on all SMI-based skills.', { t: 'clMod', value: -10, scope: 'all', span: fight }),
  e(17, 'Self-confidence shattered: −2 CL on all attacks and parries.', { t: 'clMod', value: -2, scope: 'attackParry', span: fight }),
  e(18, 'A perfect punch – on the nearest friend.', { t: 'hitFriend' }),
  e(19, 'Awed by the opponent: the next enemy attack succeeds automatically.', { t: 'autoHitAgainst', uses: 1, noParry: false }),
  e(20, 'Real clumsiness – roll twice.', { t: 'rollTwice' }),
];

export const FUMBLE_TABLES: Record<FumbleTable, TableEntry[]> = {
  shield: FUMBLE_SHIELD,
  melee: FUMBLE_MELEE,
  ranged: FUMBLE_RANGED,
  unarmed: FUMBLE_UNARMED,
};

export const FUMBLE_TABLE_NAMES: Record<FumbleTable, string> = {
  shield: 'shield',
  melee: 'melee weapon',
  ranged: 'ranged weapon',
  unarmed: 'unarmed',
};
