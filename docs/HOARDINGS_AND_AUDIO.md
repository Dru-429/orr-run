# Hoardings, fleet lettering and traffic horns

The game uses `public/hoardings/1.png` through `7.png` unchanged. Fourteen game-added hoardings repeat that sequence exactly twice, at 400 + 800 × index metres (index 0–13). Each face is 12 × 9 m, matching the 4:3 source images. These placements are advertising props, not survey observations, and appear separately in `public/data/game-hoardings.json`.

Stable placement records live in `src/data/hoardings.json`. All fourteen boards are on the driver's left. Their columns sit 6.75 m beyond the playable carriageway's left edge, with the full frame outside the driving lanes. Faces aim at the approaching left lane 120 m before the board. The lower edge starts at 6 m above ground (or 3 m above the nearby road surface), increasing only where needed to clear a facade. The former distant right-side sites and 24 m Agara mounting have been removed.

`scripts/place-hoardings.ts` checks the rendered carriageway/service-road envelopes, junctions, buildings and adjusted metro supports. Ground supports remain outside water and buildings; elevated panels can overhang a bank or low roof with clearance. Raw road centrelines that are not rendered do not push these game-added props into distant plots. Survey geometry, existing buildings and landscape are unchanged.

Seven shared poster textures are loaded before the start button becomes available. High graphics uploads 2048 × 1536 copies; low graphics uses 1024 × 768. The PNG originals remain unchanged. Resolution changes reuse texture identities, and scenery chunks share the same seven materials. Partial loading failures dispose successful partial loads and offer a retry. Textures are disposed once when the world closes.

Bus templates carry white BMTC lettering on both sides. Truck backs are plain, with lights, registration plates and bumpers retained. Historical antimattr bus/truck source assets remain on disk but are no longer loaded by the game. Roadside advertising remains the supplied artwork.

Fifteen recorded Web Audio variants provide three voices for each of five families: cars/cabs, autos, motorcycles, buses and trucks. Six CC0 recordings are bundled in `public/audio/horns/` (247,226 bytes total), with per-file credits and a provenance manifest. Autos use pitch-adapted electric-car recordings; these are not verified Bengaluru fleet sounds. The player horn also uses a recording. Distance controls attenuation and high-frequency loss; stereo position follows the vehicle. Event timing, priority, pulse patterns and independent deterministic audio choices are unchanged.

After the player remains below 1 km/h for two seconds, up to two same-lane followers within 25 m bumper distance repeatedly honk with short gaps. Normal nearby red-signal queues are exempt from this escalation. A subset of slow, closely queued traffic uses intermittent varied horns. Priority honks stop when the player moves or the follower no longer qualifies. Pause, mute and the end of a run silence the pool; looping, restart and recycling reset reaction state.

## Validation

The complete 52-test suite passes, including three full connected-route simulation loops. New checks cover poster order, 4:3 proportions, support and elevated-panel clearance, loading failure/retry, bus orientation, plain truck backs, horn timing, signal/height exemptions, variety, reset, fixed voice allocation and unchanged seeded traffic movement.

All 14 sites were reviewed in cockpit approaches; constrained or screened locations were adjusted and rechecked. Browser checks confirmed two active follower horns in a four-voice pool, with zero active voices while muted or paused. Additional viewport and scenery sweep measurements are recorded in `QUALITY.md`. Physical-phone audio, physical multitouch and phone performance have not been measured.


Left-verge revision: all 14 approach views were checked at 100 m before their stations. All posters are visible in the forward-left cockpit view. Six targeted hoarding/horn regression checks and the production build pass. The sequence, source artwork, spacing and shared texture lifecycle are unchanged.

Forward-frame traffic now also triggers frequent rotating horns when four or more nearby vehicles are in view; see [street-life notes](STREET_LIFE.md) for scheduling, safety and validation details.


## Recorded horn update — 26 September 2026

`hornSamples.ts` maps all 15 variants to shared buffers with modest playback-rate variation. Loading begins on a user start/resume gesture. Each of the six local PCM files is fetched and decoded once per audio context; successful buffers survive pause, restart and route loops. Failed files retain the previous synthesized fallback and retry at the next start/resume. A sound already playing stays with its chosen source until its event ends. The game never contacts the original sound websites.

The four NPC gain/filter/panner channels and one player channel are persistent. Web Audio buffer sources are single-use, so one is created per recorded honk, stopped and disconnected at its end; there is no accumulating source list. An active event retains its channel when another event expires. Sustained horns loop a crossfaded segment of the recording, keeping the original onset; gain envelopes give the short/double/triple patterns and release. A shared compressor controls overlapping horns. Mute, pause, looping and end-of-run stop the sources; disposal aborts pending loads and releases buffers and the context. Engine sound remains synthesized.

The six originals can be downloaded using the explicit links in `sources.json`, saved as `car.mp3`, `car2.mp3`, `compact.mp3`, `bike.mp3`, `bus.mp3`, and `truck.mp3` in a temporary directory, then processed with `python3 scripts/prepare-horns.py <directory>` (requires ffmpeg). The original downloads are not part of the bundle. License links and edits are recorded in [the credits](../public/audio/horns/CREDITS.md).

Validation for the recording update: all 98 regression checks passed (including three full driving loops), along with the production build. New tests cover source manifests and PCM loop bounds, shared decoding, event/channel lifetime, four NPC plus one player source limits, pause/mute/disposal, loading failure/retry and late-load cancellation. Browser inspection confirmed all six local samples decoded successfully. Physical-phone audio remains untested.
