# Aetherwilds V4.6 — Cloud Codex Canonical Handoff

This repository is being populated from the **actual canonical V4.6 game source**.

## Canonical identity
- Project: Aetherwilds
- Build: `V4.6.0-depth-hardened`
- GitHub: `https://github.com/gulfcoastorganics-ai/Aetherwilds.git`
- Intended Cloud Codex checkout: `/workspace/Aetherwilds`

## Expected source
Top-level runtime files: `index.html`, `styles.css`, `game.js`, `vercel.json`, `DEPLOY.txt`, `HARDENING_REPORT.md`, `LIVE_AUDIT_REPORT.md`, and `assets/`.

Expected runtime art: 22 WebP assets in `assets/`.

## Product baseline
Aetherwilds is a high-detail HD-2D / pixel-art monster-taming RPG. Preserve the dark-haired red-scarf protagonist; Pyrel, Mossprig, Ripplefin and Brambit; Research Lodge, Emberbrook, Verdant Route, Hollowstone Cave and Aether Ruins; navy/gold/cream UI; authored scene plates; collision, save/continue, battle keyboard flow, capture locking, staged progression, actor Y-depth sorting, and foreground occlusion.

## Important fixes that must not regress
- Correct horizontal protagonist facing.
- Lodge exit after starter selection.
- No duplicated baked battle HUD/creatures.
- No full-canvas `source-atop` white hit rectangle.
- Verdant Route → Aether Ruins transition reachable.
- Scene collision + sliding resolution.
- Autosave / Continue / safe-load behavior.
- Keyboard battle menus + Lumling switching.
- Capture double-spend prevention.
- Kael → Mira → Verdant Sigil sequence gating.
- Dialogue callbacks survive Escape.
- Missing/stalled asset boot resilience + runtime error boundary.
- V4.5 northern-seal/top-edge hardening, battle overlay cleanup, starter-first objective, persistent Mira, New Expedition overwrite protection.
- V4.6 actor foot-anchor Y sorting + authored foreground occlusion.

## Last recorded V4.6 regression floor
- Build boots as `V4.6.0-depth-hardened`.
- 22/22 runtime art assets present.
- Zero browser page errors / zero console errors in regression harness.
- Town/forest/cave collision checks passed.
- Northern seal blocks pre-Sigil and enters Ruins post-Sigil.
- Existing save payload restores scene/player position.
- Keyboard battle command → move → attack path works.
- Old rectangle hit-flash remains absent.
- Mira/player depth sorting, tall-grass occlusion, cave crystal foreground and Ruins dais foreground checks passed.

## Development rule
Inspect the actual source before changing it. Preserve the authored high-detail visual direction. Do not substitute programmer-art or stripped QA mockups. Do not touch ACL-Core or Crypto-Core. Do not deploy Vercel unless explicitly requested.
