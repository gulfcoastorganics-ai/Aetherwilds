# Aetherwilds V4.6 Depth & Occlusion Hardening

Build ID: `V4.6.0-depth-hardened`

V4.6 is the depth/readability follow-up to the V4.5 gameplay-hardening baseline. It leaves the V4.5 save schema, collision gates, battle flow, progression, capture locking, keyboard controls, and soft-lock protections intact while hardening the way characters integrate with the authored HD environment plates.

## V4.6 changes

- Dynamic world actors are now Y-sorted by their foot anchors. The player, starter companion, Kael, and Mira can correctly pass in front of or behind one another instead of the player always painting last.
- Added authored foreground occlusion using exact crops from the same scene plate. This creates true foreground layers without introducing mismatched replacement art or visible seams.
- Research Lodge: starter plinths and lower study furniture can occlude actors when approached from behind.
- Emberbrook: foreground roof/tree masses and the fountain now participate in depth; the contradictory baked wayfinder is re-labeled in-place with the actual topology.
- Verdant Route: tall grass now covers only the lower portion of the player/companion locally, rather than reading as a flat texture beneath them. Foreground conifers, cliff lips, and east-bank foliage create stronger depth breaks.
- Hollowstone Cave: central crystal/rock geometry and near cave walls can sit in front of actors when appropriate.
- Aether Ruins: the central dais and near stair/ruin masses create an actual foreground plane around the scanner objective.
- Major objective occluders use restrained partial opacity so the environment still reads as foreground without completely losing the player silhouette.
- Removed the always-visible Emberbrook topology strip introduced in V4.5; the corrected diegetic sign plus contextual edge cues are sufficient and leave more of the playfield unobstructed.
- Removed the obsolete standalone companion draw path after moving companion rendering into the actor depth sorter.
- Updated static asset cache-busting references to `4.6.0` while preserving the existing local save key for V4.4/V4.5 compatibility.

No new content or progression gates were added in this pass; it is intentionally a presentation/readability hardening layer over the existing vertical slice.
