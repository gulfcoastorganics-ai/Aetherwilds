# Aetherwilds — Codex Handoff

Canonical baseline: **V4.6.0-depth-hardened**  
Canonical branch: **main**  
Repository: **gulfcoastorganics-ai/Aetherwilds**

## Read first

Before changing the game, read these files in order:

1. `CODEX_HANDOFF.md`
2. `HARDENING_REPORT.md`
3. `LIVE_AUDIT_REPORT.md`
4. `SHA256SUMS.txt`
5. `game.js`
6. `index.html`
7. `styles.css`
8. `vercel.json`

The repository itself is now the source of truth. Inspect the actual implementation before making assumptions from this document.

## Product identity

Aetherwilds is an original-IP browser-based 2D monster-catching / creature-taming RPG. The presentation target is a polished modern indie JRPG with **high-detail HD-2D / pixel-art** presentation, cinematic lighting, layered world depth, authored environment plates, strong creature silhouettes, and ornate readable UI.

Do **not** regress the game to programmer art, primitive geometric stand-ins, low-detail QA mockups, or copied Pokémon assets.

### Visual anchors

- Protagonist: male; dark messy/tousled hair; red scarf; layered explorer/researcher jacket; boots; backpack and field gear; readable human anatomy.
- Professor Elara: silver/white hair, glasses, research coat.
- Kael: rival; dark/black hair with a red accent; red scarf; dark adventurer outfit.
- Warden Mira: Grove/Stone visual motifs.
- Pyrel: Ember/fire starter; orange/red, fox/salamander-like visual language.
- Mossprig: Grove starter; green woodland/plant creature.
- Ripplefin: Tide/water starter; blue aquatic creature.
- Brambit: current wild Grove-type runtime creature.
- UI: dark navy/indigo, gold trim, cream/light text, ornate but readable.

## Runtime structure

Design canvas: **1280 × 720**.

Current runtime scene IDs:

- `lodge` → Research Lodge
- `town` → Emberbrook
- `forest` → Verdant Route
- `cave` → Hollowstone Cave
- `ruins` → Aether Ruins

**Stonehollow appears in concept/reference material but is not a current V4.6 runtime scene. Do not fabricate Stonehollow functionality from concept art alone.**

Known quest identity: **A Flicker in the Grass**.

Current stable save key:

`aetherwilds.v44.save.1`

Do not casually change the save key or schema; V4.6 intentionally preserves V4.4/V4.5 browser-save compatibility.

## Hardened progression baseline

The current vertical-slice progression is approximately:

starter selection → leave Research Lodge → encounter/capture → Kael field trial → Warden Mira → Verdant Sigil → northern seal → Aether Ruins → ruins objective/chapter progression.

The opening objective must not instruct the player to capture before a starter has been selected.

## Controls / reliability baseline

World controls include WASD / arrow movement, Shift run, keyboard/pointer interaction, Escape menus/dialogue behavior, F2 collision debug, F3 safe-waypoint recovery, and manual saving from the supported menu flow.

Battle navigation supports keyboard command, move, and Lumling/party menus.

Existing reliability work includes autosave/checkpoints, Continue restoration, safe-load positioning, focus-loss held-key clearing, asset-load resilience, and a runtime error boundary.

## Hard regression gates

Do not reintroduce any of these historical defects:

- V4.1 horizontal protagonist facing/sprite-direction mismatch.
- V4.2 inability to leave Research Lodge after choosing a starter because clamp/transition thresholds contradicted each other.
- Duplicated battle HUD/creature rendering caused by baked battle art plus runtime rendering.
- Full-canvas `source-atop` hit flash that produced a large white rectangle.
- Unreachable Aether Ruins caused by incompatible player-Y clamp and transition threshold.
- Missing world collision or sticky diagonal corner movement.
- Battle actions firing in the wrong phase.
- Double-click capture races / duplicate capsule spending.
- Nonfunctional party/Lumling switching.
- Kael → Mira / Verdant Sigil progression sequence skipping.
- Dialogue completion callbacks being silently discarded by Escape.
- Stuck movement after browser focus/visibility changes.
- Blank permanent boot on missing/stalled image requests.
- Northern-seal/top-edge transition jitter and related V4.5 progression issues.
- Stale world overlays leaking into battle.
- Mira disappearing incorrectly after Verdant Sigil progression.
- New Expedition immediately destroying an existing save without overwrite protection.
- Flat actor layering that ignores foot-anchor depth.
- Tall grass / cave crystals / Ruins dais failing to act as local foreground occluders.

## V4.6 depth / occlusion baseline

V4.6 is intentionally a presentation/readability layer over the V4.5 gameplay baseline. It includes:

- actor Y sorting by foot anchor;
- player, companion, Kael, and Mira front/back ordering;
- authored foreground crops from the same scene plates;
- Research Lodge plinth/furniture foreground behavior;
- Emberbrook roof/tree/fountain depth;
- corrected diegetic Emberbrook wayfinding;
- Verdant Route lower-body tall-grass occlusion;
- foreground conifers/cliff/east-bank foliage;
- Hollowstone crystal/rock foreground behavior;
- Aether Ruins dais/stair/ruin foreground planes;
- restrained partial opacity for major occluders;
- removal of the redundant permanent Emberbrook compass strip;
- companion rendering integrated into the actor depth sorter.

## Last recorded validation floor

The checked-in `LIVE_AUDIT_REPORT.md` records the last V4.6 regression pass. It reported:

- build boot as `V4.6.0-depth-hardened`;
- zero browser page errors and zero console errors in its self-contained headless-Chromium QA harness;
- all 22 declared runtime art assets present;
- town / forest / cave collision checks passing;
- northern seal blocks pre-Sigil and enters Ruins post-Sigil;
- existing save payload restores scene/player position;
- keyboard battle command → move → attack flow working;
- old rectangular hit-flash absent;
- Mira/player front-back sorting correct;
- tall-grass, cave-crystal and Ruins-dais foreground checks passing.

Treat this as a historical regression floor, **not as proof of a fresh browser test after future changes**. Never claim browser validation unless you actually run it.

## Runtime asset contract

`game.js` declares **22 WebP runtime art assets** under `assets/`. `SHA256SUMS.txt` records the canonical checksums used during the GitHub import. Preserve them unless a deliberate visual asset change is part of the requested task.

## Development rules

Before editing:

- inspect `git status` and recent history;
- inspect the actual source rather than relying only on documentation;
- run `node --check game.js`;
- validate `vercel.json` if deployment configuration is touched;
- preserve current save compatibility unless migration is explicitly part of the task;
- prefer targeted changes over wholesale rewrites;
- preserve authored high-detail art direction;
- keep runtime art and HUD free of duplicate baked overlays;
- validate input, collision, transitions, battle phase flow, save/continue, progression and soft-lock risk after meaningful gameplay changes;
- capture real browser screenshots when making visual claims, where the environment permits it.

## Project boundaries

Do not touch **ACL-Core**, **Crypto-Core**, or any unrelated repository while working on Aetherwilds.

Historical Vercel project/alias information is documented in `DEPLOY.txt`, but **do not deploy production unless explicitly requested**.

## Next-task protocol

For a new development task, first provide a concise baseline audit from the repository: build ID, file structure, runtime asset count, gameplay/progression systems discovered, current regression protections, and any discrepancies between docs and source. Then make only the requested changes and report actual validation performed.
