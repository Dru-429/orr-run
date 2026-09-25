# Hoardings, fleet lettering and traffic horns

The game uses `public/hoardings/1.png` through `7.png` unchanged. Fourteen game-added hoardings repeat that sequence exactly twice, at 400 + 800 × index metres (index 0–13). Each face is 12 × 9 m, matching the 4:3 source images. These placements are advertising props, not survey observations, and appear separately in `public/data/game-hoardings.json`.

Stable placement records live in `src/data/hoardings.json`. All fourteen boards are on the driver's left. Their columns sit 6.75 m beyond the playable carriageway's left edge, with the full frame outside the driving lanes. Faces aim at the approaching left lane 120 m before the board. The lower edge starts at 6 m above ground (or 3 m above the nearby road surface), increasing only where needed to clear a facade. The former distant right-side sites and 24 m Agara mounting have been removed.

`scripts/place-hoardings.ts` checks the rendered carriageway/service-road envelopes, junctions, buildings and adjusted metro supports. Ground supports remain outside water and buildings; elevated panels can overhang a bank or low roof with clearance. Raw road centrelines that are not rendered do not push these game-added props into distant plots. Survey geometry, existing buildings and landscape are unchanged.

Seven shared poster textures are loaded before the start button becomes available. High graphics uploads 2048 × 1536 copies; low graphics uses 1024 × 768. The PNG originals remain unchanged. Resolution changes reuse texture identities, and scenery chunks share the same seven materials. Partial loading failures dispose successful partial loads and offer a retry. Textures are disposed once when the world closes.

Bus templates carry white BMTC lettering on both sides. Truck backs are plain, with lights, registration plates and bumpers retained. Historical antimattr bus/truck source assets remain on disk but are no longer loaded by the game. Roadside advertising remains the supplied artwork.

Fifteen Web Audio presets provide three horn variants for each of five families: cars/cabs, autos, motorcycles, buses and trucks. Frequencies, waveforms, filters, pulse patterns and modulation differ. These are synthesized sounds, not recordings of actual fleet horns. Distance and stereo position control what the driver hears. A fixed pool of four two-oscillator voices limits sound overlap; audio choices use independent deterministic hashes and do not consume driving randomness.

After the player remains below 1 km/h for two seconds, up to two same-lane followers within 25 m bumper distance repeatedly honk with short gaps. Normal nearby red-signal queues are exempt from this escalation. A subset of slow, closely queued traffic uses intermittent varied horns. Priority honks stop when the player moves or the follower no longer qualifies. Pause, mute and the end of a run silence the pool; looping, restart and recycling reset reaction state.

## Validation

The complete 52-test suite passes, including three full connected-route simulation loops. New checks cover poster order, 4:3 proportions, support and elevated-panel clearance, loading failure/retry, bus orientation, plain truck backs, horn timing, signal/height exemptions, variety, reset, fixed voice allocation and unchanged seeded traffic movement.

All 14 sites were reviewed in cockpit approaches; constrained or screened locations were adjusted and rechecked. Browser checks confirmed two active follower horns in a four-voice pool, with zero active voices while muted or paused. Additional viewport and scenery sweep measurements are recorded in `QUALITY.md`. Physical-phone audio, physical multitouch and phone performance have not been measured.


Left-verge revision: all 14 approach views were checked at 100 m before their stations. All posters are visible in the forward-left cockpit view. Six targeted hoarding/horn regression checks and the production build pass. The sequence, source artwork, spacing and shared texture lifecycle are unchanged.
