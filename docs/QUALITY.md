# Marathahalli route validation — 24 September 2026

## Automated checks

46 distinct checks pass: the full 44-check suite, the added v3-prefix/end-ramp geometry check, and the added separation/cooldown/zero-health check, with affected tests rerun after the final contact-retention adjustment. Production TypeScript/Vite build succeeds.

Three complete 11,395.262089 m simulated loops ran with live road and crossing traffic. The test driver brakes for both; it does not heal or teleport to pass. The original 1,000 m segment and every v3 centreline vertex remain unchanged. The new end is exactly 100 m along the route after the mapped northern underpass ramp. Road profiles have continuous ramp boundaries. The 126 road vehicles and 12 crossing slots remain fixed.

Collision checks cover the quarter-damage formula and 8 HP cap, sustained pushing, separation/re-impact, the two-second cooldown, zero-health ending, curbs, crossing vehicles, and score preservation. A new contact during cooldown still creates visual feedback. Camera offsets are independent of damage, decay over 0.6 seconds and become zero in reduced-motion mode; pause stops simulation time.

Horn tests cover safe acceleration, stopped queues, delayed gesture, per-vehicle cooldown and state reset. An 18-vehicle deterministic scenario checks every pair for overlaps through 1,800 frames of competing lane changes and horn requests. Junction regressions cover amber commitment, conflicting releases, clearance holds, queue discharge, elevation separation, merging and world-oriented crossing collisions. These finite tests do not prove that every possible traffic arrangement is collision-free.

Geometry tests check outward front/approach sign orientation, vehicle footprints excluding the cosmetic hand, shared template resources, brake lights, exact bus SVG orientation and complete truck advertisement fit. Artwork cold-load/failure/retry tests remain passing.

## Rendered checks

Inspected the right-window gesture, strong collision recoil, facade signs on the Marathahalli approach, Agara and Ibbalur mesh fences, and the underpass entrance, covered section and northern climb. A browser impact reduced health from 100 to 92; prolonged pushing retained 92. HUD and controls remain fixed during the camera response. Atlas selection exposes the new section and underpass profile with explicit uncertainty notes.

Three complete scenery-loading sweeps traversed every approximately 200 m chunk. After the template cache warmed up, every return to the start reported **1,294 geometries, 79 textures and five chunks**. Peaks were **2,164 geometries and 164 textures**. The prior version reported peaks of 2,074/170; the expanded route retains bounded resources. These are renderer counters, not a complete heap profile, and chunk creation can still cause brief hitches.

The ordinary 1,280 × 720 desktop view sampled **60 FPS / 17 ms P95**, with no captured browser errors. An 844 × 390 landscape viewport with reduced graphics sampled **60 FPS / 18 ms P95 frame interval** on this desktop host. A 390 × 844 portrait layout was also inspected. The map is vertical, heading-up, with a low-centred arrow and upright labels; the game-traffic legend, distance, pedals, horn and steering fit together. Viewport tests are not physical-phone measurements. Physical multi-touch and sustained 30 FPS on a midrange phone remain untested.

## Survey and visual limitations

The latest append has **six March 2026 observations at four locations**. One is explicitly unresolved because the panorama is on the road above the ORR underpass. The active route has 241 retained observations, 461 nominal checkpoints and 458 explicit side-section coverage records; **zero sections are certified survey complete**. Systematic forward/left/right Street View reconciliation at every 25 m and dated cockpit comparison at every 250 m remain incomplete.

The 5,452 building records include background footprints. They do not establish an exhaustive present-day inventory of small shops, guardhouses or temporary structures. Two new facades have matched photographic evidence; generic massing remains widespread. Names come only from mapped buildings or matched occupants. Nameplate placement is a game adaptation unless specifically observed; unknown names stay blank.

Marathahalli's directed through-road geometry and covered interval are map-derived. Its -5.5 m trough, ramps, clearances and retaining-wall dimensions are estimates. March imagery shows unfinished metro structures, not proof of September completion. Three additional signal nodes remain unresolved and inactive; upper-level signals do not stop the underpass route.

The lake polygons and islands/holes remain intact. Fence runs follow estimated road-facing bank offsets, with 1.8 m height, approximately 3 m posts and visible mesh. Actual park boundaries, gates, drains and all openings still need reconciliation; these fences must not be called a verified complete survey. Vegetation density, water level and some scenery props are estimates.

Widened three-lane carriageways and clearance-adjusted metro supports remain deliberate gameplay adaptations. Original coordinates and render offsets are separately exported. Sarjapur access is a disclosed player boundary. This earlier snapshot had no potholes. Game-added road damage was introduced later; there are no live traffic feeds or bundled Google imagery. Earlier survey gaps remain visible. This is a local playable preview, not a public deployment.


## Hoardings and traffic audio update

The expanded suite now has **52 passing checks**, including three complete route loops. The final placement and vehicle tests were rerun after the visibility adjustments. The production build passes. Existing route vertices, lengths, collision footprints and survey evidence remain unchanged.

All 14 hoarding approaches were reviewed. The seven complete 4:3 images repeat in order; the constrained Agara and original-kilometre sites were repositioned or raised for visibility. Existing columns may briefly occlude a poster while passing. These are explicitly game-added placements, not surveyed advertisements. Both bus sides show correctly oriented white BMTC text; truck rear walls are plain with their safety details intact.

Three scenery sweeps returned to **1,297 geometries / 85 textures / five chunks** on every warmed-up return, with peaks of **2,167 / 170**. The previous update peaked at 2,164 / 164. The seven poster textures are reused through both sequences and all loops. No growing renderer resource counts were observed; this does not substitute for a total heap profile.

A running desktop view with all four NPC horn voices active sampled **60 FPS / 19 ms P95** on the same development host, compared with the prior 60 FPS / 17 ms sample. Browser inspection confirmed a fixed pool of four voices, two impatient followers, and zero active voices under mute or pause. Tests also validate fixed AudioNode allocation, red-queue exemptions, different road levels, preset variety, resets and audio-independent driving randomness. Horn presets are synthesized; no claim is made that they reproduce exact real BMTC horn recordings.

Reduced graphics at 844 × 390 sampled **60 FPS / 18 ms P95 with four active horn voices**, matching the previous viewport sample. The clean landscape and 390 × 844 portrait layouts retain reachable steering, horn and pedal controls. Quality was switched back to Auto after testing. These are desktop-host viewport checks, not physical-phone performance, touch or speaker measurements.


### Left-verge hoarding revision — 24 September 2026

All 14 boards moved to the left, with column centres 6.75 m beyond the drivable left edge. Reviewed each board from a cockpit view 100 m before it at the default 1280 × 720 viewport: all fourteen posters visible. Checked frame clearance, original 4:3 image proportions, fixed stations and repeated sequence. Six targeted hoarding/horn tests and production build pass. This placement-only revision does not change traffic, audio or shared resource allocation; no new physical-phone measurement was made.

### Parked tourist coaches — 24 September 2026

Added 3 / 3 / 4 stationary VOLVO tourist coaches at Ibbalur Lake, Bellandur and 500 m before the Marathahalli descent. Reviewed all three approaching and passing cockpit views. Coaches occupy only the left lane; moving BMTC buses retain their separate branding.

All 60 tests pass, including three full connected-route simulation loops (about 82 seconds for the loop test), mixed-vehicle merging, fast adjacent traffic, collision persistence, horn blockers, spawn clearance and shared template disposal. The initial long-run check exposed a packed-source-lane merge deadlock before Sarjapur. Updated reservations allow vehicles to vacate a tightly queued lane while protecting the destination lane; a dedicated packed-queue regression now passes. Production build and whitespace checks pass.

Three scenery sweeps completed all 174 samples. After initial template warm-up, each return to the start held at 1,308 geometries, 88 textures and five chunks; sweep peaks were 2,178 geometries and 173 textures. Coach geometry and textures are shared across ten fixed clones and are unaffected by chunk release.

Observed 60 FPS / 17 ms P95 frame time at 1280 × 720 with Auto graphics and live traffic. The 844 × 390 landscape viewport with Low graphics measured 60 FPS / 18 ms P95; pedals and steering buttons fit and the passing lane remained visible. These are desktop-browser viewport measurements, not physical-phone performance or multitouch tests. Temporary viewport overrides and the Low setting were restored after review.


### End-popup CTA and gameplay analytics — 24 September 2026

The end screen now has a secondary Checkout antimattr link immediately below Give it another go. Verified its exact UTM URL, diagonal-arrow icon, end-only display, and desktop/390 × 844 portrait/844 × 390 landscape layout. The popup scrolls when needed.

Nineteen targeted checks pass, including five analytics lifecycle/accounting tests and the existing impact/horn regressions. Covered idempotent starts and finishes, unique restart IDs, per-lap milestones, cumulative versus additive metric accounting, moving/waiting/paused time, hidden-tab exclusion, bfcache resume, beacon-bound exits, collision-contact deduplication, route-point reach, frozen final duration and capture-failure isolation. TypeScript and production build pass; no browser console errors observed in the inspected popup. No driving simulation changes were required. SDK instrumentation is wired to the existing project configuration; ingestion and saved dashboards inside the PostHog project have not been verified.

## Damaged roads and 25% traffic increase — 25 September 2026

The moving pool is now 158 (105 forward / 53 opposing), with 25% denser initial spacing. Twelve crossing slots and ten parked coaches remain unchanged. The condition export measures exactly 50% mild, 20% severe and 30% smooth centreline coverage, with 746 individual forward-carriageway potholes and six shallow water patches. These are explicitly game-added conditions, not survey evidence. Map notes link the separate `game-road-conditions.json` export.

Validation: the full regression suite passed all 75 checks at the merge-recovery revision. Final focused surface/merge validation passed 11 checks, including the subsequently added player-clearance scenario. The final code independently completed three full connected-route simulation loops, retaining health, distance and fixed pool counts. Production build and whitespace checks passed. Vite still reports the pre-existing large-bundle advisory for the map/Three.js application; this is not a build failure.

The increased density and new slowdown timing exposed a pre-existing partial-merge deadlock at a bend around 2,183 m on lap two. Two adjacent cars could both fail forward movement validation while one straddled lanes. A blocked merging car now retreats gradually toward its source lane only when obstacle checks and player clearance permit. Captured-scenario regressions verify eventual discharge, no NPC overlap, no sideways teleport and waiting for a player occupying the return lane. Braking/signal and parked-coach tests continue to pass.

Road checks cover exact contiguous coverage, the smooth first 100 m, both-carriageway ramp exclusions, junction buffers, complete water/mud containment, dry passing lanes, wheel hits/misses/straddling, high-speed swept contacts, progressive resistance, braking/steering, unchanged health/collision/overtake counters, speed-sensitive motion limits, stationary settling, pause, restart, loop reset and reduced-motion suppression. Road-surface mesh normals and finite coordinates pass three generated-geometry sweeps.

Browser review inspected severe damage near 330 m and the first water patch near 1,500 m, followed by live driving through severe/mild/wet transitions. Water, broken rims, cracks and repairs appear at road level. Settings were tested with reduced motion and Low graphics; normal preferences were restored. HUD and touch controls remain independent of the camera response. Portrait 390 × 844 and landscape 844 × 390 layouts were checked. No browser errors were captured.

Three rendered scenery sweeps completed all 174 stations. After initial warm-up, each return to the start retained **1,298 geometries / 88 textures / 5 chunks**, with a route-wide peak of **2,196 geometries / 175 textures**. Counts remained bounded. Forced inspection jumps can produce loading spikes (one sample: 49 FPS / 67 ms P95); these teleport sweeps are not ordinary driving measurements.

Normal live driving sampled **60 FPS / 17 ms P95 at 1,280 × 720 with Auto graphics**, and **60 FPS / 17 ms P95 at 844 × 390 with Low graphics**. Earlier recorded checks were 60 FPS / 17 ms desktop and 60 FPS / 18 ms landscape. These are indicative desktop-host viewport comparisons at different route moments, not a controlled physical-device benchmark. Sustained midrange-phone performance, physical multitouch and phone speakers remain untested.

## Street-life update — 25 September 2026

- Added occasional safe voluntary lane changes for autos, bikes and buses in both directions, deterministic footpath dirt/snack packets, and reddish stains on actual flyover-support and underpass-wall faces.
- Full regression: 80 checks passed, including three complete route loops with live traffic (loop check ~119 seconds). Two additional geometry/recycling tests passed afterward; final focused horn/traffic/dressing checks passed. Production build and whitespace checks pass; existing large-bundle warnings remain.
- Browser cockpit review: underpass stains visible at 10,880 m. Busy traffic preview showed ten forward-frame candidates and up to four active horn voices. Mute and pause reduced audible voices to zero. All five decorative materials are shared; three automated geometry sweeps produced identical mesh counts and finite geometry.
- Three rendered scenery sweeps completed all 174 stations. Warm returns to start remained at 1,527 geometries / 95 textures / five chunks across all three passes; peak 2,237 geometries / 180 textures. The first cold return was 1,436 / 79 before all reused vehicle templates had warmed. No increasing retained resources after warm-up.
- 1280 × 720 desktop busy-traffic viewport: 60 FPS, 17 ms p95. 844 × 390 landscape viewport on the same desktop: 60 FPS, 18 ms p95. These are short built-in diagnostic samples, not physical-phone measurements or guarantees across hardware. Forced scenery jumps briefly reduced the rolling FPS sample to 49. Physical-phone performance, physical multitouch and loudspeaker sound quality were not tested.

## Aggressive auto and bike weaving — 26 September 2026

Autos and bikes now select continuous gaps on both carriageways, including between queues, with seeded temperament, speed-dependent clearance, three-second path checks and final swept body validation. Cars, buses and trucks remain lane-based. Rendering and collision geometry share the bounded turn angle; bikes lean slightly. A development-only **Preview weaving traffic** button sets up competing small vehicles beside the Ibbalur coach queue.

The queue regressions include two captured turning-clearance deadlocks: a false initial reservation against a beside-bike, and a projected front gap that stopped an auto despite a safe diagonal exit. Existing collision, surface, junction, horns and fixed-pool rules remain active. See `STREET_LIFE.md` for behaviour and test details.

Browser samples at 1280 × 720 and an actual 546 × 837 portrait canvas reported approximately 60 FPS / 17 ms p95 during the mixed weaving scenario. Three rendered scenery sweeps completed all 174 stations. After first-use template warm-up, returns to the start remained at 1,493 geometries, 93 textures and five chunks; peaks were 2,237 geometries and 180 textures. The NPC audio pool stayed at four voices. The intentionally rapid scenery sweep is a resource-lifetime stress test, not a frame-rate benchmark. Physical-phone performance and multitouch remain untested.

Final verification: all 94 regression checks passed, including three full connected-route loops with live traffic and the 12 dedicated weaving checks. The final production build and whitespace checks passed. The existing Vite large-bundle advisory remains; no new assets or audio resources were added for weaving.

## Recorded horns — 26 September 2026

Six CC0 recordings replace the normal synthesized horn playback, shared across 15 NPC variants and the player horn. The processed mono WAV pack is 247,226 bytes. Source links, authors, license checks, processing and checksums are in `public/audio/horns/`. Auto variants are adapted electric-car recordings, not authenticated rickshaw recordings.

All 98 regression checks passed, including three connected-route loops. Four new audio tests check asset integrity/loop bounds, fetch/decode caching, stable voice assignment, four NPC sources plus one player source, pause/mute/reset/disposal, failed-loading fallback and retry, and disposal during loading. Production build and whitespace checks passed; the existing large-bundle advisory remains. Browser inspection confirmed six decoded recordings with ready status, a four-channel NPC pool and zero active voices while paused/muted. The desktop preview reported approximately 60 FPS during this check. Physical-phone playback, output-device loudness and subjective listening quality have not been certified.
