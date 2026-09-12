# Aetherwilds V4.6 Live Chromium Regression Audit

The V4.6 production bundle was exercised in headless Chromium through the same self-contained in-page QA harness used for the prior hardening passes. The harness embeds the exact `game.js`, CSS, and all 22 runtime art assets. A small in-memory `localStorage` shim is used only because the harness runs on an opaque `about:blank` origin; the shipped save/load implementation is unchanged.

## Regression checks passed

- Build booted as `V4.6.0-depth-hardened` with zero browser page errors and zero console errors.
- All 22 declared runtime art assets are present and loaded by the harness.
- Town building/roof collision still blocks while the central walkable path remains open.
- Verdant Route water collision still blocks while the main route remains walkable.
- Hollowstone cave walls still block while the central lane remains walkable.
- Northern seal still blocks before the Verdant Sigil and transitions into Aether Ruins after the Sigil.
- Existing v1 save payload restores the expected scene and player position.
- Keyboard battle flow still transitions from command menu → move menu → busy attack state.
- Battle rendering remains free of the old full-rectangle hit-flash artifact.

## Visual depth checks

- Player behind Mira: Mira correctly renders in front based on foot-anchor depth.
- Player in front of Mira: player correctly renders in front after crossing Mira's Y anchor.
- Verdant Route tall grass hides the lower legs/companion locally without covering the whole playfield.
- Cave crystal and Ruins dais now behave as foreground geometry when the player walks behind them.
- Emberbrook's corrected in-world wayfinder no longer requires a second permanent HUD compass.

## Result

No regression blocker was found in the V4.5 gameplay-hardening systems. V4.6 is suitable as the next production candidate for the vertical slice.
