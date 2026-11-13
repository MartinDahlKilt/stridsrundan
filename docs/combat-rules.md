# Combat Rules – Extracted for the Simulator

Extracted from the files in `rules/` to be reviewed before implementation.

**Precedence:** *Krigarens Handbok* (KH) detailed combat rules **override** the basic rules
(*I – Rollpersonen*, *II – Spelledarboken* and *III – Spelarboken*). The basic rules apply wherever KH is silent.
*Tjuvar och Lönnmördare* (TL) only adds optional weapons. *Hjältarnas Handbok* (HH) adds rules for heroes and very high skill values (§21).
*Magikerns Handbok* (MH) adds the KH conversion for magic and new spells; the basic magic rules are in *III* (§22).

Source references: `[KH 1470]` = `rules/KrigarensHandbok.md` line 1470, `[I 1258]` = `rules/I-Rollpersonen.md`,
`[II 1166]` = `rules/II-Spelledarboken.md`, `[III 2638]` = `rules/III-Spelarboken.md`, `[TL 2037]` = `rules/TjuvarOchLönmördare.md`,
`[HH 796]` = `rules/HjältarnasHandbok.md`, `[MH 1885]` = `rules/MagikernsHandbok.md`.

**Status markers**

| Marker | Meaning |
| :--- | :--- |
| (no marker) | Rule stated explicitly in the sources |
| ⚠️ **OCR** | Text is garbled or numbers are missing; a correction is proposed |
| ❓ **GAP** | Rule is referenced but **not present** in any of the files; a default is proposed and must be confirmed |
| 🔧 **SIM** | Simulator interpretation of an ambiguous rule, or of how basic and KH rules combine |
| **KH⇢II** | KH overrides the basic rule; the basic rule is noted for reference |

> ### Source status
> - *II – Spelledarboken*, combat chapter (`[II 1115–1797]`): initiative, the attack/parry results table, perfect attacks,
>   KP thresholds and wound penalties, criticals from double damage, movement, attack modifiers, unarmed fighting.
> - *III – Spelarboken*, chapter "Vapen och Rustningar" (`[III 2571–3235]`): **range modifiers, wind, moving targets, stray
>   projectiles, BV rules, weapon handling (STY requirement), shields vs projectiles, chain weapons and whips, the four
>   fumble tables**, plus carrying capacity (`[III 3372–3402]`).
> - *KH – Österländska krigare* (`[KH 6645–7668]`): eastern professions and the eastern Stridskonst techniques, including **Projektilparering** (§12.1).
> - *III – Spelarboken*, chapter "Magi" (`[III 9–570, 880–2290]`) and *Magikerns Handbok* (`[MH 1087–1915, 5597–5920]`): casting, PSY, magic resistance, iron, the misfire table, the KH action costs of spells and the elemental spells (§22).
> - *Hjältarnas Handbok* (`[HH 143–917, 2964–2981]`): rules for FV above 20 (perfect rolls, fumbles, extra actions, special manoeuvres), hero abilities, hero points, psyching out opponents and the suicide attack (§21). The rest of the book (destiny, oaths, reputation, curses, followers) has no combat rules.
> - **Still missing:** the section "vapenlängdens inverkan i strid" (how weapon length affects combat), which `[III 2593]`
>   refers to. It isn't in any of the files. See [§20](#20-gaps-ocr-issues-and-decisions) for this and the remaining interpretation questions.

---

## 1. Glossary

| Swedish | Abbr. | English / meaning |
| :--- | :---: | :--- |
| Styrka, Fysik, Smidighet, Intelligens, Psyke, Karisma, Storlek | STY, FYS, SMI, INT, PSY, KAR, STO | Strength, Constitution, Dexterity, Intelligence, Psyche/Will, Charisma, Size |
| Kroppspoäng | KP | Hit points (real wounds) |
| Smärtpoäng | SP | Pain points (bruising, pain, exhaustion) – KH only |
| Färdighetsvärde | FV | Skill value |
| Chans att lyckas | CL | Chance to succeed (modified FV) – roll 1T20 ≤ CL |
| Baschans | BC | Base chance (free FV from attribute) |
| Skadebonus | SB | Damage bonus |
| Stridsrunda | SR | Combat round (~5 s) |
| Turordning / Initiativ | – | Turn order / initiative |
| Handling / Handlingstillfälle | – | Action / Action opportunity (3 per SR) |
| Blotta | – | Exposed hit area (opening) |
| Träffområde | – | Hit location |
| Slå vilt | – | Wild swing (random location) |
| Brytvärde | BV | Break value of weapon/shield |
| Penetreringsvärde | PV | Penetration value (ranged), KP/SP |
| Absorbering | abs | Armour absorption (KP and SP separately in KH) |
| Handlingsbortfall | HB | Action penalty from armour |
| Förflyttning | FF | Movement in squares (rutor) per SR; 1 ruta = 1.5 m |
| Svårighetsgrad | SG | Difficulty (for the resistance table) |
| Perfekt slag / Fummel | – | Critical success / Fumble |
| Differensvärde | – | CL minus die roll |
| Spelledare / Spelledarperson | SL / SLP | Game master / NPC |
| xTy | – | x dice with y sides, e.g. 2T6 |

---

## 2. Character values relevant to combat

### 2.1 Attributes `[I 260–389]`
Seven attributes, normally 3–18: STY, FYS, SMI, INT, PSY, KAR, STO.

### 2.2 Kroppspoäng (KP) `[I 1258–1285, II 2684–2696]`
- **Total KP = ⌈(FYS + STO) / 2⌉**.
- Damage is subtracted from **both** the hit location and the total `[II 1450–1454]`.
- Location KP from the body point table (by total KP):

| Location | 5–7 | 8–11 | 12–15 | 16–20 | 21–25 | 26–30 | 31–35 | 36–40 | each +5 |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Chest (Bröstkorg) | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | +1 |
| Right leg (Höger ben) | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | +1 |
| Left leg (Vänster ben) | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | +1 |
| Abdomen (Mage) | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | +1 |
| Right arm (Höger arm) | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | +1 |
| Left arm (Vänster arm) | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | +1 |
| Head (Huvud) | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | +1 |

### 2.3 Smärtpoäng (SP) – KH `[KH 396–413, 1677–1684]`
- **Total SP = FYS × 2**.
- SP are distributed over the body parts **using the same table as KP**, but looked up by total SP.

### 2.4 Skadebonus (SB) `[I 1287–1310, II 2668–2681]`
Added to **melee** damage only `[II 1428–1429]`. Look up STY + STO:

| STY+STO | 1–26 | 27–29 | 30–32 | 33–40 | 41–50 | 51–60 | 61–80 | 81–100 | 101–140 | 141–180 |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| SB | – | +1 | +1T2 | +1T4 | +1T6 | +1T10 | +2T6 | +3T6 | +4T6 | +5T6 |

**GAP-9** (decided): in KH, damage is split into KP and SP. Neither KH nor the basic rules say where SB goes. **SB is added to both KP and SP.**

### 2.5 Förflyttning (FF) `[I 1312–1342, II 2641–2665]`
Squares (1.5 m) per SR. Look up STO + FYS + SMI:

| STO+FYS+SMI | 0–11 | 12–20 | 21–29 | 30–38 | 39–47 | 48–56 | 57–65 | 66–74 | 75–83 | 84–92 | +8 |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| FF | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | +1 |

Race modifiers: Anka −2, Alv +1, Dvärg −2, Halvlängdsman −2, others ±0.

### 2.6 Svärdshand (handedness) `[I 1420–1452]`
Right / Left / Dubbelhänt (either hand, not both at once) / Ambidextriös (both hands at once).
Matters for hit locations, the left-hander penalty (§6.4) and the shield-hand penalty (§7.1).

### 2.7 Weapon skills `[I 4458–4502]`
- Each weapon is its own skill. The same FV is used for **attack and parry**.
- **Group rule:** within a weapon group you always have at least ½ (round down) of your highest FV in that group.
- Weapon groups and base attribute:

| Group | Attr. | Group | Attr. |
| :--- | :-: | :--- | :-: |
| Daggers (Dolkar) | SMI | Polearms (Stångvapen) | STY |
| 1H swords (Enhandssvärd) | STY | Bows (Bågar) | SMI |
| 1H blunt (Enhands krossvapen) | STY | Crossbows (Armborst) | SMI |
| 1H axes (Enhandsyxor) | STY | Slings (Slunga) | SMI |
| 2H weapons (Tvåhandsvapen) | STY | Thrown (Kastvapen) | SMI |
| Spears (Stickvapen) | STY | Whip (Piska) | SMI |
| Flails (Kättingvapen) | SMI | Shields (Sköldar) | SMI |

- **Två vapen (two weapons)** `[I 4398–4435]`: a separate skill per weapon combination. FV can never exceed the lower of the two weapon FVs; BC = ½ of the lower FV. Can't be combined with a two-handed weapon. Not needed for weapon + shield.

### 2.8 Base chance (BC) `[I 1586–1601]`
Attribute 1–3 → 0, 4–8 → 1, 9–12 → 2, 13–16 → 3, 17–20 → 4, >20 → 5. (Presets state FV directly.)

---

## 3. Skill rolls `[I 1989–2160, II 2905–2944]`

### 3.1 Basic roll
Roll **1T20 ≤ CL** to succeed. CL = FV ± modifiers.
If FV ≥ 1, a natural **1 is always a success** and a natural **20 is always a failure**.
Temporary attribute changes change CL by the same amount; CL can't drop below 1 that way `[I 2072–2076]`.

### 3.2 Perfect rolls and fumbles

| CL | Perfect | Fumble |
| :--- | :--- | :--- |
| CL < 1 | Not possible | Natural 20 = fumble. ⚠️ OCR-6: "Om FV är [?] och CL är [?] eller lägre, så måste man slå två '1' i rad" → proposed: *FV ≥ 1 and CL ≤ 0: success needs two 1s in a row* |
| 1–19 | Roll 1 → roll again; if the 2nd roll ≤ **FV**, it is perfect | Roll 20 → roll again; if the 2nd roll > **FV**, it is a fumble |
| ≥ 20 | 1 is always perfect; 2 → roll again, ≤ FV is perfect | Only two 20s in a row |

Note: the confirmation roll uses **FV**, not CL.
With **FV above 20**, the hero rules in §21.1 replace this table (Hjältarnas Handbok).

### 3.3 Differensvärde
Differensvärde = CL − die roll (used by taking cover, Undanmanöver, Bryta grepp).

### 3.4 Attribute rolls and the resistance table (Motståndstabellen)
Plain attribute roll: 1T20 ≤ attribute.
With a difficulty SG (1–25) or an opposing value: **target = value − SG + 10**. A target ≥ 20 is an automatic success; ≤ 0 is an automatic failure.
Difficulties: Very easy 1 · Easy 5 · **Normal 10** · **Hard 15** · Very hard 20 · Extremely hard 25.

---

## 4. Combat round structure

### 4.1 Basic rules (for reference) `[II 1137–1250]`
SR ≈ 5 s. At the start of each SR everyone rolls initiative (§5). In the basic rules each combatant chooses **one** activity
per SR: cast a spell, full movement, fire a projectile weapon, throw, use another skill, **take part in melee**, or
another action. Normally that allows one attack or one parry per weapon per SR.
**KH⇢II:** the detailed KH rules replace the "one activity / one attack or parry" structure with **actions** and
**action opportunities**. The basic rules still decide movement, ranged fire and other activities (§15).

### 4.2 KH round sequence `[KH 1463–1498, 1632–1673]`
1. Roll **initiative** (§5) and decide the turn order.
2. Everyone in melee rolls for **blotta** (exposed area), §6.2.
3. **Opportunity 1:** each combatant does their 1st action in initiative order.
   An attack aims at the opponent's blotta, at another location, or is a wild swing.
4. Roll damage (KP and SP). 5. Subtract armour absorption (KP and SP), apply damage.
6–8. **Opportunity 2**, same procedure. 9–11. **Opportunity 3** (only if someone has a 3rd action; otherwise the round ends after opportunity 2).

- The same initiative roll applies for the whole round (or the whole fight, at the SL's choice).

### 4.3 Number of actions `[KH 1545–1558, 415–426]`

| Condition | Actions |
| :--- | :-: |
| SMI 3–18 | 2 (base) |
| SMI 19+ | 3 (base) |
| Heavy armour (HB column, or worn armour weight ≥ 30 kg) | −1 |
| Armour weight ≥ 60 kg | −2 (instead of −1) `[KH 4019–4022]` |
| Type III + another armour layer on arms and/or chest | −1 `[KH 4035–4036]` |
| Shield + weapon | +1 |
| One weapon in each hand | +1 |
| STY ≥ weapon's STY requirement + 10 ("light weapon") | +1 (counts for one weapon only) |
| Special ability *Extremt snabb* | +1 `[KH 530]` |

- **Maximum 6 actions per SR. Maximum 2 actions in the same opportunity.**
- Dagger in the shield hand: +1 (two weapons) +1 (light weapon, if STY ≥ 11). Two daggers still give only +2 in total `[KH 1505–1510]`.
- Actions 1–3 occupy opportunities 1–3 in order. A 4th (and 5th) action can be placed freely, but two extra actions must go in **different** opportunities `[KH 1486–1493]`.
- The shield / second-weapon extra action is placed last in the round, or freely if you have 4+ actions `[KH 1501–1504]`.
- Armour weight is the weight adjusted for the wearer's size (§17.3).
- 🔧 SIM: a character always has at least 1 action.

### 4.4 What one action can be `[KH 1512–1515]`
- **An attack and a parry are one action each.**
- With ≤ 3 actions you can make only **one attack or one parry per opportunity**, even with a shield or two weapons.
- Other actions: move (§15.1), shoot/throw (§15.2), aim (§10), draw or change weapon, pick something up, take cover, Tvinga ur balans / Undanmanöver (§12).
- Fists count as two weapons (two actions' worth). A kick is a single action `[II 1642–1649]`.

### 4.5 Parry timing 🔧 SIM
From the basic rule "the parry happens at the same time as the opponent's attack" `[II 1700–1701]` and KH *Lång stöt* ("the target can only parry in that opportunity"):
- A parry spends one of the defender's actions **in the same opportunity** as the attack.
- If you are attacked before acting in an opportunity, you may spend that opportunity's action to parry, or keep it to act normally.
- If you have already acted in that opportunity, you can only parry if you have a 2nd action placed in it.

### 4.6 Avvaktande strid (defensive fighting) – KH `[KH 1517–1543]`
Melee only, and only if you **won initiative**. Effects:
1. You lose initiative before every opportunity.
2. You **must parry**, except
3. when the opponent fumbles (⚠️ OCR-5: "rumlar" → "fumlar"). Then you may attack normally if you have an action left.

- You never leave a **blotta**, so the attacker always takes an aim penalty (§6.3).
- For each action you have **more than the attacker**, you get **+2 on all parries** that round.

---

## 5. Initiative `[II 1166–1175]` ✅

**Initiative = 1T10 + SMI + modifiers**, rolled by everyone at the start of every SR. Highest acts first.
Ties: the tied combatants re-roll to settle their order. The order holds for the whole SR.

Modifiers:
- Krigare profession: **+5** `[I 881]`. KH says "some of the new professions" share it, but each KH profession lists its own ability. 🔧 SIM-3: only Krigare gets +5.
- *Blixtrande reflexer* +3. *Snabbslående*: always acts first in the SR; two such characters roll normally `[KH 505, 516]`.
- Stridskonst *Initiativbonus*: +5 to SMI for turn order `[I 4266–4268]`. Hoppspark / Rundspark: −2 `[I 4257, 4308]`.
- *Duellera*: +1 per B-level, in duels only `[KH 1209]`.
- *Härskri* (skill, KAR): success at the very start of combat makes the opponent lose initiative; you attack first. Once per fight `[KH 1239–1243]`.
- *Kanes manöver*: attack first in the SR even with the weapon sheathed `[KH 3102–3109]`.

---

## 6. Hit locations

### 6.1 Melee table – KH `[KH 1585–1597]` (random columns identical to the basic table `[II 1414–1424]`)

| Location | Blotta (1T20) | Aim penalty (CL) | Random – melee (1T20) | Random – ranged (1T20) |
| :--- | :-: | :-: | :-: | :-: |
| Left leg* | 1–2 | −1 | 1–2 | 1–3 |
| Right leg* | 3–4 | −3 | 3–4 | 4–6 |
| Abdomen | 5–6 | −4 | 5–8 | 7–9 |
| Left arm* | 7–10 | −1 | 9–11 | 10–11 |
| Right arm* | 11–14 | −2 | 12–14 | 12–13 ✅ |
| Chest | 15–18 | −3 | 15–16 | 14–18 |
| Head | 19–20 | −4 | 17–20 | 19–20 |

\* Against a **right-handed** opponent. Against a left-hander, swap left and right. Against dubbelhänt/ambidextriös opponents, roll at the start of each SR to see which way they fight.

✅ OCR-1 resolved: the basic table gives right arm **12–13** in the ranged column.
⚠️ OCR-2 (possible): the KH text says the defender usually exposes the *sword arm* (right) and the *shield-side leg* (left), but the table gives left arm −1 and right arm −2. Keep the table as written.

**KH⇢II:** the basic rules give a flat −5 to aim at any location `[II 1407–1408]`. KH replaces this in melee with blotta and per-location penalties.

### 6.2 Blotta (exposed area) – KH
- At the **start of every SR**, everyone in melee rolls 1T20 on the *Blotta* column. The result is the area **they** expose.
- Attacking the opponent's blotta: **no CL penalty**.
- When fighting several opponents, roll one blotta per attacking opponent.
- Avvaktande strid and Sköldmur (from the front): no blotta, so attackers always take the aim penalty.

### 6.3 Aiming
Melee: choosing a location other than the blotta gives the aim penalty in the table.
Ranged: hit location is random (*Random – ranged* column), or aim at a chosen location for **−5** `[II 1351]`.

### 6.4 Left-handed opponents – KH `[KH 1601–1611]`
**−2 CL** when fighting a left-handed opponent (applies to everyone, including other left-handers). Dubbelhänt and ambidextriös characters are **not** affected.

### 6.5 Slå vilt (wild swing) – KH `[KH 1613–1618]`
Location is rolled on the *Random – melee* column. The attacker gets **−5 CL**; the defender gets **−3 CL to parry** a wild swing.

---

## 7. Attack and defence resolution

### 7.1 CL modifiers `[II 1341–1370]`

**Melee**

| Situation | Modifier |
| :--- | :-: |
| Target prone | +5 |
| Attack from the side | +3 (the target may still parry) |
| Attack from behind | +7 (an unaware target can't parry; needs Smyga vs Upptäcka fara) |
| Target immobile (unconscious, etc.) | +10 |
| Dusk / torchlight | −5 |
| Darkness | −15 (minimum CL 1) |
| Aim at a location | KH table (§6.1) |
| Attack with the shield hand | −10 |
| Wounds | §11.2 |
| Left-handed opponent (KH) | −2 |
| Wild swing (KH) | −5 |

🔧 SIM: the −10 shield-hand penalty doesn't apply to a combination covered by a *Två vapen* skill (that skill is how you learn to fight with both hands), nor to ambidextriös characters.

**Ranged**

| Situation | Modifier |
| :--- | :-: |
| **Target running or flying** | **CL halved** (round up), applied **before** all other modifiers `[III 2632–2636]` |
| Target prone | −1 per square between shooter and target |
| Target immobile | +10 |
| Dusk / torchlight | −5 |
| Darkness | −15 |
| Aim at a location | −5 |
| Range < ½ of the weapon's range | ±0 `[III 2638–2646]` |
| Range ½ – ¾ | −5 |
| Range ¾ – full | −10 |
| Beyond max range | Not possible |
| Wind from behind or the side | −1 per m/s. Headwind: no CL effect, but range −2% per m/s `[III 2648–2654]`. 🔧 SIM: no wind by default (configurable) |
| Target takes cover | − the target's differensvärde (§15.2) |
| Aiming over several actions (KH Sikta) | +1 per action, max +3 |

### 7.2 Who may parry `[II 1379–1383, 1651–1665]`
- A parry needs a weapon or shield and costs an action (KH). The weapon FV is used; shields use the shield skill.
- **Projectiles can't be parried** (arrows, bolts, sling stones are too fast). Thrown weapons can be parried with a **shield** if the defender sees the throw `[II 1289–1293, III 2993–2999]`. Shields can still stop projectiles passively (§16, shields).
- **Exceptions – projectile parrying:**
  - Stridskonst technique **Projektilparering** `[KH 7561–7566]` (optional eastern-warriors rules, §12.1): parry *or dodge* arrows, sling stones, thrown spears and other projectiles. One successful roll stops one projectile. You can try to stop several at once: −5 CL for 2, −10 for 3, −15 for 4, −20 for 5. Details in §12.1.
  - Special ability *Snabb uppfattningsförmåga*: parry projectiles you see coming with the FV of the melee weapon you hold `[I 1415, KH 529]`.
- **You can never parry while holding a ranged weapon.** Projectile weapons have no BV; if one is hit, it breaks `[III 2686–2688]`.
- **A perfect attack gets no parry roll.** 🔧 This is an **inference**; no sentence says "can't be parried". The text says a parry is rolled when the attack "blir lyckat eller misslyckat" `[II 1377]`, and the results table lists *Perfekt | Pareringsslag: Slås ej* `[II 1397]`. KH says nothing about it.
- A shield whose STY requirement exceeds your STY can't be used to parry; it only hangs there and protects the shield-side leg from projectiles `[III 2704–2707]`.
- **Chain weapons and whips are hard to parry: the defender's parry CL is halved** `[III 2598–2610]`.
- Unarmed attacks can always be parried, armed or not (unarmed defenders use Slagsmål, or Stridskonst with *obeväpnad parering*).
- You can't parry a weapon bare-handed without the *obeväpnad parering* technique. An unarmed defender may choose to block with an arm: if the attack succeeds and the "parry" succeeds, the arm takes normal damage; otherwise nothing changes.
- If an unarmed attack fails and the defender parries successfully **with a weapon** (not a shield), the attacker takes 1T2−1 KP in the attacking arm.
- Parry modifiers: *Fint* halves the parry chance `[I 4241–4246]`; Parerdolk +3 `[TL 2037]`; *Snabb uppfattningsförmåga* +5 and can parry projectiles `[KH 529]`; Avvaktande +2 per extra action; wild swing −3; Knähugg −5. Bärsärk never parries `[I 2937]`.

### 7.3 Results table `[II 1385–1397]` ✅

| Attack roll | Parry roll | Result |
| :--- | :--- | :--- |
| Fumble | not rolled | Roll on the attack fumble table (§10.1) |
| Failed | Fumble | Roll on the parry fumble table (§10.1) |
| Failed | Failed | Nothing happens |
| Failed | Success / Perfect | Roll normal damage. If damage > the **attacker's** weapon BV, its BV −1 |
| Success | Fumble | Parry fumble table, **then** the attack hits (determine location) |
| Success | Failed | Hit – determine location, roll damage |
| Success | Success | Roll normal damage. If damage > the **defender's** weapon/shield BV, its BV −1. If BV thereby reaches 0, the defender takes the excess damage |
| Success | Perfect | Nothing happens |
| Perfect | not rolled | Hit. **Maximum damage**; the defender's armour **does not absorb** |

No parry possible (projectile, holding a ranged weapon, unaware, etc.) → treated as "Parry failed".

**BV details** `[III 2656–2688]`:
- Damage for the BV check is normal damage **including SB** ("glöm inte SB:n!").
- **A weapon or shield whose BV reaches 0 breaks** and can't be used any more. This applies to the attacker's weapon too.
- When the defender's parrying item breaks: "Skada tillfogas motståndaren som vanligt, men blir en poäng lägre" – the defender takes the damage **as normal, minus 1** `[III 2674–2675]`. *II* phrases it as "tar den överskjutande skadan" `[II 1395]`, and its "Slå skada" section says the already-rolled damage "minskas med ett" `[II 1431–1433]`. 🔧 Proposed: follow *III* – full damage −1 to the attacked location. ✅ OCR-7 resolved by this.
- **Spears, pikes, staves and natural weapons can't damage a parrying weapon** (no BV loss for the parrier) `[III 2684–2685]`.
- Shields lose BV in the same way as weapons `[III 3023–3026]`.

🔧 SIM-4 (BV with KH's split damage): "damage" for the BV check = **KP damage roll + SB**. When the item breaks, the defender takes KP −1 and SP −1 (before armour) to the attacked location.

### 7.4 Perfect attacks – combined basic + KH rule 🔧 SIM-5
- Basic: max damage + max SB, armour ignored `[II 1374–1377, 1397, 1430]`. No parry roll is made (inferred, see §7.2).
- KH: max damage + max SB, **plus a roll on the KH critical hit table** for the location (§9) `[KH 2219–2223]`.
- KH doesn't repeat "armour ignored". KH *Dödande anfall* gives "max damage" on success and "armour doesn't absorb" on a perfect roll `[KH 3068–3075]`, which is consistent with a perfect attack ignoring armour.
- **Proposed:** perfect attack = no parry, max KP and SP damage + max SB, **armour ignored**, roll on the KH critical table.
  Option (house rule): a perfect attack can be parried, but only by a perfect parry.

### 7.5 Facing, flanking and attacks from behind `[II 1732–1756, KH 1128–1145, I 934–950]` ✅ (rules option *Facing*, default on)
- **From the side: +3 CL**; the defender may parry. **From behind: +7 CL**.
- **Unnoticed attacker:** only a fighter **hidden from the start** (chosen per fighter in the setup) can steal up on someone – you can't decide to sneak behind an enemy that has already seen you. A hidden attacker from behind rolls *Smyga*; on a success the defender rolls *Upptäcka fara* at −(the attacker's differensvärde). If that fails, the defender **can't parry**. Both are primary skills: without a value on the sheet the base chance (BC) of SMI / PSY is used, plus racial bonuses (Alv +4 / Halvalv +2 Upptäcka fara, Anka +4 Smyga). Smyga is halved in metal armour `[III 2971–2974]`; a Prisjägare always has CL ≥ 17 in Upptäcka fara `[KH 261]`.
- **Anfall bakifrån** (skill, SMI) `[KH 1128–1145]`: against an unnoticed defender, its FV is added to the damage of a dagger-sized weapon (no bigger than a short sword).
- **Lönnmördare** `[I 934–950]`: against an unnoticed defender, weapon damage ×2 on a success and ×4 on a perfect roll, **no SB**; even a failed attack roll hits, for normal damage without SB; a fumble fails. Anfall bakifrån is added after multiplying.
- A shield doesn't stop missiles from a shooter behind its bearer (§15).
- Fighting several opponents, a fighter rolls a separate blotta for each one `[KH 1523]` (already modelled).
- 🔧 SIM-27, SIM-28: how facing is decided and when the Smyga check is made (§20).

---

## 8. Damage

### 8.1 Rolling damage – KH `[KH 1647–1711, 3654–3661]`
Every weapon has a separate **KP** die and **SP** die (tables in §16, KH values override the basic table). Add SB in melee, to both KP and SP (GAP-9).

### 8.2 Armour absorption – KH `[KH 3956–4157]` (KH⇢II single abs value)
- Armour absorbs **KP and SP separately**, **per hit location**.
- Damage to a location = max(0, KP roll − abs KP) and max(0, SP roll − abs SP).
- **Layering:** abs KP of the layers is **added**. abs SP is **not added** – use the highest single layer `[KH 4024–4028]`.
- Maximum one piece per type code (I, II, III) on each body part, so up to 3 layers `[KH 4030–4034]`.
- Complete armours (§17.1) can't be layered with each other `[KH 3970–3971]`.

### 8.3 Penetration (ranged only) – KH `[KH 1621–1628, 3663–3674]`
Ranged weapons have **PV KP/SP**, subtracted from the armour's absorption (minimum 0). No effect on unarmoured targets.

### 8.4 Applying damage
Subtract from the location **and** the total pool, for both KP and SP `[II 1452–1454]`.

### 8.5 Snuddande träff (glancing hit) – KH `[KH 1860–1880]`
Cutting/thrusting weapons only (not blunt weapons). If the attack roll **exactly equals CL**, roll 1T6:

| Armour on hit location | Glances on |
| :--- | :-: |
| Metal armour | 1–4 |
| Lamellar | 1–3 |
| Chainmail | 1–2 |

A glancing hit does **half damage** (roll, then halve).

### 8.6 SP overflow → KP – KH `[KH 1752–1759]`
SP damage beyond what a location (or the total) can take is **converted to KP damage**, both per location and for the total.

### 8.7 Max-damage effects
Perfect attack (§7.4), *Dödande anfall*, and Riddare's PSY ability: max weapon damage + max SB.

---

## 9. Critical injuries

Two separate triggers:

### 9.1 Perfect attack → KH critical hit tables `[KH 2217–2706]`
- Roll **1T20** on the table for the hit location (Head / Chest / Abdomen / Arms / Legs). For light weapons (daggers, arrows), roll **1T10**.
- When a side matters, roll 1T4: 1–2 right, 3–4 left.
- KH: critical injuries are caused **only by KP**. SP alone never causes criticals `[KH 1786–1793]`. 🔧 SIM: roll on the critical table only if the perfect attack did at least 1 KP after armour. (With armour ignored, it almost always does.)
- ⚠️ OCR-3: the Arms table is missing entry **4**. Proposed: reuse entry 3.

### 9.2 Double damage in a location → basic critical rules `[II 1501–1547]`
If a location takes **more than twice its KP** ("dubbelt så mycket skada som den tål"):

| Location | Effect |
| :--- | :--- |
| Arm / leg | Critically injured, never fully usable again. Roll 1T10: 1–3 bone broken (later −3 CL); 4–5 ugly joint wound (−4 CL, stiff joint, leg: FF to 1/6 ⚠️ OCR "L6"); 6–7 nerves severed (paralysed limb); 8–9 muscles/tendons cut (−5 CL); 10 bone crushed, amputation |
| Chest / abdomen | Immediately unconscious; **bleeds to death within FYS SR** unless First aid at −10 or HELA E3 **and** a hard FYS roll |
| Head | Crushed or cut off – **dies immediately** |

KH *Krossande slag* uses the 1–3 "broken bone" result when damage exceeds a location's KP (not double) `[KH 3117–3125]`.

### 9.3 Effect primitives (engine encoding of the KH tables)

| Primitive | Examples |
| :--- | :--- |
| Lose next action | Head 1–4, Chest 1–2, Abdomen 2, Arms 1, Legs 1, 3 |
| Lose all remaining actions this SR | Head 7, 9, 12, 13; Chest 3, 5, 6, 8; Arms 2, 3, 5, 11, 12; Legs 2, 4–7, 9 |
| Incapacitated for N SR | Chest 4 (2 SR), Chest 10 (1T6 SR), Arms 9/10 (1 / 1T6 SR), Abdomen 9 (2T6 SR), Chest 15 (2T6 + 2T6 SR) |
| −1 action every SR from now on | Head 7–9, Abdomen 5–7, Arms 12–14, Legs 9–14 |
| CL penalty (−1 / −2 / −5 / −10), all or limb-only | Many entries |
| Drop held item | Arms 1–3, 5–8, 11–13, 15 |
| Limb unusable | Arms 8, 11–20; Legs 9, 11, 13–15 |
| Movement ×½ / ×¼ / 0 | Abdomen 4, 6; Legs 3, 5, 7, 9–11, 13, 17 |
| Falls prone | Chest 3; Abdomen 3, 8, 9, 11, 12; Legs 2, 8, 15 |
| Bleeding: 1 KP per SR, or 1 KP per 6 SR (2 KP per SR for Legs 20) | Head 6, 15–17, 19, 20; Chest 9, 12–14, 16, 19; Abdomen 10, 14–16, 19, 20; Arms 15–17, 19, 20; Legs 12, 14, 16, 18–20 |
| Unconscious (1T20 SR / minutes / hours) | Head 11, 18–20; Chest 11 |
| Out of the fight (paralysed, hours/weeks) | Head 14; Chest 17, 18; Abdomen 12, 17, 18 |
| Dies within a time limit | Chest 20 (1T10 SR); Abdomen 13 (10+1T10 min) |
| Can only parry/crawl at −10 | Abdomen 11, 13; Legs 15 |

For the simulator, anything "out of the fight" ends that combatant's participation.

---

## 10. Special situations

| Rule | Effect | Source |
| :--- | :--- | :--- |
| **Rulla med slag** (roll with the blow) | When taking heavy SP damage, you may roll SMI. Success halves the SP damage (round down). Either way you **lose your next action** | KH 1813 |
| **Sikta** (aim, ranged) | +1 CL per action spent aiming, maximum +3 | KH 1822 |
| **Sköldmur** (shield wall) | From the front: no blotta. No effect from the flank or rear | KH 1829 |
| **Slå medvetslös** (situation) | A blunt weapon against a bare head: all damage counts as SP. Head SP reaching 0 → unconscious | KH 1842 |
| **Snuddande träff** | §8.5 | KH 1860 |
| **Svepande hugg** (situation) | Spend **all actions of the SR** on one sweep: **double SB**, can hit as many enemies as you have actions (separate attack and damage rolls). Afterwards you **lose your first action next SR**. Each target loses one action and must use one action to parry it. Swords, axes and short polearms only | KH 1900 |
| **Tappa balansen** (lose balance) | Losing **more SP than your STO in a single attack** knocks you back and you lose your next action. A successful *Fallteknik* roll prevents this | KH 1920 |
| **Liggande strid** (prone) | A prone fighter can only use a dagger, short sword, crossbow or natural weapons. Melee attackers get +5 against them | II 1726 |
| **Fasthållning** (grappling) | Attack with CL = (STO+SMI+STY)/3. If it hits, STY vs STY on the resistance table to hold. Re-roll every round; neither can do anything else | II 1706 |
| **Attack from the side / behind** | +3 / +7, unnoticed from behind: no parry (§7.5) | II 1732–1756 |
| Slå ur sadeln, Strypa, falling, water, fire | Out of scope for v1 | |

⚠️ *Svepande hugg* also exists as a **weapon technique** (§12) with different rules. 🔧 SIM: anyone can use the situation version; trained characters can use the technique version instead.

### 10.1 Fumble tables `[III 3119–3234]` ✅
Roll **1T20**. Which table: attack or parry with a melee weapon → **melee weapons**. Parry with a shield → **shields**.
Ranged/thrown attack → **ranged weapons**. Unarmed (and natural weapons) → **unarmed**. A 20 means roll twice, re-rolling further 20s.
"SR" in these tables is a whole combat round. 🔧 SIM: effects lasting days/hours last for the rest of the fight.
"Hits the nearest friend" applies only if an ally is adjacent (ranged: in the line of fire); otherwise treat it as a plain miss.

**Shields**

| 1T20 | Effect (condensed) |
| :-: | :--- |
| 1 | Shield split in two – destroyed |
| 2 | Shield cracked edge to edge – destroyed |
| 3 | Cut on a nail: −5 CL on next parry |
| 4 | Miss this parry; next SR you may only parry, at −10 |
| 5 | Shield askew: −3 CL on all parries for 2 SR |
| 6 | Shield in your way: −5 on next attack and next parry |
| 7 | Shield stuck in your gear: this and next SR can do nothing else |
| 8 | Off balance: all attacks and parries fail this SR and the next 1T3 SR |
| 9 | Stumble: this and next SR to get up (prone) |
| 10 | Dizzy: −2 CL on attacks and parries for 1T4+1 SR |
| 11 | Lose an armour piece: roll hit location (melee column), that location loses its armour |
| 12 | Sprained foot: FF −2 |
| 13 | Brooding: −5 CL on everything next SR |
| 14 | Shield straps break: shield drops at your feet |
| 15 | Fall over the shield: shield arm dislocated, arm and shield unusable for the rest of the fight; can get up next SR |
| 16 | Clumsy: opponent +5 CL on next attack against you |
| 17 | Shield flies 1T3 squares in a random direction |
| 18 | Knock down the nearest friend with the shield |
| 19 | View blocked: the next attack against you succeeds automatically |
| 20 | Roll twice |

**Melee weapons**

| 1T20 | Effect (condensed) |
| :-: | :--- |
| 1 | Weapon breaks |
| 2 | Weapon breaks; you take 1 KP to the head (ignores helmet) |
| 3 | Miss this attack/parry; next SR you may only parry, at −10 |
| 4 | Pulled back muscle: −4 CL on all SMI- and STY-based skills |
| 5 | Wrong grip: miss this SR, then −3 CL with the weapon for 1T4+1 SR |
| 6 | Sneeze: next SR you may only parry, at −2 |
| 7 | Weapon flies 1T3 squares in a random direction |
| 8 | Off balance: all attacks and parries fail this SR and the next 1T3 SR |
| 9 | Fall: this and next SR to get up (prone) |
| 10 | Fall flat: 3 SR to recover and get up |
| 11 | Lose an armour piece (roll location) |
| 12 | Sprained foot: FF −2 |
| 13 | Showing off: opponent +5 CL on next attack against you |
| 14 | Drop the weapon at your feet |
| 15 | Lose your grip: next SR you can only "stare at the opponent" (no attack) 🔧 may parry with another item only |
| 16 | Drop the weapon on your foot: 1 KP |
| 17 | Hit the nearest friend (normal attack immediately) |
| 18 | The next enemy attack succeeds automatically and you may not parry it |
| 19 | Swallow your tongue, fall – suffocate unless helped within 15 SR → out of the fight |
| 20 | Roll twice |

**Ranged weapons**

| 1T20 | Effect (condensed) |
| :-: | :--- |
| 1 | Weapon broken |
| 2 | String snaps / sling breaks / thrown weapon breaks |
| 3 | Can't act this and next SR |
| 4 | −4 CL on all ranged attacks (rest of fight) |
| 5 | Spend the whole next SR watching the missile |
| 6 | Spend the whole next SR regaining confidence |
| 7 | −4 CL for 3 SR |
| 8 | Fumbling with the ammunition this and next SR (no shot) |
| 9 | This and the next two attacks miss automatically |
| 10 | −5 on all manoeuvres next SR |
| 11 | Drop the weapon at your feet |
| 12 | Shoot without aiming this SR and the next: −15 CL |
| 13 | Cut your hand: −2 CL (rest of fight) |
| 14 | Next attack misses automatically |
| 15 | Drop the weapon (thrown weapon flies 1T6 squares) |
| 16 | Projectile: lose the arrow, can't shoot next SR. Thrown: lands 5 m behind you, you stand staring next SR |
| 17 | Self-injury (ear, finger, teeth or hand – weapon-specific); no more attacks with that hand 🔧 for thrown weapons |
| 18 | Hit the nearest friend in the line of fire (automatic success) |
| 19 | Shoot yourself in the foot: 1 KP, FF halved |
| 20 | Roll twice |

**Unarmed**

| 1T20 | Effect (condensed) |
| :-: | :--- |
| 1 | Next attack or parry misses automatically |
| 2 | Torn clothes: −3 on attacks and parries until you spend a whole SR fixing them |
| 3 | Strained shoulder/thigh: −3 CL on skills using it |
| 4 | Next SR: must parry, at −5 |
| 5 | No attacks or parries next SR |
| 6 | No parries for the next 2 SR |
| 7 | Lose next SR (may only parry) |
| 8 | −5 on next attack or parry |
| 9 | −10 on next attack or parry |
| 10 | Lose an armour piece (roll location) |
| 11 | Fall flat, lose 1T2 teeth: this and next SR to get up |
| 12 | Everyone attacking you next SR gets +3 CL |
| 13 | Opponent +3 CL on their next two attacks against you |
| 14 | Sprained foot: FF −2 |
| 15 | Stiff neck: −6 CL on all SMI-based skills for 1T20 SR |
| 16 | Back spasm: −10 on all SMI-based skills (rest of fight) |
| 17 | −2 CL on all attacks and parries until you roll a perfect |
| 18 | Perfect punch – on the nearest friend |
| 19 | Next enemy attack against you succeeds automatically |
| 20 | Roll twice |

🔧 SIM: in KH, an effect phrased per SR ("this SR", "next SR") applies to all of your actions in that round.

### 10.2 Chain weapons and whips `[III 2598–2614]` ✅
- Chain weapons (Stridsslaga, Stridsgissel – 🔧 also Bondeslaga) and whips (Piska, Oxpiska – 🔧 also Niosvansad katt): **the defender's parry CL is halved**.
- Hard to handle: an attack roll of **18, 19 or 20 is an automatic miss with a risk of fumbling**. Roll 1T20; if it's higher than FV it's a fumble (20 is always a fumble).
- Whip disarm: declare it before the attack. If it hits the **sword arm**, STY vs STY on the resistance table; if the defender loses, the one-handed weapon lands 1T4 squares away.

### 10.3 Spear against a charging creature `[III 2588–2596]`
In the **first SR** of combat, a spear can be set against a creature running at you. It works as a normal attack, and a hit does normal damage **plus the target's SB**. From the second round on, fighting is normal.
The rule refers to "avsnittet om vapenlängdens inverkan i strid" (weapon length in combat), which is missing (GAP-12, decided in §15.3).
🔧 SIM: available when an enemy uses a full move or run to end adjacent to (or within reach of) a spear wielder who has an unused action in that opportunity.

---

## 11. Effects of KP and SP loss

### 11.1 KP thresholds `[II 1460–1518]` ✅ (⚠️ OCR-4: several "0" digits are missing in the source; restored below)

| Condition | Effect |
| :--- | :--- |
| Total KP ≤ 2 | **Halved CL** on all skills |
| Total KP ≤ 1 | Can't use any skills; can only crawl away, talk with effort |
| Total KP = **0** | **Unconscious** (shock, blood loss) for 1T4 hours. Can't act until total KP is positive |
| Total KP ≤ **−FYS** | **Dead** |
| Any location KP = **0** | **Bleeding:** −1 total KP every 6 SR until First aid / HELA |
| Arm/leg KP = 0 | Limb unusable. A **hard PSY roll** (SG 15) lets you keep fighting with the remaining limbs. Leg → kneel. Arm → hangs limp |
| Chest / abdomen KP = 0 | Falls to the ground, can only crawl away → out of the fight |
| Head KP = 0 | Immediately unconscious for 1T100 − FYS minutes (minimum 5) → out of the fight |
| Location damage > 2 × its KP | Critical injury, §9.2 |

### 11.2 Wound penalties `[II 1513–1518]` ✅
- **−2 CL per lost KP in a location**, on all skills that need that body part.
  Example from the rules: 3 KP lost in the sword arm → −6 on all attacks, including two-handed weapons and bows (kicks unaffected).
- Losing **half of a leg's KP halves movement**.
- 🔧 SIM-6: which skills a location affects – arm: everything using that hand (attacks/parries with the weapon or shield in it, and anything two-handed); head: everything; chest/abdomen: all combat skills; legs: none (only movement). Each mapping is configurable.

### 11.3 SP thresholds – KH `[KH 1714–1759]` (⚠️ OCR-4: missing "0" digits restored)

| Condition | Effect |
| :--- | :--- |
| Total SP ≤ 5 | **Halved CL** (round down) on all skills (⚠️ the KP equivalent is "≤ 2"; "5" is kept as written) |
| Total SP ≤ 1 | Can't use any skills |
| Total SP = **0** | **Unconscious** for 1T20 minutes |
| Arm/leg SP = **0** | Limb unusable; a hard PSY roll lets you continue |
| Chest or abdomen SP = **0** | Falls to the ground, can only crawl → out of the fight |
| Head SP = **0** | Unconscious for 1T100 − FYS minutes (minimum 5) |
| SP below 0 | Not possible – the excess overflows to KP (§8.6) |

### 11.4 SP skill penalties – KH `[KH 1763–1776]`
- ≥ ½ of a location's SP lost: **−2 CL** on skills that need that body part. ≥ ¾ lost: **−4 CL**.
- **Don't stack** KP and SP penalties: per location, use the **higher** of the KP penalty (§11.2) and the SP penalty.

---

## 12. Weapon techniques (vapenakademier) – KH `[KH 2979–3215]`
Each technique is a separate skill (its own FV, capped by the FV of the weapon). Most are rolled **in addition to** the normal attack (both must succeed).

| Technique | Attr | Effect | Cost |
| :--- | :-: | :--- | :--- |
| Avväpna (disarm) | SMI | Success: the weapon flies 1T3+1 m. If both have the technique: STY+FV vs STY. Perfect: you take the weapon. Strapped weapon: dropped for 1 action only | Action (as an attack) 🔧 |
| Bryta vapen (break weapon) | SMI | STY+FV vs the weapon's BV on the resistance table; blade vs blade: own BV+FV vs their BV. Failure: own weapon −1 BV | Action 🔧 |
| Distrahera (distract) | SMI | Opponent −3 CL (perfect: the whole SR) | Free, combined with an attack |
| Dra vapen (quick draw) | SMI | Draw and attack in the same action | – |
| Dubbelhugg (double strike) | – | Two attacks in one action. Daggers, 1H swords, 1H axes. Once per SR, same target | Action |
| Dödande anfall (killing blow) | SMI | Max weapon damage + max SB; perfect: ignores armour. Once per SR | With an attack |
| Flygande hugg (flying strike) | SMI | Head or chest without aim penalty, +3 KP and SP. Not in metal armour | With an attack |
| Förutse blotta (predict opening) | INT | +5 CL against the blotta. Once per SR | Free |
| Hugg (strike) | STY | +2 KP and SP. Once per SR | With an attack |
| Härskri (technique) | PSY | Härskri vs the opponent's PSY on the resistance table: they lose their next action. Once per SR | 🔧 Free |
| Kanes manöver | SMI | Draw and attack first in the SR. Swords only | With the first attack |
| Knähugg (knee strike) | SMI | The opponent gets −5 to parry | With an attack |
| Krossande slag (crushing blow) | STY | Damage > location KP → bone broken / unconscious. Blunt, flail and 2H weapons | With an attack |
| Lång stöt (lunge) | SMI | +2 CL, +1 KP and SP. The target can only parry in that opportunity. Once per SR. 1H swords and daggers | With an attack |
| Parering (improvised parry) | SMI | Parry with anything; no BV requirement | Action |
| Sköldanfall (shield bash) | STY | Attack with the shield. CL ≤ shield CL | Action |
| Smärtstöt (pain strike) | SMI | −3 CL; if it hits, **max SP** damage | With an attack |
| Stöt (thrust) | SMI | +3 CL | With an attack |
| Svepande hugg (technique) | SMI | Up to 2/3/4/5/6 targets at FV ≤5/≤10/≤15/≤20/>20. −3 CL. One damage roll: 2nd target −3, 3rd −6, … Once per SR | **1 action** |
| Tvinga ur balans (force off balance) | STY | The opponent gets −5 CL on attack and defence for the rest of the SR | Action |
| Undanmanöver (dodge) | SMI | Your differensvärde is subtracted from the attacker's CL | Action (🔧 reactive, like a parry) |
| Virvelvindsanfall (whirlwind) | SMI | −3 CL; a new target each action without spending an action on movement (≤ 3 squares between targets). Attackers get −3 CL against you. Weapons with STY requirement ≤ 15 only | Mode |
| Vrida klinga (bind blade) | SMI | +5 CL to attack the arm | With an attack |

Out of scope: the technique Anfall bakifrån (slipping past to the back – the *skill* Anfall bakifrån is in, §7.5), Kasta svärd, Psykisk duell.

Academy packages (used for presets):
- **Fäktskolan på Beyural** (rapier + dagger): Avväpna, Distrahera, Förutse blotta, Hugg, Lång stöt, Parering, Smärtstöt, Stöt, Undanmanöver `[KH 3313–3317]`
- **Kanes orden** (1H sword + shield): Bryta vapen, Dubbelhugg, Dödande anfall, Hugg, Kanes manöver, Parering, Sköldanfall, Stöt, Svepande hugg, Undanmanöver `[KH 3462–3467]`
- **Hauksheim** (axes): Dubbelhugg, Hugg, Krossande slag, Parering, Svepande hugg, Tvinga ur balans `[KH 3604–3606]`

### 12.1 Stridskonst (martial arts) techniques `[I 4116–4325, KH 7503–7588]`
> **Optional:** everything from KH's chapter *Österländska krigare* (KH 6645–7668) – the eastern-only techniques **Projektilparering, Förutse anfall, Kiai, Rullande attack, Rustad strid, Fallande spark**, plus eastern weapons, armour and professions (§13: Kensai, Budoka, Ninja, Samuraj, Ronin) – is only used when the rules option **Eastern warriors** is switched on (default **off**). Techniques the eastern list shares with the basic rules or the weapon academies stay available.

Martial arts work differently from weapon techniques: one **Stridskonst FV covers every technique the school includes** `[I 4143–4145]`.
The KH eastern schools add new techniques to the basic list `[KH 7516–7536]`. Combat-relevant ones:

| Technique | Source | Effect | Cost 🔧 |
| :--- | :--- | :--- | :--- |
| **Projektilparering** (projectile parry) | KH 7561 | Parry or dodge an incoming projectile (arrow, sling stone, thrown spear, …). Several at once: −5 CL for 2, −10 for 3, −15 for 4, −20 for 5 | 🔧 One action, used reactively like a parry; one roll can cover several projectiles arriving in the same opportunity. Works with or without a weapon in hand, but not while holding a ranged weapon (§7.2) |
| Förutse anfall (predict attack) | KH 7551 | +2 CL on a parry against the next attack. Once per SR | Free |
| Kiai | KH 7559 | As the weapon technique Härskri (§12) | Free 🔧 |
| Rullande attack (rolling attack) | KH 7570 | Combined with a non-kick attack: +5 initiative, +1 damage. Can't be combined with Initiativbonus | With an attack |
| Rustad strid (armoured fighting) | KH 7577 | Allows martial arts in armour up to *Förstärkt ringbrynja* (one armour type, chosen when learned). Never in Dubbel ringbrynja, full lamellar, full metal or full laminated armour. Roll each SR you fight in armour | Free roll each SR |
| Fallande spark (falling kick) | KH 7546 | 1T6 KP / 1T8 SP. Once per SR | Action |
| Dödande anfall, Förutse blotta, Undanmanöver, Virvelvindsanfall, Psykisk duell, Anfall bakifrån | KH 7540–7588 | As the weapon techniques (§12). Dödande anfall and Virvelvindsanfall only combine with Normalt slag / Normal spark | |
| Fint (feint) | I 4241 | Opponent's parry chance halved | With an attack |
| Initiativbonus | I 4266 | +5 SMI for turn order | Passive |
| Obeväpnad parering av vapen | I 4299 | Parry armed melee attacks unarmed | Action |
| Avväpning (disarm) | I 4187 | Unarmed parry that may disarm (weapon flies 1T3 squares; perfect = take it) | Action |
| Stålsättning (steel yourself) | I 4310 | Successful roll when taking damage → half damage (not vs head) | Free roll 🔧 |
| Bedövningsslag (stunning blow) | I 4202 | 1T3; if it damages, a hard FYS roll or lose next attack/parry | Action |
| Dubbelslag / Dubbelspark | I 4218 / 4225 | Two attacks at **different** opponents | Action |
| Hoppspark / Rundspark | I 4248 / 4304 | Bigger kicks; −2 initiative; a miss costs balance (lose next actions) | Action |
| Lågt kast / Högt kast / Låsning | I 4260–4291 | Throws and locks (target prone / held) | Action |
| Uppresning, Liggande strid, Vidvinkelsyn, Blind strid | I 4274–4325 | Get up instantly; fight prone; 270° awareness; fight blind | Passive / free roll |

Example schools (for presets): **Karate** and **Kenpo** include Projektilparering; **Ninjutsu** too, plus weapon techniques. Ju-jutsu doesn't `[KH 7612–7668]`.

---

## 13. Profession abilities relevant to combat

| Profession | Ability (in combat) | Source |
| :--- | :--- | :--- |
| Krigare | +5 initiative | I 881 |
| Barbar | +3 STO and FYS when calculating KP; +7 FYS when calculating SP | KH 117–122 |
| Gladiator | +3 BC on weapon skills (affects FV only) | KH 148 |
| Riddare | Spend 5 PSY: (1) hit any location without aim penalty, or (2) max damage including max SB. Armour and parry apply normally | I 1094–1107 |
| Vapenmästare | Spend 5 PSY: one extra parry or attack this SR | KH 373–376 |
| Tjuv | Spend PSY: +1 CL per point (max +3), max twice between sleeps | I 1132–1141 |
| Lönnmördare | Backstab ×2/×4 – needs stealth, out of scope for a 20 m face-off | I 934–950 |
| Krigarmunk | Cheaper Stridskonst techniques (affects presets only) | KH 180 |
| Prisjägare | Always CL ≥ 17 in Upptäcka fara – no effect in a straight fight | KH 250–261 |
| Paladin | Mentalism spells – magic out of scope for v1 | KH 218 |
| Kensai (eastern weapon master) | Spend 5 PSY: hit a chosen location and do **double damage** there; armour absorbs normally | KH 6793 |
| Budoka (eastern martial artist) | Spend 5 PSY: one blow that armour doesn't absorb at all | KH 6814 |
| Ninja | No penalties at night or by torchlight; −5 CL in total darkness | KH 6852 |
| Samuraj, Ronin | Social/fear abilities – no effect in a duel | KH 6732, 6765 |

PSY points: the simulator tracks the current PSY pool (starting at PSY) and spends from it.

---

## 14. Special abilities and skills relevant to combat
*Precisionssinne* (+1 CL all weapons), *Dubbelhänt* / *Ambidextriös*, *Tur* (1 PSY → +1 CL), *Gudarnas gunstling* (25% chance of full KP restore at 0), *Smärttålig* (SP ×1.5), *Stryktålig* (KP ×1.5), *Snabbslående*, *Blixtrande reflexer*, *Finna blotta* (opponent's abs KP −3, minimum 0), *Snabb uppfattningsförmåga* (+5 parry, can parry projectiles), *Extremt snabb* (+1 action), *Kattfotad* (no lost actions from falls), *God kroppskontroll* (FYS roll → +5 STY for 3 SR), *Järnnäve* (max unarmed damage), *Baneman* (+5 CL vs one race) `[KH 476–531]`.

**Bärsärkagång** (skill, PSY) `[I 2925–2955]`: +1T6 damage on melee attacks, **one extra attack last in each SR**, never parries, ignores wounds (a critically injured limb still becomes unusable). When a location reaches 0 KP, roll to calm down.

**Stridsmoral** (morale) `[II 1589–1636]`: applies to NPCs only (player characters are never forced). Roll when: own leader flees/falls, half the group is out, ambushed, **lost more than half its KP**, or attacked by a larger berserker. 1T20 + allies − 2×(allies who fled) − enemies − 2 (attacked from 2+ sides) − 5 (leader wounded) − 10 (leader gone) − 4 (lost > ½ KP). A result **≤ PSY** means it flees, or surrenders if it can't flee. 20 always fails, 1 always succeeds. 🔧 SIM: optional for AI-controlled combatants, off by default for duels.

---

## 15. Movement, ranged combat and weapon handling

### 15.1 Movement `[II 1150–1164, 1198–1206, 1228–1229]` ✅ (mapped onto KH actions 🔧 SIM-7)
Basic rules:
- **Full movement:** up to FF squares (a jog). Nothing else that SR, except that you may stop to take cover or **parry**.
- **Taking part in melee:** you may move at most **⌊FF/2⌋** squares before the fight.
- **Running:** 2 × FF; nothing else at all (not even parrying), unaware of your surroundings. **Sprinting:** 3 × FF; only without armour, pack or anything in your hands.
- Talking (more than a short shout): at most ½ FF, and only parrying that SR.

Mapping to KH actions:
- A **Move** action moves up to ⌊FF/2⌋ squares.
- If you attack in an SR, your **total movement that SR is limited to ⌊FF/2⌋**.
- If all your actions in the SR are Move or parry, you may move up to FF (full movement).
- **Run** (2 × FF) uses the whole SR: no attacks and no parries.
- Sprint: not offered in v1.
- Starting distance 20 m ≈ 13.3 squares. With FF ≈ 11–12, two fighters meet in round 1 (one full move + one half move) or round 2.

### 15.2 Ranged combat `[II 1287–1328]`
- **Shooting** a projectile weapon: stand still, aim, shoot. Nothing else that SR except reloading.
  **Throwing:** stand still, aim, throw; nothing else that SR.
  🔧 SIM-8 (KH actions): **one shot or throw per SR**, using one action. Your other actions that SR may only be *Sikta* (+1 CL each, max +3 – aiming can also carry over from the previous SR) or reloading. You can't parry while holding a ranged weapon.
- Reload times: Stavslunga 1 SR, Lätt armborst 3 SR, Tungt armborst 6 SR, Arbalest 12 SR, everything else 0 SR `[II 2743–2751]`.
- There must be **at least one square between** shooter and target. Shooting through squares with other people risks hitting them (default 50%).
- **Taking cover:** if you act before the shooter, you can take cover or throw yourself down instead of doing anything else that SR. Roll a normal SMI roll. Cover: subtract the differensvärde from the shooter's CL. Throwing yourself down: −1 per square between you. The shooter must still fire.
- Thrown-weapon range = thrower's **STY in squares**. Projectile max range = RV in the table.
- Hit location: random on the ranged column, or aim for −5 (§6.3).
- The target can't parry, except with *Projektilparering* or *Snabb uppfattningsförmåga* (§7.2), or by shield cover (§16).
- **Range modifiers** `[III 2638–2646]` ✅: closer than ½ range ±0; ½–¾ −5; ¾–full −10; can't shoot beyond max range. 🔧 Thrown weapons use STY squares as their range.
- **Moving target** (running or flying): CL halved (round up) before other modifiers `[III 2632–2636]`. 🔧 SIM: "running" = the target used a *Run* or full move in its last action.
- **Stray projectiles** `[III 2625–2630]`: a missed shot continues in a straight line up to 50% beyond the target (within max range). Each creature in the 1-square-wide path is hit on 1% per STO point, checked in order. 🔧 SIM: implemented for multi-combatant fights; with only two combatants a miss is just a miss.
- **Shields vs projectiles** `[III 3002–3020]`: §16 (shields).

### 15.3 Weapon handling and reach `[II 1280–1285, III 2690–2715, 2799–2803]`
- Melee: the target must normally be in the **adjacent square**. Weapons with **Längd ≥ 1** (spears, halberds, etc.) can attack one or more squares away, even through squares with other fighters. 🔧 SIM: reach = Längd + 1 squares (Längd 0 = adjacent).
- **GAP-12** (decided): the section "vapenlängdens inverkan i strid" (how weapon length affects combat, e.g. who strikes first in the first round) is referenced `[III 2593]` but missing. **Rule used:** in the SR when two fighters first come into reach of each other, the one with the longer weapon gets their first attack before the other's, regardless of initiative.
- **STY requirement** `[III 2696–2707]` ✅:
  - STY ≥ requirement → may use the weapon **one-handed**.
  - Requirement > STY → must use **two hands**.
  - Requirement > **2 × STY** → **can't use it in combat at all**. A ranged weapon with requirement > 2 × STY can't be drawn/spanned.
  - A **shield** with requirement > STY can't be used to parry; it only protects the shield-side leg from projectiles.
- Using a one-handed weapon **with two hands: damage +1T2** `[III 2709–2715]`. You can't switch grips mid-round (hold it in one hand and parry with the other, then grip it two-handed to attack). Never two-handed with a shield. 🔧 SIM: the grip is chosen at the start of the SR; +1T2 is added to KP damage.
- **All projectile weapons need two hands. Thrown weapons can only be used one-handed.**
- **Two-handed only** (basic table, marked *): Trästav, Långspjut, Pik, Lans, Partisan, Spetum, Glav, Pålyxa, Hillebard, Tvåhandsyxa, Tvåhandssvärd.
  KH-only weapons, 🔧 SIM by group: Flamberge, Tvåhandsgissel, Tvåhandshammare, Strids-trästav and Jaktspjut are two-handed. Note that Skäggyxa, Stridsslaga and Bastardsvärd are **not** marked two-handed.
- KH light-weapon action bonus: STY ≥ requirement + 10 (§4.3).

### 15.4 Carrying capacity (Bärförmåga) `[III 3372–3402]`
Normal capacity = **STY kg**. Clothes don't count; **worn armour counts at half its weight**.

| Load | FF, SMI and CL of SMI-based skills | Other |
| :--- | :-: | :--- |
| < STY × 1 | ±0 | – |
| STY × 1 – 2 | −1 | Can't run, sprint or swim |
| STY × 2 – 3 | −2 | ″ |
| STY × 3 – 4 | −4 | ″ |
| STY × 4 – 5 | −6 | ″ |
| STY × 5 – 6 | −8 | No SMI-based skills at all |

None of the values can drop below 1. This matters for presets in heavy armour: SMI-based skills include daggers, flails, bows, crossbows, shields, and the SMI used for initiative. 🔧 SIM: the reduced SMI also changes initiative and the action count (SMI 19+).
Metal armour: no Akrobatik/Hoppa; Smyga and Klättra halved `[III 2971–2974]` – out of scope for combat.

---

## 16. Weapon tables (KH values override the basic table) `[KH 3706–3869]`
Columns: KP damage, SP damage, STY requirement, Längd (reach), weight in kg, BV. **2H** = two hands only (§15.3).

### Daggers (Dolkar – SMI)
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Dolk | 1T4+1 | 1T3 | 1 | 0 | 0.5 | 9 |
| Testikeldolk | 1T6 | 1T3 | 1 | 0 | 0.5 | 15 |
| Parerdolk | 1T4+1 | 1T3 | 1 | 0 | 0.5 | 15 |
| Stilett | 1T3 | 1T3 | 1 | 0 | 0.25 | 5 |

### One-handed swords (Enhandssvärd – STY)
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Bastardsvärd | 1T10+1 | 1T8 | 17 | 0 | 5.5 | 15 |
| Bredsvärd | 1T8+1 | 1T6 | 13 | 0 | 4.5 | 15 |
| Falchion | 1T8 | 1T6 | 11 | 0 | 4 | 15 |
| Kortsvärd | 1T6+1 | 1T4 | 7 | 0 | 2 | 15 |
| Kroksabel | 1T8+1 | 1T6+1 | 9 | 0 | 3 | 15 |
| Långsvärd | 1T10 | 1T6 | 11 | 0 | 4 | 15 |
| Sabel | 1T8 | 1T4 | 9 | 0 | 3 | 15 |
| Stickvärja | 1T6+1 | 1T3 | 7 | 0 | 2 | 8 |
| Träningssvärd | – | 1T6 | 7 | 0 | 2 | 7 |
| Värja | 1T8+1 | 1T6 | 9 | 0 | 3 | 12 |

### One-handed blunt (Enhands krossvapen – STY)
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Hjälmkrossare | 1T6 | 1T10 | 11 | 0 | 4 | 15 |
| Klubba | 1T4 | 1T6 | 5 | 0 | 1 | 7 |
| Knogjärn | +1 | +2 | 1 | 0 | 0.5 | – |
| Morgonstjärna | 1T8 | 1T10+1 | 13 | 0 | 4.5 | 11 |
| Spikklubba | 1T6 | 1T6 | 5 | 0 | 1 | 7 |
| Stridshammare | 1T6 | 1T10 | 11 | 0 | 4 | 15 |
| Stridsklubba | 1T6 | 1T8 | 9 | 0 | 3 | 11 |
| Tung spikklubba | 2T4 | 1T10 | 21 | 0 | 6 | 11 |
| Tung träklubba | 1T8 | 1T10 | 21 | 0 | 6 | 11 |

### One-handed axes (Enhandsyxor – STY)
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Bredyxa | 1T8+1 | 1T6 | 9 | 0 | 3 | 11 |
| Handyxa | 1T6+1 | 1T4 | 9 | 0 | 3 | 11 |
| Korpnäbb | 1T8 | 1T6 | 7 | 0 | 2 | 15 |
| Stridsyxa | 1T8+2 | 1T6 | 11 | 0 | 4 | 11 |

### Two-handed weapons (Tvåhandsvapen – STY)
| Weapon | KP | SP | STY | L | Vikt | BV | Hands |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Flamberge | 2T10+1 | 1T10 | 31 | 1 | 8 | 15 | 2H 🔧 |
| Skäggyxa | 2T8+1 | 1T8 | 25 | 0 | 6.5 | 11 | 1H/2H |
| Tvåhandsgissel | 2T6 | 2T6+2 | 31 | 1 | 8 | 15 | 2H 🔧 |
| Tvåhandshammare | 1T10 | 2T6+2 | 31 | 1 | 8 | 15 | 2H 🔧 |
| Tvåhandssvärd | 2T10+2 | 1T8+1 | 31 | 1 | 8 | 15 | 2H |
| Tvåhandsyxa | 2T10+1 | 1T8 | 31 | 1 | 8 | 11 | 2H |

### Spears (Stickvapen – STY)
| Weapon | KP | SP | STY | L | Vikt | BV | Hands |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Jaktspjut | 1T8 | 1T8 | 10 | 1 | 6 | 20 | 2H 🔧 |
| Kortspjut | 1T6 | 1T4 | 7 | 1 | 2 | 11 | 1H |
| Långspjut | 1T10 | 1T6 | 11 | 2 | 4 | 11 | 2H |
| Pik | 2T8−1 | 1T8 | 25 | 3 | 6.5 | 11 | 2H |
| Spetum | 2T8+1 | 1T8 | 27 | 1 | 7 | 11 | 2H |
| Treudd | 3T6−1 | 1T6 | 15 | 1 | 5 | 11 | 1H |

### Flails and whips (Kättingvapen & piskor – SMI)
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Bondeslaga | 1T6 | 1T8 | 15 | 0 | 3 | 9 |
| Stridsgissel u. spik | 1T6 | 1T10+1 | 11 | 0 | 4 | 11 |
| Stridsgissel m. spik | 1T8 | 1T10 | 13 | 0 | 4.5 | 11 |
| Stridsslaga | 1T8+1 | 2T6 | 25 | 0 | 6.5 | 11 |
| Niosvansad katt | 1T4 | 1T8 | 12 | 0 | 3 | 3 |
| Oxpiska | 1T3 | 1T6+1 | 11 | 1 | 4 | 5 |
| Piska | 1T2 | 1T4+1 | 9 | 1 | 3 | 3 |

### Polearms (Stångvapen – STY) – all two-handed
| Weapon | KP | SP | STY | L | Vikt | BV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Glav | 2T10 | 1T10 | 27 | 1 | 7 | 11 |
| Hillebard | 3T6+1 | 1T8 | 29 | 1 | 7.5 | 11 |
| Partisan | 2T8+2 | 1T8 | 27 | 1 | 7 | 11 |
| Pålyxa | 3T6 | 1T8 | 29 | 1 | 7.5 | 11 |
| Trästav, vanlig | 1T3 | 1T8 | 7 | 0 | 2 | 7 |
| Trästav, strids- | 1T4 | 1T10 | 9 | 0 | 3 | 11 |

(Lances, tree trunks and tornerlans are omitted – mounted or joke weapons.)

### Bows / crossbows / slings (two-handed) and thrown weapons (one-handed)
| Weapon | KP | SP | STY | Range | Reload | PV |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Kortbåge | 1T6+1 | 1T4 | 18 | 135 m | 0 SR | 0/0 |
| Långbåge | 1T8+1 | 1T6 | 30 | 180 m | 0 SR | 2/1 |
| Pilbåge (liten båge) | 1T4+1 | 1T3 | 10 | 135 m | 0 SR | 1/0 |
| Ryttarbåge | 1T8 | 1T6 | 25 | 100 m | 0 SR | 1/1 |
| Sammansatt båge | 1T10+1 | 1T8 | 30 | 180 m | 0 SR | 2/2 |
| Arbalest | 3T6+3 | 1T10 | 32 | 250 m | 12 SR | 4/2 |
| Lätt armborst | 2T4+2 | 1T6 | 26 | 150 m | 3 SR | 2/1 |
| Tungt armborst | 2T6+2 | 1T8 | 28 | 225 m | 6 SR | 2/2 |
| Slunga | 1T6 | 1T4 | 10 | 90 m | 0 SR | 0/0 |
| Stavslunga | 1T8 | 1T6 | 22 | 120 m | 1 SR | 0/0 |
| Kastkniv | 1T4+1 | 1T3 | 3 | STY squares | – | 0/0 |
| Kastspjut | 1T6+1 | 1T4 | 7 | STY squares | – | 0/0 |
| Kastyxa | 1T6+2 | 1T4 | 11 | STY squares | – | 0/0 |

(KH's missile STY requirements match *III* `[III 2719–2744]`; *II*'s copy is off by 1–2 points. KH/III values are used.)

### Shields (Sköldar – SMI); damage = shield bash `[KH 3843–3854, II 2798–2810]`
| Shield | KP | SP | STY | Vikt | BV | Covers ("Skyddar") |
| :--- | :-: | :-: | :-: | :-: | :-: | :--- |
| Targ (bucklare) | 1T3 | 1T3 | 1 | 1 | 9 | Shield arm |
| Rundsköld, liten | 1T3 | 1T4 | 3 | 2 | 9 | Shield arm |
| Rundsköld, stor | 1T4 | 1T6 | 11 | 7 | 11 | Shield arm + abdomen + chest |
| Långsköld | 1T4 | 1T6 | 7 | 6 | 11 | Shield arm + chest + shield-side leg |
| Vanlig sköld | 1T4 | 1T6 | 7 | 6 | 11 | Shield arm + chest |
| Scutata | 1T4+1 | 1T6 | 7 | 8 | 13 | Shield arm + abdomen + chest |
| Pavise | 1T4+1 | 1T6 | 18 | 16 | 11 | Shield arm + abdomen + chest + shield-side leg |
| (+Metallskoning) | +1 | +2 | +3 | +3 | +3 | |

**Shields vs projectiles** `[III 3002–3020]` ✅: even when a projectile can't be parried, "there is some chance it hits the shield", provided the
shield faces the shooter (no help if the shooter is behind you). The "Covers" column says which locations are protected.
🔧 SIM-9: if a projectile's hit location (random or aimed) is a location the shield covers, and the shield faces the shooter,
the **shield is hit instead**. No damage to the bearer; the shield's BV check applies (damage > BV → BV −1). Thrown weapons can be
parried normally with a shield if the bearer saw the throw `[III 2993–2999]`.

### Unarmed (Slagsmål / Stridskonst) – KH values `[KH 3857–3868]`
| Attack | KP | SP | L |
| :--- | :-: | :-: | :-: |
| Normalt slag / Dubbelslag | 1T2 | 1T3 | 0 |
| Normal spark | 1T4 | 1T6 | 0 |
| Krosslag | 1T4 | 1T6 | 0 |
| Hoppspark / Rundspark | 1T6 | 1T6+1 | 1 / 0 |
| Fallande spark | 1T6 | 1T8 | 1 |

Unarmed fighting can't be done in armour heavier than leather `[I 4150]`, unless you have the technique *Rustad strid* (§12.1). Fists = two weapons; a kick = one action `[II 1640–1649]`.

TL additions (optional): Basilard 1T6/1T4 STY 5 BV 15; Dubbeldolk 1T4+1/1T3 BV 9; Parerdolk +3 CL on parries, and after a hit the gaffle can be opened in the wound for +1T4 KP / +1T2 SP `[TL 1920–1930, 2028–2042]`.

---

## 17. Armour – KH `[KH 3956–4157]` (KH⇢II/III single abs values)

Basic rules `[III 2805–2817]`: armour absorbs against any number of attacks per SR; natural protection and armour **add up**.
**KH⇢III:** the basic rules allow only one armour piece per body part; KH allows layering by type code (§8.2).

### 17.1 Complete armours
| Armour | abs KP | abs SP | Vikt | HB |
| :--- | :-: | :-: | :-: | :-: |
| Tjockt tyg | 1 | 2 | 7.5 | – |
| Läderrustning | 2 | 2 | 11 | – |
| Nitläder | 3 | 2 | 16 | – |
| Härdad läderrustning | 4 | 3 | 13 | – |
| Vadderad rustning | 3 | 5 | 12 | – |
| Benlamellrustning | 4 | 3 | 18 | – |
| Brigandinrustning | 5 | 3 | 17 | – |
| Ringpansar | 5 | 3 | 20 | – |
| Fjällpansar | 5 | 3 | 40 | – |
| Ringbrynja | 5 | 4 | 35 | −1 |
| Förstärkt ringbrynja | 6 | 4 | 51 | −1 |
| Dubbel ringbrynja | 7 | 4 | 54 | −1 |
| Lamellrustning | 7 | 3 | 28 | – |
| Laminerad rustning | 8 | 4 | 38 | −1 |
| Metallrustning | 8 | 4 | 31 | −1 |
| Räfflad metallrustning | 9 | 4 | 42 | −1 |
| Paradrustning | 10 | 5 | 45 | −1 |

🔧 SIM-2: KH's weight split (head 10%) suggests complete armour includes the head; the basic "Helrustning" covers "the whole body except the head". **Proposed:** complete armour covers every location **except the head**; presets add a helmet separately.

### 17.2 Armour pieces
Pieces: **helmets** (head), **arm guards** (per arm), **leg guards** (per leg), **Harnesk** (chest + abdomen), **Brynja** (chest + abdomen + arms), **Hauberk** (everything but the head).
The materials have the same abs values in every slot:

| Material | abs KP | abs SP | Type |
| :--- | :-: | :-: | :-: |
| Tjockt tyg | 1 | 2 | I |
| Läder | 2 | 2 | I |
| Vadderat | 3 | 5 | I |
| Nitläder | 3 | 2 | III |
| Härdat läder | 4 | 3 | III |
| Benlamell | 4 | 3 | III |
| Brigandin | 5 | 3 | III |
| Ringpansar | 5 | 3 | III |
| Fjällpansar | 5 | 3 | III |
| Ringbrynja | 5 | 4 | II |
| Förstärkt ringbrynja | 6 | 4 | II |
| Dubbel ringbrynja | 7 | 4 | II |
| Lamell | 7 | 3 | III |
| Laminerat | 8 | 4 | III |
| Metall | 8 | 4 | III |
| Räfflad metall | 9 | 4 | III |

Helmets: Tyghuva 1/2 I · Läderhuva 2/2 I · Nitläderhuva 3/2 III · Härdad läderhuva 4/3 III · Vadderad huva 3/5 I · Ringbrynjehuva 5/4 II · Dubbel ringbrynjehuva 7/4 II · Öppen hjälm 6/4 III · Hjälm med visir 7/4 III · Tunnhjälm 8/4 III (Tunnhjälm: −5 on Finna dolda ting / Upptäcka fara `[II 2899]`).
Weights per piece are in `[KH 4045–4157]` and will be transcribed into the data files.

For the glancing-hit table: *metal* = Metall, Räfflad, Laminerat, Parad, metal helmets; *lamellar* = Lamell, Benlamell; *chainmail* = all Ringbrynja types (🔧 SIM mapping).

### 17.3 Armour weight by body size `[II 2812–2829, III 2846–2876]`
Listed weights are for a normally built warrior (STO 13, FYS 13, STY 13); adjust by STO + STY + FYS:

| STO+STY+FYS | ≤8 | 9–11 | 12–14 | 15–17 | 18–20 | 21–26 | 27–33 | 34–39 | 40–45 | 46–51 | 52–57 | 58–63 | 64–69 | each +6 |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Weight | −70% | −60% | −50% | −40% | −30% | −20% | −10% | ±0 | +10% | +20% | +30% | +40% | +50% | +10% |

🔧 SIM: the adjusted weight is used for the KH 30 kg / 60 kg action thresholds (§4.3). The HB column of complete armours applies regardless of weight.

---

## 18. Combat end (simulator)
A combatant is **out of the fight** when unconscious, dead, dying, fallen with chest/abdomen at 0 (KP or SP), paralysed, fled or surrendered.
A side loses when all its combatants are out. The log reports the cause (e.g. "unconscious – total SP 0", "dying – abdomen critically injured").

---

## 19. Out of scope for the prototype
Mounted combat, animal/monster hit tables, fältslag, castles, demonic/elemental/divine items, gunpowder weapons, strangling, stealth outside the rear attack (§7.5), darkness, healing, infections, falling/fire/water damage.
Magic is in (§22), limited to combat spells of Elementarmagi; the spells left out are listed in §22.8.

---

## 20. Gaps, OCR issues and decisions

All proposed defaults, corrections and SIM interpretations below were **accepted on 2026-10-24**. Each stays a named option in `rulesConfig` so it can be changed later.

| ID | Topic | Status / proposed default |
| :--- | :--- | :--- |
| GAP-1 | Initiative roll | ✅ Resolved: 1T10 + SMI, re-roll ties, once per SR `[II 1166]` |
| GAP-2 | Parry, BV | ✅ Resolved by the results table `[II 1385]`. Engine detail SIM-4 |
| GAP-3 | STY requirement / handling | ✅ Resolved `[III 2690–2715]`: 1H if STY ≥ req, 2H if req > STY, unusable if req > 2×STY; 1H weapon used two-handed +1T2 |
| GAP-4 | Range modifiers | ✅ Resolved `[III 2638]`: < ½ ±0, ½–¾ −5, ¾–full −10 |
| GAP-5 | Movement | ✅ Basic rules found; KH mapping SIM-7 |
| GAP-6 | KP wound penalties | ✅ Resolved: −2 CL per lost KP in the location `[II 1513]`; skill mapping SIM-6 |
| GAP-7 | KP 0 / negative | ✅ Resolved §11.1 and §9.2 |
| GAP-8 | Fumble tables | ✅ Resolved `[III 3119–3234]`: four 1T20 tables (§10.1) |
| GAP-9 | SB on KP and/or SP | ✅ Decided (2026-10-24): add SB to **both** KP and SP |
| GAP-10 | Wind | ✅ Rule found `[III 2648]`; 🔧 off by default (no weather) |
| GAP-11 | Shield "Skyddar" column | ✅ Resolved `[III 3002–3020]`: shields stop projectiles to covered locations; engine detail SIM-9 |
| GAP-12 | "Vapenlängdens inverkan i strid" (weapon length) | ✅ Decided (2026-10-24): source missing `[III 2593]`; when first coming into reach, the longer weapon strikes first |
| OCR-1 | Ranged random table, arm overlap | ✅ Resolved: left arm 10–11, right arm 12–13 |
| OCR-2 | Arm aim penalties vs the text | Keep the table (L −1, R −2) |
| OCR-3 | KH Arms critical table missing entry 4 | Reuse entry 3 |
| OCR-4 | Missing "0" digits in the KP/SP thresholds | Restored in §11 |
| OCR-5 | "rumlar" in Avvaktande strid | "fumlar" |
| OCR-6 | CL < 1 rule missing numbers | FV ≥ 1 and CL ≤ 0 → needs two 1s |
| OCR-7 | "skadan … minskas med ett" | ✅ Resolved by `[III 2674]`: when the parrying item breaks, the defender takes damage −1 (§7.3) |
| SIM-1 | Parry timing within opportunities | §4.5 |
| SIM-2 | Complete armour and the head | Covers everything except the head |
| SIM-3 | Krigare +5 initiative for KH professions | Only Krigare |
| SIM-4 | BV check in KH (KP + SB vs BV; excess to KP) | §7.3 |
| SIM-5 | Perfect attack = basic (no parry roll – **inferred** from "Slås ej", armour ignored) + KH critical table | §7.2, §7.4 – option: only a perfect parry stops it |
| SIM-6 | Which locations penalise which skills | §11.2 |
| SIM-7 | Movement mapped to actions | §15.1 |
| SIM-8 | One shot/throw per SR, other actions aim/reload | §15.2 |
| SIM-9 | Shield hit by a projectile to a covered location: no damage, BV check | §16 (shields) |
| SIM-10 | Fumble effects lasting days → rest of the fight; "hit a friend" only with an ally nearby | §10.1 |
| SIM-11 | Carrying capacity also lowers SMI for initiative and the action count | §15.4 |
| OPT-1 | Eastern warriors chapter (KH 6645–7668) | **Optional, default off** – rules option *Eastern warriors* (decided 2026-10-26). Implemented: eastern techniques, katana (own two-handed damage row 1T10+2/1T8), wakizashi, ninjato, tanto, aiguchi, naginata, nodachi, daikyū, hankyū, eastern armour (never costs actions, can't be layered), Samurai preset |
| OCR-8 | Eastern arm armour *Kote* abs 13/6 (KH 7466) | ✅ Confirmed correct against the printed book (2026-10-26) – **13/6** used |
| SIM-12 | Projektilparering = one reactive action; one roll may cover several projectiles in the same opportunity (with the −5 steps); not while holding a ranged weapon | §12.1 |
| OCR-9 | HH fumble rule at FV > 20: "lägre än FV/2" | Read as "higher than FV/2", 16–20 always fumbles (§21.1). Option: basic rule |
| SIM-13 | Stålsättning as berserker damage tolerance | §21.6 |
| SIM-14 | Hero point declared with the attack/parry, applied to the result | §21.2 |
| SIM-15 | FV 21+ extra action as a weapon-only slot | §21.3 |
| SIM-16 | Psyching out = whole-round action resolved at end of round | §21.4 |
| SIM-17 | Suicide attack offered whenever a hero is taken out of the fight (any cause except death) | §21.5 – kept deliberately (2026-11-01), although the text ties it to total KP near or at zero (HH 910–912) |
| NOTE | The skill "Bära rustning" (wear armour) appears in eastern profession skill lists but is never described | Ignored |
| OCR-10 | "Om en magikers PSY-poäng sjunker ner till dör han" `[III 226]` – the number is missing | Read as **below 0**: spending down to 0 is safe, only a suicide spell goes below (§22.2) |
| OCR-11 | Spell names garbled in III: "BUKT" = BLIXT, "KALLA ELÄNDEN" = KALLA HANDEN, FROST range "Sx10 minuter" = S×10 squares | Corrected from the MH spell register `[MH 5980]` |
| SIM-18 | Casting over several actions (§22.2) | A counter that may span rounds; the target is chosen with the releasing action; a ready spell can be held (Wait) |
| SIM-19 | Using an action for anything else while casting | Gives the spell up like a broken concentration: 1 PSY. Wait and defensive stance keep it |
| SIM-20 | Which items count as iron | Armour: brigandine and every chain/ring/scale/metal-lamellar/plate material, metal helmets. Items: everything except wooden staves, clubs, the training sword, bows and slings. Studded leather and bone lamellar don't count |
| SIM-21 | Armour against total-KP spells (ELD, FROST) | The torso (chest) armour absorbs |
| SIM-22 | Staff PSY-källa | Spent before the caster's own PSY |
| SIM-23 | Hero suicide attack (§21.5) vs spells | Spell damage still hurts during a last stand |
| SIM-24 | ELDKLOT "1T6 brännskador under 1T3 SR", INRE ELD | 1T6 KP and 1T6 SP at the end of each following round, to total KP/SP, no armour |
| SIM-25 | EXPLOSION blinds "unless they protect themselves" | Everyone but the caster: −15 CL (darkness `[II 1350]`) next round |
| SIM-26 | Magic resistance: "the caster's PSY after paying" vs "the target's PSY" | Both use current PSY points |
| SIM-27 | The rules don't say which way a fighter faces | A fighter faces the one it last attacked or shot at; after moving it turns to the nearest enemy within 3 squares (else the way it moved); parrying doesn't turn it. Everyone starts facing the nearest enemy. Front = within 67.5° of the facing (the three squares ahead), behind = beyond 112.5° (the three at the back), side = in between. Melee only (not thrown or shot) |
| SIM-28 | When is a defender "unaware" of an attacker from behind? | Only a fighter marked *hidden* in the setup gets the Smyga check, and only while it is still hidden. It stops being hidden – for the rest of the fight, towards everyone – the moment it attacks (after that first Smyga check), shoots, throws, casts a spell or is attacked. Anyone else attacking from behind gets +7 but the defender may parry |
| SIM-27 | SKÖLD (quick, personal) as a parry | Prepared with 1 action and then held, or instant with S > 30; the casting roll is the parry. A successful shield stops any blow except a perfect attack |
| SIM-28 | Aimed spells (KLIPPBLOCK, ISKLOT, KLIPPSVÄRM, VINDSTÖT) | The caster picks any location with no aim penalty – the books give none |
| SIM-29 | KVÄVA and DRÄNKA in a duel | The victim is out of the fight (helpless). KVÄVA's concentration isn't tracked afterwards |
| SIM-30 | Parrying spells | Damage spells can't be parried or dodged; only SKÖLD and VIRVELSKÖLD defend |
| SIM-31 | FLAMMANDE HAND "on the blows" | Adds to every melee blow (staff or fist) |
| SIM-32 | Misfire results lasting minutes or days | Unconscious, paralysed, mute or memory loss count for the rest of the fight |

---

## 21. Heroes – Hjältarnas Handbok (HH)

The book adds no new professions; heroes keep their profession and gain **hero status**, **hero points (HP)**,
**hero abilities** and FV above 20 (start max 21–31 depending on age and hero type, `[HH 193–209]`).

### 21.1 Very high skill values `[HH 561–577]`
- **Perfect:** FV 21–40 – a 1 is always perfect; a 2 is perfect if a second roll is ≤ FV − 20. FV 41–60 – 1–2 always perfect;
  a 3 is perfect if the second roll is ≤ FV − 40, and so on.
- **Fumble:** after a 20, roll again. ⚠️ OCR-9: the text says a fumble happens if the second roll is "lägre än FV/2", and that 16–20
  always fumbles. Read literally, "lower than" would make high-FV heroes fumble on almost every 20, contradicting "att fumla blir svårare".
  🔧 **Used:** fumble if the second roll is **above FV/2, and always on 16–20**. Rules option: the basic rule (only two 20s).
- B-FV scale extended: 20–24 B6, 25–28 B7, 29–34 B8, 35–40 B9, 41+ B10 (no combat effect).

### 21.2 Hero points – "Höja CL" `[HH 2972–2981]`
Before an important roll a hero may spend 1 HP: fumble → failure, failure → success, success → perfect; a perfect roll stays
perfect and the HP is refunded. 🔧 SIM-14: offered on attack and parry rolls as a checkbox – declared with the action, applied to the result.

### 21.3 Heroes in combat `[HH 796–864]`
- **Extra actions:** FV 21+ in a weapon skill gives **+1 action** per round, FV 41+ another, etc. These extra actions may **only be used
  for actions with that weapon** (attacks and parries). The KH limits (max 6 actions, max 2 per opportunity) still apply. 🔧 SIM-15: the
  extra slot is placed like any other extra action and shown as a diamond; the held weapon with the highest FV counts.
- **Special manoeuvres** (instead of a normal attack):

| Manoeuvre | FV | Effect |
| :--- | :-: | :--- |
| Dubbelhugg (double strike) | 21+ | Two attacks in one action against the same opponent, **each with CL from FV/2**. Once per round |
| Trippelhugg (triple strike) | 31+ | Three attacks, each from **FV/3**. 🔧 Once per round, shared with Dubbelhugg |
| Blixtrande attack (lightning attack) | 24+ | −10 CL, only with a drawn weapon and **before any other attack between the two**; if it succeeds the opponent's parry is reduced by the attacker's differensvärde |
| Bryta vapen (break weapon) | 21+ | −6 CL; on success STY + (FV − 6) vs the weapon's BV + the wielder's FV on the resistance table – success breaks it. Needs weapon breakers, or hacks through a **wooden shaft** (spears, polearms, axes). Magic weapons can't be broken. 🔧 Offered with swords/axes against shafted weapons; no parry |
| Kasta svärd (throw sword) | 21+ | Throw the sword up to 3 squares, −6 CL, normal damage. 🔧 Random location, parryable like a thrown weapon; the sword is gone |
| Smärtstöt (heroic pain strike) | 23+ | −7 CL; a hit forces a **hard FYS roll** or the target falls helpless this round and the next. (Differs from the KH weapon technique of the same name, §12) |

- **Higher-FV skill notes:** Dra vapen FV 21+ counts as the hero ability Snabbdragning `[HH 696]`; Avväpna FV 21+: a perfect disarm catches
  the weapon `[HH 672]` (disarm itself is not implemented yet).

### 21.4 Psyching out the opponent `[HH 866–902]`
The hero spends **at least one whole round** psyching; the opponent then rolls PSY:

| Hero status | PSY roll | On failure |
| :--- | :--- | :--- |
| 1 Novice | Easy (SG 5) | −2 CL for the whole fight |
| 2 Experienced | Normal (SG 10) | −3 CL |
| 3 Veteran | Hard (SG 15) | −4 CL |
| 4 Celebrated | Hard (SG 15) | −5 CL; failing by more than 5 → −7; succeeding exactly → still −1 |
| 5 Legendary | Very hard (SG 20) | −7 CL; succeeding exactly → still −3 |

A fumbled PSY roll: the opponent **surrenders or flees**. Two heroes: the **difference** in status counts. A dark hero counts as one step
higher. 🔧 SIM-16: a whole-round action (no other actions), resolved at the end of the round against every enemy not yet psyched by that
hero; the hero ability *Orädd* (Fearless) is immune.

### 21.5 Suicide attack `[HH 904–917]`
When a hero's KP approach or reach zero, the hero may rise and fight at **full physical strength, original KP and normal FV for FYS/2
rounds**, ignoring all damage except from magic weapons and **perfect hits**; when the time is up the hero collapses and **dies**.
🔧 SIM-17 (kept deliberately, 2026-11-01): offered once per fight whenever a hero is taken out of the fight – also after falling from pain, a failed PSY roll or a critical – but not if already dead or after fleeing. The text ties it to total KP "närmar sig noll, eller kanske rent av redan är nere på noll" and lets the hero choose it while still standing; neither restriction is applied; KP and SP are
restored, wound penalties cleared (critically injured limbs stay ruined); a perfect hit that drops the hero again kills.

### 21.6 Hero abilities used in combat `[HH 279–495, 2681–2810]`

| Ability | Effect | 🔧 Implementation |
| :--- | :--- | :--- |
| Järnnäve (Iron fist) | Punches and kicks always do maximum damage incl. SB | as written |
| Snabbdragning (Quick draw) | Drawing a weapon costs no action; wins initiative in the round he draws | switching loadout is free; the initiative part is not modelled |
| Kraftslag (Power strike) | After a hit: spend 1T6 PSY for maximum damage incl. SB, 4× per day | prompt after each hit while PSY and uses remain |
| Snabbslående (Quick striker) | Always wins initiative | as written |
| Projektilparering (Projectile parry) | Parry thrown and shot weapons with an edged weapon, shield or staff (must see the shot) | offered against every missile |
| Stålsättning (Steeling) | Takes damage like a berserker, PSY roll instead of skill roll | SIM-13: no wound/pain penalties; when a location reaches 0 a PSY roll (once per location) lets the hero ignore it. Head, total KP/SP and criticals still apply |
| Vapenmästare (Weapon master) | +5 CL with all weapons | attacks and parries with weapons |
| Vilddjuret (Wild beast) | After anyone has taken 1 KP: SB +1T6, CL +3, +1 action | from the moment blood is drawn (the action from the next round) |
| Gudarnas gunstling (Favoured by the gods) | When KP reach 0: 25–50% chance the gods restore all KP | rules option, default 25% |
| Orädd (Fearless) | Only magical fear works | immune to psyching out |
| Archetype "Den ljusskygge hjälten" `[HH 1279–1281]` | +5 on all initiative rolls | ability *heroicReflexes* |

Not used in a duel: Empati, Onda ögat, Djurherre, Telepati, Gott läkekött, Magisk talang, Okänslig för eld, Sjätte sinne, Besatt,
Magisk immunitet, Osårbarhet (no magic weapons exist in the simulator), and the dark abilities Ormögon, Demontunga, Mörkersyn, Bestens hand,
Mörkerblixt, Livsutsugning, Mörkerpakt.


---

## 22. Magic – basic rules + Magikerns Handbok (MH)

### 22.1 Who can cast `[III 9–130, 505–520, MH 1087–1183]`
- Spells are skills with a **skicklighetsvärde (S)**, rolled 1T20 ≤ CL like any skill (perfect/fumble as §3.2, hero FV > 20 rules §21.1).
  Each spell belongs to a **school**; the FV in the school is the **highest effect grade (E)** the caster may use. General spells count as
  the caster's best school.
- **Iron:** no casting while wearing iron armour or in contact with iron. Carrying up to 0.5 kg of iron (not touching it) is allowed.
  🔧 SIM-20 lists what counts as iron – wizards fight with wooden staves.
- Memory: at most (INT + PSY)/4 spells memorised `[III 278]` (the presets respect it).

### 22.2 Casting time, CL and PSY `[III 138–245, MH 1890–1907]`
- **Actions (KH):** a normal spell takes **4 actions** (2 to prepare, 2 to cast), a quick (K) spell **2** (1 + 1). With **S above 30** a
  normal spell counts as quick and a quick spell takes **1 action**. (Wild magic 1, scrolls 5, magic items 1 – not used.)
  🔧 SIM-18: the actions may span rounds; the spell is rolled and takes effect on the last one, when the target is chosen.
- **CL** = S − 2 per E above the first. 🔧 Wound/pain penalties for head, chest and abdomen and "everything" conditions apply (SIM-6).
- **PSY:** E is chosen before casting and costs 1 PSY per E. Failure: 1 PSY, no effect. Perfect: half (in the caster's favour, min 1).
  Fumble: the full cost and a roll on the misfire table (§22.7).
- **Suicide spell** `[III 225–245]`: in desperation a caster with PSY left may spend his remaining PSY plus half his normal PSY; CL is the
  **unmodified S** whatever E is. PSY below zero kills him (⚠️ OCR-10) – after the spell takes effect.
- **Staff** with a PSY-källa `[MH 2390]`: extra PSY points, spent first (🔧 SIM-22).

### 22.3 Magic resistance `[III 246–268]`
Spells that work on the target's mind must beat the target's PSY with the caster's PSY (after paying for the spell) on the resistance
table. Physical spells (F) always affect the target when the roll succeeds. 🔧 SIM-26: current PSY on both sides.

### 22.4 Concentration `[III 212–216]`
Being hurt while casting breaks the concentration: it counts as a failure (1 PSY, no effect). 🔧 Any KP or SP lost counts, including
bleeding and burning. SIM-19: spending an action on something else (attack, move, parry, another spell) gives the spell up the same way.

### 22.5 Spell damage in the detailed system `[MH 1905, III 1404–1470]`
Every spell does as many dice of **SP as of KP** (ELD E4 = 4T6 KP and 4T6 SP, rolled separately). Spells add no damage bonus.

| Spell | SV | K | F | Range | Damage / effect | Where |
| :--- | :-: | :-: | :-: | :--- | :--- | :--- |
| BLIXT (lightning) `[III 1404]` | 6 | ✔ | ✔ | S×10 sq | 1T6/E | total KP/SP, **armour gives no protection** |
| ELD (fire) `[III 1415]` | 6 | | ✔ | S×10 sq | 1T6/E | total KP/SP, armour absorbs (🔧 SIM-21 torso) |
| FROST `[III 1455]` | 6 | | ✔ | S×10 sq | 1T6/E | as ELD |
| ENERGISTRÅLE `[III 1442]` | 6 | | ✔ | S×10 sq | **1T3/E** in the detailed system | random location, armour |
| EXPLOSION `[III 2275]` | 11 | ✔ | ✔ | S×10 sq | 5/E within E m, −1 per square beyond – the caster too | total KP/SP, no armour; blinds (🔧 SIM-25) |
| VINDSTÖT (gust) `[MH 5686]` | 8 | | ✔ | S×10 sq | 1T6/E | aimed location (🔧 SIM-28), armour |
| ISKLOT (ice ball) `[MH 5872]` | 10 | | ✔ | S×10 m | 1T8/E | aimed – usually the head, armour |
| ELDKLOT (fireball) `[MH 5744]` | 12 | | ✔ | S×10 m | 1T8/E + 1T6 a round for 1T3 rounds (🔧 SIM-24) | random location, armour |
| KROSSANDE KLIPPBLOCK `[MH 5615]` | 12 | | ✔ | S×10 m | 1T10/E | aimed – usually the head, armour |
| ISMISSILER `[MH 5879]` | 14 | | ✔ | S×10 m | 1T8/E to all within E m | random locations, armour |
| FÖRFRYSA (freeze) `[MH 5886]` | 15 | | | S×10 m | 1T8/E, PSY resistance | total KP/SP, no armour |
| INRE ELD (inner fire) `[MH 5758]` | 16 | | | S×10 m | 1T6/E + 1T6 a round for 1T10 rounds, PSY resistance | total KP/SP, no armour |
| KLIPPSVÄRM (rock swarm) `[MH 5622]` | 16 | | ✔ | S×10 m | 1T10/E to all within E m | aimed, armour |

🔧 SIM-30: damage spells can't be parried or dodged.

### 22.6 Other combat spells

| Spell | SV | K | F | Effect | 🔧 Implementation |
| :--- | :-: | :-: | :-: | :--- | :--- |
| SKÖLD (shield) `[III 1370]` | 3 | ✔ | ✔ | Air hardens into a shield that parries one physical attack automatically; BV 4 +2/E | SIM-27: prepared (1 action) and held, released as the parry; instant with S > 30. Also against missiles |
| FLAMMANDE HAND `[III 1381]` | 4 | | ✔ | +1T3/E on blows for 1T3 minutes | SIM-31: KP and SP on every melee blow; 1 minute = 12 SR `[II 1145]` |
| KALLA HANDEN `[III 1391]` | 4 | ✔ | ✔ | Range S/2 squares. Hard FYS roll: failure – can do nothing more this SR; success – −4 CL this SR | as written |
| FÖRBANNA / FÖRTROLLA VAPEN `[III 1476–1500]` | 6 | | | −/+1 CL and damage per E on a weapon or shield for S minutes; they cancel grade for grade | targets the item, so no PSY resistance |
| KNÄCKA (shatter) `[III 1502]` | 6 | ✔ | ✔ | Range S×2 squares. BV −10, −2 more per extra E; bows and crossbows count as BV 10 | weapons and shields only (not armour); BV ≤ 0 breaks it |
| VIRVELSKÖLD `[III 1546]` | 8 | | ✔ | For S rounds each projectile must be beaten by E on the resistance table (arrow 4, bolt 6, sling stone 7, throwing knife 4, javelin and axe 5) | thrown swords count as 5 |
| KVÄVA / DRÄNKA `[MH 5714, 5820]` | 14 | | | PSY resistance; the victim can do nothing but suffocate/drown | SIM-29: out of the fight |

### 22.7 Misfires – Snedtändningstabellen `[III 556–570]`
Roll 1T20 + E:

| 1T20 + E | Result | 🔧 In the fight (SIM-32) |
| :-: | :--- | :--- |
| 1–5 | E halved (round up), still hits the target | as written |
| 6–11 | E KP (total) and unconscious 1T8 minutes | out – unconscious |
| 12–15 | A harmful spell hits the caster at full effect, no resistance; otherwise E KP, unconscious and blind | as written |
| 16–17 | Mute 1T8 days – no spells | can't cast for the rest of the fight |
| 18 | Paralysed 1T8 days | out – incapacitated |
| 19 | Brain damage: INT −1T4 and as many spells forgotten | the spells are forgotten |
| 20+ | Total memory loss 1T8 days | out – incapacitated |

### 22.8 Not implemented
Summoned creatures (FRAMMANA ELEMENTAR, STENJÄTTE, ELDDRAKE, ISORM, LEVIATHAN, STORMFÅGEL), body transformations (KROPP AV …),
battlefield-sized spells (JORDBÄVNING, ELDSTORM, ISSTORM, FLODVÅG, MUR AV ELD, GIFTMOLN, SÄNKA SKEPP), ASTRALVAPEN, ANTIMAGI/SKINGRA,
non-elemental schools (Animism, Mentalism and the MH schools), extra effect grades for range or duration, wild magic, improvised magic,
mini-magic, familiars, scrolls and magic items.
