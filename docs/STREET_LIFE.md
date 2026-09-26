# Traffic movement and street dressing

Autos and motorcycles use continuous lateral targets instead of snapping between lane centres. A seeded temperament selects an off-centre preference. Bikes consider new openings every 1–2.5 seconds; autos every 2–4 seconds. They score free corridors, including spaces between queues, and keep a selected path while it remains usable. Buses retain their earlier 18–34-second discretionary lane changes. Cars, cabs and trucks retain lane-based driving; tourist coaches remain parked.

Bikes require at least 0.25 m side clearance and autos 0.4 m, with larger margins at speed. In queues, filtering targets at most 25 km/h and no more than 10 km/h above the slowest nearby queued vehicle. Speed reduces progressively using normal braking. Cars and buses anticipate sideways traffic approaching their corridor. Bikes can fit gaps that an auto must wait behind.

Three-second predicted paths reserve space against neighbouring traffic, existing manoeuvres, crossing vehicles and parked coaches. Prediction checks the swept space between samples; final movement also checks rotated world-space collision bodies. Close player cut-ins require 0.65 seconds of reaction room plus the relative stopping distance at 6 m/s². This permits braking-required cut-ins without intentionally forcing unavoidable impacts; the player still controls their own braking and steering.

Sideways movement is capped at 1.3 m/s for bikes and 0.85 m/s for autos, accelerated gradually, and tied to forward travel so stationary vehicles do not slide. Rendered heading and collision heading agree (12° bike / 8° auto caps), with a small cosmetic bike lean. Signals, same-level crossing traffic, boundaries and surface slowdown remain active. Seeded manoeuvre state resets on recycling, inspection, restart and loops. Crossing vehicles themselves keep their prescribed junction paths.

The development inspection controls include **Preview weaving traffic**, a repeatable coach/slow-queue scenario with competing bikes and autos. This is game-added traffic behaviour, not measured real-world driving.

The cockpit supplies nearby forward-frame vehicle IDs to the horn system roughly ten times per second at 60 FPS. The test uses the camera frustum, including look direction and viewport aspect ratio, within 140 metres. This is a visibility estimate, not a per-pixel occlusion query: a partly hidden vehicle can still count. Four or more vehicles (including autos, bikes, buses and trucks) trigger rotating 1–1.8-second horn events, with brief overlap between successive sources. Horn patterns retain their small internal gaps. Existing congestion/follower horns remain active, priority followers take precedence, and total voices never exceed four. Audio hashes do not consume the traffic generator. Mute, pause, restart, looping and recycling retain their existing behaviour.

`src/game/streetWear.ts` creates game-added dirt and small crumpled, generic CHIPS packets on the rendered service-road footpaths. Stable seeded placements avoid junction conflict areas and known building/water footprints. The right service road gains a matching one-metre pavement strip. These are cosmetic props with no collision bodies.

Reddish spit splashes and drips are attached to the actual side faces of road-flyover support columns and underpass retaining walls. Placement varies in size and height, with small surface offsets to prevent flickering. Road and metro geometry remain unchanged. These details do not imply that any specific surveyed location has litter or stains.

Five shared procedural textures/materials cover dirt, stains and three packet colours. Geometry is batched by material per scenery chunk and released with that chunk; textures are shared for the whole world and disposed on close. No downloaded photographs, new remote assets, or branded snack packaging are used.

## Earlier scenery verification — 25 September 2026

The 80-check full regression run passed, including three full connected-route loops with live traffic. Two additional checks then passed for three geometry sweeps and actor recycling; the final focused traffic/audio/dressing checks passed after the last adjustment. Tests cover voluntary changes by each requested vehicle type in both directions, blocked adjacent lanes, collision-free movement, the four-vehicle horn threshold, quiet off-screen/free-flow traffic, rotating horn sources, bounded voices, recycling, deterministic footpath placement and finite shared-material geometry.

Production build passes. Browser inspection confirmed wall stains, frequent active horns, a four-voice pool, and zero audible NPC voices on mute/pause. Desktop and mobile-viewport measurements are recorded in `QUALITY.md`. Physical-phone audio and performance remain untested.


## Aggressive weaving verification — 26 September 2026

Focused checks cover both carriageways, narrow gaps that admit a bike but reject an auto, filtering from a stop without sideways sliding, safe player braking distances, fast rear traffic, competing reservations, red lights, road-level/boundary handling, pause/recycling resets and deterministic trajectories. Mixed cars, bikes, autos, buses and trucks are checked against rotated collision bodies on bends, flyovers, the construction restriction and Marathahalli underpass. A captured tightly queued auto/bike case prevents false turning-clearance deadlocks from returning.

Autos leave approximately 3 m behind a stopped leader and 4 m before a parked coach; bikes use 2 m and 3 m respectively. This leaves forward room to begin a diagonal escape after an opening appears. Actual manoeuvres still require the full path and final body checks. The coach regression allows 45 seconds for filtering vehicles, reflecting the new 10 km/h speed difference cap alongside stationary buses. Other vehicles retain the earlier 28-second check.

The long-route test driver uses actual lateral vehicle envelopes rather than its former blanket 2.8 m exclusion, so a bike in a neighbouring gap does not falsely stop the test car. For diagnosing long simulation runs, set `ORR_SIM_TRACE` to a temporary JSON path; the loop test records progress and traffic state every 3,000 steps. This diagnostic is test-only and disabled by default.

Browser samples on this desktop: 1280 × 720 and a 546 × 837 portrait canvas both reported about 60 FPS with 17 ms p95 frame time during the weaving scenario. These are viewport measurements, not physical-phone benchmarks. No new geometry, textures or audio voices are allocated for manoeuvres; state lives in the existing fixed traffic pool.

The final rendered resource check completed three scenery sweeps (174 samples). Warm returns held at 1,493 geometries, 93 textures and five chunks, with peaks of 2,237 geometries and 180 textures. A second captured regression ensures that an auto can finish a safe diagonal escape with only 0.61 m of projected front clearance; movement still passes the full body checks and cannot slide at standstill.

Final verification: all 94 regression checks passed, including three full connected-route loops with live traffic and the 12 dedicated weaving checks. The final production build and whitespace checks passed. The existing Vite large-bundle advisory remains; no new assets or audio resources were added for weaving.
