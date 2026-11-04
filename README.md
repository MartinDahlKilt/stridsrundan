# Stridsrundan – a combat simulator for Drakar och Demoner

A turn-based combat simulator for the old Swedish RPG *Drakar och Demoner*, using the detailed combat rules from
*Krigarens Handbok* (with the basic rules where KH is silent). Two fighters start 20 m apart on a top-down grid; at
least one side is played by a human, and every roll, modifier and table result is shown in the combat log.

- Rules extracted for review: [docs/combat-rules.md](docs/combat-rules.md)
- Implementation plan and status: [docs/implementation-plan.md](docs/implementation-plan.md)

## Running

Requires Node.js 20+ (developed with Node 24).

```bash
npm install
npm run dev        # open http://localhost:5173
npm test           # unit + whole-fight tests
npm run typecheck
npm run build      # static build in dist/ (open dist/index.html)
```

Headless AI-vs-AI fights:

```bash
npm run sim -- knight barbarian            # one fight with the full log
npm run sim -- knight barbarian --n 1000   # win rates and fight length
npm run sim -- --all --n 200               # every preset against every other
npm run sim -- ranger monk --n 500 --eastern  # with the optional eastern-warriors rules
```

In the setup screen, **✎ New character…** opens the custom character editor. It starts as a copy of the selected fighter; choose race, profession, any combat skills at any FV and up to three weapon sets. Each skill is marked *Primary*, *Profession* or *Secondary* following the basic rules. Custom characters are stored in the browser (localStorage), so the headless sim runner only knows the presets.

Preset ids: `mercenary`, `barbarian`, `knight`, `duellist`, `kane`, `huscarl`, `gladiator`, `cutthroat`, `ranger`, `monk`; heroes `aldric`, `vargan`, `ilsabet`, `morgrath`; wizards `pyromancer`, `frostWitch`, `stormCaller`, `stoneShaper` and the hero archmage `vaelis`; and `samurai` (needs `--eastern`; in the UI it appears when *Eastern warriors* is ticked under Rules options).

Magic follows the basic rules and *Magikerns Handbok* (rules: [combat-rules §22](docs/combat-rules.md#22-magic--basic-rules--magikerns-handbok-mh)): spells cost KH actions (4 for a normal spell, 2 for a quick one, fewer with S above 30), PSY per effect grade, and a wound breaks the concentration. PSY is shown for every combatant.

## Layout

```
src/engine/   rules engine (pure TypeScript, no DOM)
  combat.ts     round loop: initiative, opportunities, attacks, parries, ranged, movement
  requests.ts   legal actions offered to the human / AI, decision types
  cl.ts         CL calculations with full modifier breakdown
  damage.ts     damage, armour, glancing hits, criticals, KP/SP thresholds
  conditions.ts effects of criticals and fumbles (lost actions, penalties, bleeding, …)
  magic.ts      casting, PSY costs, spell effects, misfires (§22); psy.ts PSY pools and concentration
  aiMagic.ts    how the computer chooses spells, effect grades and targets
  character.ts  derived stats (KP/SP per location, SB, movement, actions per round)
  ai.ts         computer opponent
  session.ts    drives a fight; stops when a human must decide
  rules.ts      switchable rule interpretations (see combat-rules §20)
src/data/     weapons, armour, tables, critical and fumble tables, spells, presets
src/ui/       React UI (setup screen, battlefield, decision panel, log)
scripts/sim.ts  headless runner
tests/        Vitest tests
```
