# Implementation Plan – Drakar och Demoner Combat Simulator (prototype)

Based on the extracted rules in [combat-rules.md](combat-rules.md). Rule references below (§n, GAP-n, SIM-n) point there.

## 1. Goals and non-goals

**Goals (prototype)**
- Single-page app that simulates turn-based combat between 2+ characters using the KH detailed rules (KP + SP, 3 action opportunities, blotta, hit locations, armour per location). The basic rules apply wherever KH is silent.
- **At least one combatant is controlled by a human** from the first playable version. The others are AI-controlled (or also human, hot-seat).
- Combat starts with the sides **20 m apart** on a simple top-down grid (1 square = 1.5 m).
- Every step is visible: initiative, blotta rolls, attack/parry rolls with CL breakdown, damage dice, armour absorption, resulting KP/SP, criticals, conditions.
- Combatants are chosen from **pregenerated presets** for different professions/classes.
- **UI in English.** Swedish rule terms (KP, SP, CL, SR, blotta) appear only as tooltips/glossary next to their English names.

**Non-goals (prototype)**
- **No full character builder.** Presets are static data files. A light **custom character editor** (added 2026-11-01) starts as a copy of the selected fighter (its armour and any hero/magic features come along) and lets the player pick race (racial attribute modifiers, STO range, half-orc +4 Slagsmål; I 551–700), profession and attributes, add any combat skills at any FV and choose weapons. Skills are labelled primary / profession / secondary from the basic rules' skill table and the profession lists (`src/data/professions.ts`, `src/data/skills.ts`); breaking a rule is noted, never blocked. Custom characters are saved in the browser's localStorage. (Importing characters from the separate character project is a later, optional step.)
- Fancy graphics, animation, sound.
- Mounted combat, stealth/backstab, healing, and the rest of the out-of-scope list in combat-rules §19. (Magic was added later – combat-rules §22.)

## 2. Tech stack

| Concern | Choice | Why |
| :--- | :--- | :--- |
| Language | **TypeScript** (strict) | The rules have many small typed structures; types catch rules bugs |
| Build/dev | **Vite** | Zero-config SPA, fast reload, static build |
| UI | **React** | Panels, log, setup and the action menu are easiest declaratively |
| Battlefield | **SVG** rendered by React | Top-down grid with tokens; clickable squares for movement |
| State | Engine state in a plain object + a small React store (`useReducer` / Zustand) | The engine stays framework-free |
| Tests | **Vitest** | Same toolchain as Vite |
| RNG | Seeded PRNG (mulberry32) | Reproducible fights; "replay seed" in the UI; deterministic tests |

No backend. The static build can be opened from disk or any static host.

## 3. Architecture

```
src/
  engine/                 ← pure TS, no DOM, fully unit-tested
    dice.ts               parse "2T6+2", roll with a recorded result, max(), RNG injection
    skillRoll.ts          CL resolution, perfect/fumble (§3.2), resistance table (§3.4)
    character.ts          derive KP/SP per location, SB, FF, handedness, actions (§2, §4.3, §17.3)
    combatState.ts        combatant runtime state, battlefield, round/opportunity cursor
    round.ts              round state machine (§4.2): initiative → blotta → opportunities → end of round
    initiative.ts         1T10 + SMI + modifiers, tie re-rolls (§5)
    actions/
      attack.ts           melee/ranged attack incl. blotta/aim/wild, modifiers (§6, §7.1)
      resolve.ts          attack × parry results table incl. BV (§7.3), perfect attacks (§7.4)
      move.ts             movement budget per SR (§15.1)
      ranged.ts           shoot/throw, aim, reload, take cover (§15.2)
      defensive.ts        Avvaktande strid (§4.6)
    damage.ts             KP/SP roll, SB, armour per location, PV, glancing, SP→KP overflow (§8)
    conditions.ts         thresholds, wound penalties, bleeding, prone, unusable limbs, out of fight (§11, §18)
    criticals.ts          KH tables → effect primitives (§9.1, §9.3), basic double-damage rule (§9.2)
    techniques.ts         weapon techniques (§12) as modifiers/hooks
    abilities.ts          profession + special abilities, PSY spending (§13–14)
    legalActions.ts       lists the legal options for a combatant right now (used by the human UI and the AI)
    rulesConfig.ts        every open GAP/SIM decision as a named option with its proposed default
    events.ts             typed event log (the single source for the UI log)
    controllers/
      controller.ts       Controller interface
      humanController.ts  turns decisions into UI prompts and waits for input
      aiController.ts     default decision policy
  data/
    weapons.ts, shields.ts, armour.ts, hitTables.ts, bodyPointTable.ts, damageBonus.ts,
    movement.ts, armourWeight.ts, criticals.ts, presets/*.json
  ui/
    SetupScreen.tsx       pick a preset per side, choose Human/AI per combatant, seed, rules options
    Battlefield.tsx       SVG grid, tokens, facing, reach rings, movement range highlight, distance label
    ActionPanel.tsx       human decisions: action buttons, target, hit location (blotta highlighted), techniques
    ReactionPrompt.tsx    "You are attacked – parry with X (CL 12) / take it / roll with the blow"
    CombatantPanel.tsx    body diagram with KP/SP per location, actions per opportunity, conditions, PSY
    CombatLog.tsx         grouped by SR → opportunity → action; expandable dice details
    Controls.tsx          Continue (until next human decision) | Step | Auto (AI-only fights) | Reset | Rerun seed
  schema/
    character.schema.ts   preset format + validation (zod)
```

### 3.1 Engine design
- **Step-based state machine.** `engine.step(state) → { state, events, pendingDecision? }`. When a decision is needed, the engine stops and returns `pendingDecision` (who decides, what kind, the legal options). The UI then either asks the human or calls the AI.
- **Controllers:** each combatant has a controller, `human` or `ai`. Both answer the same decision types:
  - `chooseAction` (attack, move, shoot, aim, reload, draw/switch weapon, take cover, defensive stance, wait)
  - `chooseTarget`, `chooseHitLocation` (blotta / other location / wild swing), `chooseTechniques`
  - `chooseMoveDestination`
  - reactions: `chooseParry` (parry with which item, or not), `chooseRollWithBlow`, `chooseTakeCover`
  - `chooseSpendPsy` (Riddare / Vapenmästare / Tjuv / Tur)
- **Legal actions come from the engine** (`legalActions.ts`), never from the UI, so the human can't do anything the rules forbid. Each option carries its computed CL and modifier breakdown so the UI can show "Attack head: CL 15 − 4 = 11".
- **Every random number goes through `dice.roll(spec, purpose, actor)`**, which records an event `{ dice: "1T20", raw: [14], total: 14, purpose: "attack", cl: 13, outcome: "fail", modifiers: [{src:"aim: head", v:-4}, …] }`. The log renders these, which covers "display the dice rolls and skills used".
- **Rules config:** every open GAP/SIM item from combat-rules §20 is a named option with the proposed default. Changing an interpretation is a toggle, not a code change.
- **Snapshot per step** (structured clone), so "undo last step" can be added cheaply.

### 3.2 Data model (abridged)

```ts
type Location = 'head'|'chest'|'abdomen'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg';

interface CharacterSheet {            // preset format (static JSON, no builder)
  id: string; name: string; race: Race; profession: Profession; description: string;
  attributes: { STY; FYS; SMI; INT; PSY; KAR; STO: number };
  handedness: 'right'|'left'|'ambidextrous'|'twoHanded';   // dubbelhänt / ambidextriös
  skills: Record<string, number>;     // "Broadsword": 15, "Shield": 12, "Two weapons: Rapier+Main gauche": 11 …
  techniques?: Record<string, number>;// "Strike (Hugg)": 10, "Lunge (Lång stöt)": 8 …
  abilities?: string[];               // special abilities (§14)
  equipment: { mainHand?: WeaponId; offHand?: WeaponId|ShieldId; ranged?: WeaponId; ammo?: number;
               armour: ArmourPieceId[] };
}

interface Combatant {                 // runtime
  sheet: CharacterSheet; team: number; controller: 'human'|'ai';
  pos: {x,y}; facing: number;
  kp: Record<Location|'total', {max, cur}>; sp: Record<Location|'total', {max, cur}>;
  psy: number; initiative: number;
  actionsPerRound: number; actionPlan: number[];     // actions per opportunity, e.g. [1,1,1] or [2,1,1]
  actionsUsed: number[]; movedThisRound: number;     // movement budget (§15.1)
  blotta: Record<OpponentId, Location>;
  conditions: Condition[];            // prone, loseNextAction, unusable(limb), bleeding, unconscious, dying, dead …
  stance: 'normal'|'defensive';
  aimBonus: number; reloadRemaining: number;
}
```

Internal IDs and UI labels are English. Each data entry keeps its Swedish source name (e.g. `{ id: 'broadsword', name: 'Broadsword', sv: 'Bredsvärd' }`) so it can be traced back to the rules.

### 3.3 Human turn flow
1. When a human-controlled combatant gets an action, the **ActionPanel** shows the legal actions with their CL. Reachable squares are highlighted on the grid for Move. Targets in reach glow.
2. Attack → choose target → choose hit location on a small body diagram. The opponent's blotta is highlighted with "no penalty"; other locations show their penalty; "Wild swing" is listed as an option. Then pick any applicable techniques (checkboxes) and confirm.
3. When the human's character is attacked and a parry is legal, the **ReactionPrompt** pauses the engine: *"Barbarian attacks your chest (CL 12, roll 7 – hit). Parry with Shield (CL 13)? [Parry] [Don't parry]"*. The attack roll is shown first, matching the rules order (the attack is rolled, then the parry).
4. Everything the AI does is shown in the log at the same level of detail. **Continue** runs AI steps until the next human decision. In AI-only fights, **Auto** plays with a delay.

### 3.4 AI policy (default controller)
Simple and transparent. Each choice is logged with a short reason:
1. Out of reach → move toward the nearest enemy (ranged: shoot if in range and loaded, aim with spare actions, otherwise reload or close in).
2. In reach → attack. Aim at the **blotta** unless the expected damage after armour is clearly better elsewhere, or Riddare PSY / *Förutse blotta* make another target better.
3. Attacked with a spare action in the opportunity → parry if parry CL ≥ 8 (configurable).
4. *Rulla med slag* when incoming SP ≥ half of the location's remaining SP.
5. Free add-on techniques (Hugg, Stöt, Förutse blotta) → always try when allowed.
6. Morale (§14) for AI combatants: optional, off by default.

## 4. Presets (first set)
Concrete stat blocks get written in Phase 2 as static JSON. Proposed roster, chosen to exercise different rules:

| Preset (UI name) | Profession | Weapons | Armour | Exercises |
| :--- | :--- | :--- | :--- | :--- |
| Mercenary | Krigare (Warrior) | Broadsword + kite shield | Chainmail hauberk + open helm | Shield action, +5 initiative, armour weight |
| Northern Barbarian | Barbar | Two-handed axe | Leather | 2H, high SB, Barbarian KP/SP bonus, sweeping blow |
| Knight | Riddare | Longsword + kite shield | Plate + great helm | Heavy armour (−1 action), glancing hits, PSY max damage/aim |
| Beyural Duellist | Sprätthök (Swashbuckler) | Rapier + main gauche | Padded | Two weapons, light-weapon bonus, Lunge, Thrust, Predict opening |
| Disciple of Kane | Vapenmästare (Weapon master) | Longsword + small round shield | Brigandine | Techniques, PSY extra attack/parry, Kane's manoeuvre |
| Hauksheim Huscarl | Soldat (Soldier) | Battle axe + large round shield | Chainmail | Strike, Crushing blow, Force off balance |
| Arena Gladiator | Gladiator | Trident + buckler | Studded leather pieces | Mixed armour pieces, reach 1 |
| Cutthroat | Lönnmördare (Assassin) | 2× dagger + throwing knives | Leather | Thrown weapons at 20 m, max actions |
| Ranger | Utbygdsjägare (Ranger) | Longbow + short sword | Hardened leather | Ranged at 20 m, aiming, PV, taking cover, switching to melee |
| Samurai *(eastern option)* | Samuraj | Katana (two hands) / katana + wakizashi | O-yoroi: kabuto + mempo, kote, laminated do-maru, sune-ate + haidate | Eastern armour without action penalty, katana two-handed damage row, techniques |
| **Sir Aldric Dragonslayer** *(hero)* | Riddare, status 4 | Longsword FV 24 + kite shield | Chainmail hauberk + open helm | Extra weapon action, Double strike, Lightning attack, Power strike, Favoured by the gods, hero points |
| **Vargan the Wild Beast** *(hero)* | Barbar, status 2 | Great axe FV 23 | Leather | Wild beast, Steeling, Double strike |
| **Ilsabet Swiftblade** *(hero)* | Sprätthök, status 3 | Rapier FV 32 + main gauche | Padded | Triple strike, Quick striker, projectile parry, quick draw (Dra vapen 21) |
| **Morgrath the Black** *(dark hero)* | Krigare, status 3 (+1) | Bastard sword FV 26 (two hands) | Full plate + visor helm | Dark-hero psyching, Steeling, Power strike |
| Warrior Monk | Krigarmunk (Warrior monk) | Unarmed (martial art) + quarterstaff | Thick cloth | Unarmed table, initiative bonus, feint, **projectile parry** (vs the Ranger; only with the optional eastern-warriors rules) |
| Pyromancer | Magiker – fire | Quarterstaff | Thick cloth | ELD, ELDKLOT (burning), INRE ELD (PSY resistance), FLAMMANDE HAND, SKÖLD; 4-action casting interrupted by wounds |
| Frost Witch | Magiker – cold | Quarterstaff | Thick cloth + hood | KALLA HANDEN (quick), ISKLOT aimed at the head, ISMISSILER (area), FROST, FÖRFRYSA (ignores armour, resisted) |
| Storm Caller | Magiker – air | Quarterstaff | Leather | BLIXT (quick, ignores armour), VINDSTÖT, VIRVELSKÖLD vs the Ranger, KVÄVA |
| Stone Shaper | Magiker – earth | War staff | Hardened leather + cap | KNÄCKA breaks weapons, FÖRBANNA VAPEN, KROSSANDE KLIPPBLOCK, KLIPPSVÄRM |
| **Vaelis the Archmage** *(hero)* | Ärkemagiker, status 4 | Quarterstaff | Padded | S > 30: one-action SKÖLD parry and KALLA HANDEN; staff PSY store; hero points on casting rolls; misfires |

## 5. UI sketch (English)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Setup ▸ Side A: [Knight ▼] (Human ▼)   Side B: [Northern Barbarian ▼] (AI ▼)  Seed 4711 [Start] │
├─────────────────────────────────────────────┬────────────────────────────────┤
│  Top-down grid (1 square = 1.5 m)            │ ▼ Round 2 · Opportunity 1      │
│                                              │  Initiative: Knight 19         │
│     (K)  ── 20 m ──  (B)                      │    (1T10[7] + DEX 12)          │
│                                              │  Exposed: Barbarian → right arm│
│                                              │  Knight attacks Barbarian      │
│                                              │   chest (aim −3)               │
│                                              │   CL 15−3 = 12 · 1T20 → 9 ✔    │
├───────────────────────┬─────────────────────┤  Barbarian parries: CL 11 → 14 ✘│
│ Knight   HP 14/14     │ Barbarian HP 17/20  │  Damage: HP 1T10[6]+1T4[3] = 9 │
│ [body: HP/Pain]       │ [body: HP/Pain]     │   − armour 2 → 7 HP to chest   │
│ Actions ●●○           │ Actions ●○          │  Pain 1T6[4]+1T4[2] = 6 −2 → 4 │
├───────────────────────┴─────────────────────┴────────────────────────────────┤
│ YOUR ACTION (Knight, opportunity 2):                                           │
│ [Attack ▸]  [Move ▸]  [Defensive stance]  [Switch weapon]  [Wait]              │
│ Attack → Barbarian → [Right arm (exposed) CL 15] [Chest CL 12] [Head CL 11] [Wild CL 10] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Continue ▶]  [Step]  [Auto]  [Reset]  [Rerun seed]                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

English terminology used in the UI (Swedish in tooltips): Hit points (KP), Pain (SP), Chance (CL), Round (SR),
Opportunity (handlingstillfälle), Exposed area (blotta), Wild swing (slå vilt), Damage bonus (SB), Break value (BV),
Absorption, Movement (FF), Initiative.

## 6. Phases

| # | Phase | Deliverables | Done when |
| :-: | :--- | :--- | :--- |
| 0 | **Rules sign-off** ✅ | All GAP/OCR/SIM decisions in `combat-rules.md` §20 accepted (2026-10-24) | Done |
| 1 | Scaffold + data + dice | Vite/React/TS/Vitest project; all tables transcribed into `data/` (English names + Swedish source names); dice parser; skill roll with perfect/fumble; resistance table | Unit tests for dice, CL, perfect/fumble edge cases |
| 2 | Characters + presets | `character.ts` derivations (KP/SP per location, SB, FF, actions with armour weight/HB/type III, shield/2-weapon/light bonuses, handedness); preset schema + validation; 10 preset JSON files | Tests with hand-calculated expected values per preset |
| 3 | **Core round engine** | Initiative, blotta, opportunities and action placement, movement from 20 m, melee attack (blotta/aim/wild, modifiers), results table with BV, perfect attacks, damage with KP/SP/SB/armour layering, SP→KP overflow, thresholds and wound penalties, combat end; event log; `legalActions`; AI controller; headless runner | `npm run sim -- knight barbarian --n 1000` prints win %, average rounds and causes of defeat. Seeded golden-log test |
| 4 | **Playable UI (human vs AI)** | Setup (preset + Human/AI per combatant), SVG battlefield with clickable movement, ActionPanel, ReactionPrompt, combatant panels, combat log with dice breakdown, Continue/Step/Auto, seed replay | You can play the Knight against the AI Barbarian from 20 m to the end in the browser |
| 5 | Combat detail | KH critical tables (effect primitives) + double-damage criticals, glancing hits, roll with the blow, lose balance, defensive stance, sweeping blow, bleeding, fumble tables (§10.1), chain weapons/whips, two-handed grip bonus, carrying capacity | Tests per rule; criticals visible in the log |
| 6 | Ranged | Shoot/throw, range modifiers, moving targets, aim, reload, PV, take cover, shields vs projectiles, minimum distance, switching weapons | Ranger vs Knight from 20 m behaves sensibly, for both human and AI |
| 7 | Techniques & abilities | Weapon techniques §12, profession abilities and PSY spending §13, special abilities §14, berserker | Each technique has a test, a UI option and a log line |
| 8 | Multiple combatants | Teams (2v1, 2v2), several blottor per defender, targeting, side/rear attacks with facing, hot-seat with several humans, undo last step | 2v2 fight playable |
| 9 | Integration (optional) | Import characters from the separate character project into `CharacterSheet` | Round-trip a real character |

### Status (2026-10-24)

| Phase | Status | Notes |
| :-: | :--- | :--- |
| 1–4 | ✅ Done | Engine, data tables, 10 presets, AI, headless runner, playable human-vs-AI UI. 40 tests. Verified in a headless browser: Knight (human) vs Barbarian (AI) played from 20 m to the end, no console errors |
| 5 | ✅ Mostly done | Done: KH critical tables, double-damage criticals, glancing hits, roll with the blow, lose balance, defensive stance, bleeding, all four fumble tables, chain weapons/whips, two-handed grip, carrying capacity. **Missing:** sweeping blow (Svepande hugg); "parried miss wears the attacker's weapon" (BV rule for a failed attack) |
| 6 | ✅ Mostly done | Done: shoot/throw, range modifiers, moving targets, aim, reload, PV, shields vs projectiles, projectile parry, minimum distance, switching loadouts, longer weapon strikes first / spear vs charge. **Missing:** taking cover; stray projectiles; picking up dropped weapons |
| 7 | 🟡 Partial | Done: weapon techniques Strike, Thrust, Predict opening, Lunge, Killing blow, Pain strike, Knee strike, Bind blade; martial arts Feint, Initiative bonus, Unarmed weapon parry, Projectile parry; special abilities (precision, reflexes, quick striker, pain-tolerant, tough, find opening, quick perception, extremely fast). **Missing:** PSY abilities (Riddare, Vapenmästare, Kensai, Budoka, Tjuv, Tur), Disarm, Break weapon, Force off balance, Dodge, Double strike, Whirlwind, Shield bash, Berserker, Härskri/Kiai |
| Heroes | ✅ Done (2026-10-26) | Hjältarnas Handbok: FV > 20 perfect/fumble rules, weapon-only extra actions, Double/Triple strike, Lightning attack, Break weapon, Throw sword, Heroic pain strike, hero points, psyching out, suicide attack, 11 hero abilities, 4 hero presets |
| Magic | ✅ Done (2026-10-31) | Basic magic rules + Magikerns Handbok (combat-rules §22): KH action costs (4 / 2 / 1 with S > 30), CL −2 per E, PSY costs (perfect half, failure 1), suicide spells, concentration broken by wounds, iron, magic resistance, misfire table, staff PSY. 22 elemental/general combat spells incl. SKÖLD as a parry and VIRVELSKÖLD vs missiles. AI casting (expected effect per action, discounted for interruptions). 4 elementalist presets + the hero Vaelis the Archmage. PSY bars for everyone |
| 8–9 | ⬜ Not started | The engine already supports any number of combatants and teams; the setup UI only offers 1 vs 1. Facing (side/rear attacks) not modelled |

Phases 1–4 are the first usable prototype, with a human in control from Phase 4. Phases 5–7 add rules depth; 8–9 are extensions.

## 7. Testing strategy
- **Unit tests with scripted dice:** the RNG is injectable, so a test can force `[1, 7]` and assert "perfect". Every rule in combat-rules.md gets at least one test, named after its section (e.g. `§7.3 success vs success: damage > BV lowers BV`).
- **Legal-action tests:** for given states, assert exactly which actions/parries are offered. This guards the human UI against illegal moves.
- **Golden logs:** fixed seed + fixed presets + scripted human choices → stored event log. Catches unintended rule changes.
- **Monte Carlo sanity:** the headless runner (AI vs AI) reports average fight length and win rates. This helps settle GAP-9 (SB on SP) and the SIM-6 penalty mapping. Expect most duels to end in about 3–8 rounds.

## 8. Risks
| Risk | Mitigation |
| :--- | :--- |
| Remaining missing rules (weapon length in combat, SB on SP) and interpretations | Every assumption sits behind `rulesConfig` |
| Rule interactions (actions, parry timing, movement budget) are subtle | State machine + scripted-dice tests for the action placement matrix |
| Too many decision prompts slow the human down | Sensible defaults pre-selected (blotta as the target location, parry with the best item); a "quick mode" option auto-answers reactions with the AI policy |
| AI makes silly choices that hide rule behaviour | Simple, transparent AI with logged reasons |
| Scope creep into techniques/criticals | Phase ordering: playable core first |

## 9. Open questions
1. ~~Remaining rule gaps~~ – accepted 2026-10-24.
2. **Preset roster:** is the list in §4 good, or do you want different classes/races (e.g. a dwarf or an orc opponent)?
3. **Tooling OK?** Vite + React + TypeScript + Vitest.
