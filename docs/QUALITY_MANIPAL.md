# Expanded route validation — 24 September 2026

## Geographic checks

- Extension: **3,787.6108871841584 m**; combined route: **4,787.610887184159 m**. These are horizontal distances in the original projection, not forced round numbers or 3D ramp lengths.
- The original centreline and endpoint remain verbatim in the final 1,000 m. Automated checks compare every preserved point, measured length, join position and elevation continuity.
- The start is on the public road at the hospital frontage. The selected path includes the turn onto ORR; private hospital driveways are excluded.
- The survey export contains the manifest, cumulative and local distances, shared cross-sections, source URLs, multipolygon outer rings and holes. The Ibbalur island test passes.
- 1,510 building footprints, three station models, 197 mapped supports and 74 separately labelled estimated portal supports. Modelled station way 1508372366 uses a construction envelope as a proxy silhouette, not a measured deck outline.

## Automated checks

The test suite covers acceleration/braking, pause/resume, simultaneous steering/braking inputs, damage and collision boundaries, lane restrictions, loop scoring, idle-player traffic replenishment, geometry/ID integrity, evidence links, geographic round-tripping and the preserved join.

The traffic soak completed **three full combined-route loops**, over 14.36 km of simulated travel, with a fixed pool of 126 vehicles. It checks progress without deadlock, score continuity and pool size. This is an automated simulation, not a claim of three human-driven or phone-rendered laps.

Adding the extension's endpoint observation exposed an old test that conflated two segment-local observations at the same join. The assertion now includes the segment ID, preserving both records rather than deleting evidence.

## Browser rendering and resources

Cockpit views were checked at the new 250 m milestones, around the hospital turn, flyovers, station areas, join, original-section milestones and endpoint. Comparison exposed and corrected a missing viaduct interval and an unsuitable bridge-height default. A short visual road continuation extends beyond the playable endpoint for the fade; it does not change route length or scoring.

Three repeated scene sweeps visited all approximately 200 m chunks and the endpoint. Settled return-to-start counters matched at **521 retained geometries, 104 textures and five chunks** in the tested build. The loading window retains at most seven chunks. These renderer counters are a bounded-resource check, not a full heap profiler or GPU-memory measurement. A subsequent endpoint-clearance/road-buffer fix changes only the final scenery chunk.

The current desktop browser sampled approximately **60 FPS** at inspected views. This is a sampled current-host result, not a benchmark guaranteeing 60 FPS on every laptop. Low graphics was exercised. Landscape **844 × 390** and portrait **390 × 844** layouts were inspected; pedals, steering, pause and settings remain reachable. Actual midrange-phone 30 FPS, physical simultaneous multitouch, mobile Safari and device audio still require hardware checks.

## Visual comparison notes

| Route station | Reference/scene correspondence | Remaining approximation |
|---|---|---|
| 0–250 m | Hospital frontage, public turn, parallel flyover, metro and park-side trees | Junction lanes, ramps, guardhouses, parapets and facade dimensions |
| 250–750 m | Ibbalur shoreline/island, Ferns Galaxy, Yamaha, AGR Plaza, IndiQube, petrol canopy and footbridge | Missing small-stall footprints, facade detail, lake fence and individual trees |
| 1,000 m | Commercial street and metro corridor | Most individual storefront identities and dimensions |
| 1,250–1,750 m | Bellandur flyover, Soul Space Spirit curved frontage and station approach | Portal support positions and deck heights; exact roof and entrance structures |
| 2,000 m | Covered pedestrian crossing, bus-stop corridor and campus frontage | Stair geometry, shelter details and construction extent |
| 2,250–2,500 m | Second raised road, bend and commercial/campus buildings | Ramp grades, blue-glazed facades and individual signs |
| 2,750 m | Unfinished station, screened worksite and small-shop frontage | Construction-envelope proxy, cantilevers, stairs and equipment |
| 3,000–3,500 m | Metro corridor, campus blocks and service-road tree rows | Storefront matching; the 3,250 m right view is blocked by a bus |
| 3,750 m / join | Blue/white underpass walls, descending approach and continuous old road | Exact wall height, utilities and vegetation |
| Original section / endpoint | Preserved geographic arrangement, station and works | Existing facade, entrance, stage and clearance gaps remain |

## Survey completeness

**No section is certified complete.** There are 132 extension observations at 44 of 153 checkpoint entries, plus all 123 original observations. The extension has every 25 m checkpoint inspected through 750 m, then 250 m checkpoints and its exact endpoint; 109 sets remain uninspected. Missing panorama coordinates, service-road snaps and occlusions remain explicit. Mixed December 2025 and April 2026 images do not establish current September construction.

Known unresolved structures include the lake-side plant stall near 400 m, the blue-shutter hut near 525 m, several small shops beside the spa frontage, guardhouses, petrol-station service structures, tyre shops near 2,750 m and screened construction areas. Their observations are retained, but not all have independently reconciled footprint geometry. Do not describe this release as mapping every current roadside building accurately.

Full 25 m inspection, backward/intermediate views at remaining obstructions, facade/entrance reconciliation, exact restrictions and structural clearances, and physical-phone validation remain outstanding. The field atlas and generated coverage register expose those gaps. Previous original-kilometre research is retained in QUALITY_ORIGINAL_KILOMETRE.md as a historical record.
