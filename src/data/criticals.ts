import type { Effect, TableEntry } from '../engine/types';

/**
 * Krigarens Handbok critical hit tables (combat-rules §9.1, KH 2217–2706), rolled after a perfect
 * attack. Text is condensed English; effects are the engine primitives (§9.3).
 */

const lose1: Effect = { t: 'loseActions', n: 1 };
const loseRound: Effect = { t: 'loseRestOfRound' };
const cl = (value: number): Effect => ({ t: 'clMod', value, scope: 'all', span: { from: 0, through: 'fight' } });
const clArm = (value: number): Effect => ({ t: 'clMod', value, scope: 'hitArm', span: { from: 0, through: 'fight' } });
const bleed = (kp: number, every: number): Effect => ({ t: 'bleed', kp, every });
const penalty: Effect = { t: 'actionPenalty', n: 1 };
const out = (kind: 'unconscious' | 'dying' | 'dead' | 'incapacitated', reason: string): Effect => ({ t: 'out', kind, reason });
const cannot = (through: number | string, from = 0): Effect => ({ t: 'cannotAct', from, through });
const limb: Effect = { t: 'limbUnusable', which: 'hit' };
const drop: Effect = { t: 'dropItem', which: 'hit' };
const prone = (through: number | 'fight'): Effect => ({ t: 'prone', through });
const move = (factor: number): Effect => ({ t: 'movementFactor', factor });
const onlyDefend: Effect[] = [{ t: 'noAttack', from: 0, through: 'fight' }, cl(-10)];

const e = (roll: number, text: string, ...effects: Effect[]): TableEntry => ({ roll, text, effects });

export const CRIT_HEAD: TableEntry[] = [
  e(1, 'Part of the ear is torn off; heavy bleeding. Loses the next action.', lose1),
  e(2, 'The cheek is torn open. Loses the next action.', lose1),
  e(3, 'A tuft of hair is ripped from the scalp. Loses the next action.', lose1),
  e(4, 'The nose is crushed. Loses the next action.', lose1),
  e(5, 'The eyebrow is split and blood blinds the eyes: −5 CL on everything.', cl(-5)),
  e(6, 'The left ear is torn off: bleeds 1 KP every 6 SR, reduced hearing.', bleed(1, 6)),
  e(7, '1T20 teeth knocked out. Nothing more this SR and −1 action every SR.', loseRound, penalty),
  e(8, 'Part of the lower lip is cut away: −1 action every SR.', penalty),
  e(9, 'The cheekbone is crushed. Nothing more this SR and −1 action every SR.', loseRound, penalty),
  e(10, 'The jaw is crushed and hangs useless: −10 CL on everything.', cl(-10)),
  e(11, 'A temple is crushed – unconscious for 1T20 rounds.', out('unconscious', 'temple crushed')),
  e(12, 'An eye is destroyed. Nothing more this SR and −5 CL on everything.', loseRound, cl(-5)),
  e(13, 'The nose is destroyed; blood blinds. Loses all actions this SR, −5 CL on everything.', loseRound, cl(-5)),
  e(14, 'Neck vertebrae displaced – temporarily paralysed.', out('incapacitated', 'paralysed (neck)')),
  e(15, 'The lower jaw is torn loose. Can do nothing; bleeds 1 KP per SR.', bleed(1, 1), out('incapacitated', 'jaw torn loose')),
  e(16, 'The carotid artery is cut: bleeds 1 KP every SR.', bleed(1, 1)),
  e(17, 'The larynx is crushed: slowly suffocating, 1 KP every 6 SR.', bleed(1, 6)),
  e(18, 'The skull is pushed in – unconscious for 1T4 hours.', out('unconscious', 'skull fractured')),
  e(19, 'The jawbone is driven into the skull – unconscious, bleeding.', bleed(1, 6), out('unconscious', 'jawbone driven into the skull')),
  e(20, 'Severe crush wound to the back of the head – unconscious, bleeding.', bleed(1, 6), out('unconscious', 'back of the head crushed')),
];

export const CRIT_CHEST: TableEntry[] = [
  e(1, 'Staggers backwards off balance. Loses an action.', lose1),
  e(2, 'A couple of ribs crack. Loses the next action, −2 CL on everything.', lose1, cl(-2)),
  e(3, 'Hurled to the ground, winded. Nothing more this SR.', loseRound, prone(0)),
  e(4, 'Hit in the solar plexus. Can do nothing for two rounds.', cannot(1)),
  e(5, 'A collarbone breaks. Loses all actions this SR, −5 CL with that arm.', loseRound, { t: 'clMod', value: -5, scope: 'hitArm', span: { from: 0, through: 'fight' } }),
  e(6, 'Skin and flesh on the side are ripped open. Nothing more this SR.', loseRound),
  e(7, '1T6 ribs crushed; dazed next round. −5 CL on everything.', cannot(1, 1), cl(-5)),
  e(8, 'A shoulder blade half torn loose. Nothing more this SR, −1 CL with that arm.', loseRound, clArm(-1)),
  e(9, 'A rib pierces the lung: 1 KP every 6 SR, −10 CL on everything.', bleed(1, 6), cl(-10)),
  e(10, 'The side of the chest is crushed. Can do nothing for 1T6 rounds, then −10 CL.', cannot('1T6'), cl(-10)),
  e(11, 'A blow to the heart: cardiac arrest, unconscious for 1T6 minutes.', out('unconscious', 'cardiac arrest')),
  e(12, 'Ribs ripped open. Bleeds 1 KP every 6 SR, can do nothing until treated.', bleed(1, 6), out('incapacitated', 'ribs ripped open')),
  e(13, 'Flesh torn from the chest: 1 KP every 6 SR, −1 CL on everything.', bleed(1, 6), cl(-1)),
  e(14, 'A shoulder blade torn off: arm useless, bleeding, can do nothing until treated.', { t: 'limbUnusable', which: 'randomArm' }, bleed(1, 6), out('incapacitated', 'shoulder blade torn off')),
  e(15, 'Hit in the spine: falls in cramps for 2T6+2T6 rounds, then −10 CL.', prone('fight'), cannot('4T6'), cl(-10)),
  e(16, 'The aorta is punctured: bleeds 1 KP every SR.', bleed(1, 1)),
  e(17, 'The spine is displaced – falls in agony, helpless for hours.', out('incapacitated', 'spine displaced')),
  e(18, 'The spine is crushed – paralysed from the waist down.', out('incapacitated', 'spine crushed')),
  e(19, 'The chest is crushed, lungs filling with blood: 1 KP every SR.', bleed(1, 1)),
  e(20, 'Struck through the heart – dies within 1T10 rounds.', out('dying', 'struck through the heart')),
];

export const CRIT_ABDOMEN: TableEntry[] = [
  e(1, 'Doubles over. Nothing more this SR.', loseRound),
  e(2, 'Kidneys hit. Loses the next action, −5 CL on everything.', lose1, cl(-5)),
  e(3, 'Hit in the small of the back and thrown down; a round to get up.', loseRound, prone(1)),
  e(4, 'A blow to the groin: writhes for a round, half movement for the rest of the fight.', cannot(0), move(0.5)),
  e(5, 'Lower back hit: paralysed for a round, −1 action every SR.', cannot(0), penalty),
  e(6, 'The hip is hurt: half movement, −1 action every SR.', move(0.5), penalty),
  e(7, 'The belly is slit: −1 action every SR, −5 CL on everything.', penalty, cl(-5)),
  e(8, 'Hip dislocated – collapses, can do nothing until it is set.', out('incapacitated', 'hip dislocated')),
  e(9, 'A kidney is hit: collapses for 2T6 rounds, then −5 CL.', prone('fight'), cannot('2T6'), cl(-5)),
  e(10, 'The abdominal wall is slit: 1 KP every 6 SR, −5 CL on everything.', bleed(1, 6), cl(-5)),
  e(11, 'A hip bone is crushed: on the ground, can only parry or crawl at −10.', prone('fight'), move(0), ...onlyDefend),
  e(12, 'The pelvis is crushed – cannot move or act.', out('incapacitated', 'pelvis crushed')),
  e(13, 'The spleen is destroyed – dying within minutes; can only parry at −10.', prone('fight'), move(0), ...onlyDefend),
  e(14, 'The belly is torn open: bleeds 1 KP every 6 SR.', bleed(1, 6)),
  e(15, 'Genitals destroyed: bleeds 1 KP every SR, can do nothing.', bleed(1, 1), out('incapacitated', 'groin wound')),
  e(16, 'The aorta is punctured: bleeds 1 KP every SR.', bleed(1, 1)),
  e(17, 'The spine is displaced – falls in agony, helpless for hours.', out('incapacitated', 'spine displaced')),
  e(18, 'The spine is crushed – paralysed from the waist down.', out('incapacitated', 'spine crushed')),
  e(19, 'Internal organs torn: internal bleeding 1 KP every SR.', bleed(1, 1)),
  e(20, 'The stomach bursts: internal bleeding 1 KP every SR.', bleed(1, 1)),
];

const crushedArm3 = e(3, 'The upper-arm muscles are ripped open. Loses all actions this SR and drops what the hand held.', loseRound, drop);

export const CRIT_ARMS: TableEntry[] = [
  e(1, 'Hit on the hand: drops what it held and loses the next action.', drop, lose1),
  e(2, 'Hit on the elbow: drops what it held, loses all actions this SR.', drop, loseRound),
  crushedArm3,
  { ...crushedArm3, roll: 4 }, // OCR-3: entry 4 is missing in the source – entry 3 reused
  e(5, 'The shoulder is hurt: the arm is useless for 1T6 rounds; drops item, loses this SR.', { t: 'limbUnusable', which: 'hit', throughDice: '1T6' }, drop, loseRound),
  e(6, 'A finger is cut off: drops item, −5 CL with that hand.', drop, clArm(-5)),
  e(7, 'The wrist is dislocated: drops item, hand useless, −5 CL on everything.', drop, limb, cl(-5)),
  e(8, 'The forearm is crushed: drops item, arm useless, −5 CL on everything.', drop, limb, cl(-5)),
  e(9, 'The shoulder is dislocated – collapses in pain until someone sets it.', drop, out('incapacitated', 'shoulder dislocated')),
  e(10, 'A nerve is struck: collapses in pain for 1T6 rounds.', prone('fight'), cannot('1T6')),
  e(11, 'The hand bones are crushed: drops item, hand useless, −5 CL; nothing more this SR.', drop, limb, cl(-5), loseRound),
  e(12, 'The elbow is crushed: drops item, arm useless, loses this SR and −1 action every SR.', drop, limb, loseRound, penalty),
  e(13, 'The upper-arm bone is crushed: drops item, arm useless, −5 CL, −1 action every SR.', drop, limb, cl(-5), penalty),
  e(14, 'The elbow is twisted out of joint – lies screaming until it is set.', drop, out('incapacitated', 'elbow dislocated')),
  e(15, 'All fingers cut off: hand useless, bleeds 1 KP every 6 SR, can only defend.', drop, limb, bleed(1, 6), { t: 'noAttack', from: 0, through: 'fight' }),
  e(16, 'The hand is cut off: bleeds 1 KP every SR.', drop, limb, bleed(1, 1)),
  e(17, 'The shoulder is crushed and the artery torn: bleeds 1 KP every SR, arm useless.', drop, limb, bleed(1, 1)),
  e(18, 'The nerves are damaged: the hand is useless.', drop, limb),
  e(19, 'The arm is cut off at the elbow: bleeds 1 KP every SR.', drop, limb, bleed(1, 1)),
  e(20, 'The arm is cut off at the shoulder: bleeds 1 KP every SR.', drop, limb, bleed(1, 1)),
];

export const CRIT_LEGS: TableEntry[] = [
  e(1, 'Hit on the hip and stumbles. Loses the next action.', lose1),
  e(2, 'A heavy blow to the hip knocks him down. Loses all actions this SR.', loseRound, prone(0)),
  e(3, 'The ankle is dislocated: half movement, loses the next action.', move(0.5), lose1),
  e(4, 'The knee is dislocated: loses this SR, −10 CL on everything.', loseRound, cl(-10)),
  e(5, 'The Achilles tendon is cut: half movement, loses this SR.', move(0.5), loseRound),
  e(6, 'Loses 1T5 toes and can’t put weight on the leg: loses this SR, −5 CL.', loseRound, cl(-5), move(0.5)),
  e(7, 'The shin is hurt: loses this SR, quarter movement, −5 CL.', loseRound, move(0.25), cl(-5)),
  e(8, 'The hip is dislocated – collapses, can do nothing until it is set.', out('incapacitated', 'hip dislocated')),
  e(9, 'The knee tendons are cut: leg useless, quarter movement, −5 CL, loses this SR and −1 action every SR.', limb, move(0.25), cl(-5), loseRound, penalty),
  e(10, 'The thigh muscle is hurt: quarter movement, −5 CL, −1 action every SR.', move(0.25), cl(-5), penalty),
  e(11, 'The kneecap is crushed: leg useless, quarter movement, −5 CL, −1 action every SR.', limb, move(0.25), cl(-5), penalty),
  e(12, 'The hip muscles are badly hurt: 1 KP every 6 SR, loses this SR, −1 action every SR.', bleed(1, 6), loseRound, penalty),
  e(13, 'The foot is crushed: cannot move, −10 CL, loses this SR, −1 action every SR.', move(0), cl(-10), loseRound, penalty),
  e(14, 'The calf is torn open: 1 KP every 6 SR, −10 CL, loses this SR, −1 action every SR.', bleed(1, 6), move(0), cl(-10), loseRound, penalty),
  e(15, 'The hip bone is crushed: falls, can only parry at −10.', prone('fight'), move(0), ...onlyDefend),
  e(16, 'The femoral artery is punctured: bleeds 1 KP every SR.', bleed(1, 1)),
  e(17, 'Nerves in the hip are damaged: half movement for good.', move(0.5)),
  e(18, 'The foot is cut off: bleeds 1 KP every SR.', limb, bleed(1, 1)),
  e(19, 'The leg is cut off at the knee: bleeds 1 KP every SR.', limb, bleed(1, 1)),
  e(20, 'The leg is torn off at the hip: bleeds 2 KP every SR.', limb, bleed(2, 1)),
];

/** Basic rules: arm/leg taking more than double its KP (II 1539–1547), rolled on 1T10. */
export const CRIT_LIMB_DOUBLE: TableEntry[] = [
  ...[1, 2, 3].map((r) => e(r, 'The bone is broken (−3 CL with the limb even after healing).', limb)),
  ...[4, 5].map((r) => e(r, 'An ugly wound to the elbow/knee – the joint will never bend again.', limb)),
  ...[6, 7].map((r) => e(r, 'The nerves are severed – the limb is paralysed for life.', limb)),
  ...[8, 9].map((r) => e(r, 'Muscles and tendons are cut (−5 CL with the limb even after healing).', limb)),
  e(10, 'The bone is crushed – the limb must be amputated.', limb),
];
