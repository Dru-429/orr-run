# Silk Board route validation — 24 September 2026

## Automated checks

37 checks pass (the full suite plus the corrected roadside-density check and its targeted rerun). Production TypeScript/Vite build succeeds. Tests cover route measurement, preserved original geometry and IDs, both route seams, road-height continuity, minimum lane clearance around mapped shafts, barriers, brake/steering input, pause/restart, scoring and collision damage.

Junction tests cover mutually exclusive movement releases; occupied all-red holds; elevation separation; amber commitment; red queues and green discharge; fixed 12-vehicle crossing identities; world-oriented crossing collisions; pause/reset; right-side turn paths and the adjacent-lane Agara merge regression. Three full 9,748.223829 m simulated loops run with live traffic and a test driver that brakes for both road and merged vehicles. No health reset or teleport is used to pass this run. The 126 road vehicles and 12 crossing slots remain fixed.

## Browser checks

Checked the start, HSR junction, HSR flyover crest, Agara approach, Sarjapur/route inspection controls, atlas infrastructure inventory, Agara footprint detail and archived hospital approach. The preserved kilometre remains independently selectable. Development rendering sweeps traverse every approximately 200 m chunk three times; these are scenery-loading sweeps, separate from the full physics loops.

The three-sweep capture returned to 1,177 geometries and 55 textures at the same start position on passes two and three, with five nearby chunks there; the route peak was 2,048 geometries and 61 textures. Initial 1,083/45 counts rose only while the finite vehicle/template and artwork cache warmed up. The rapid sweep sampled 43 FPS during synchronous chunk replacement; ordinary stationary views recovered to 60 FPS. Chunk-transition hitches still need profiling on slower devices. These are renderer resource counts, not a heap profiler. Large water meshes are persistent and not duplicated by chunks.

At the desktop host’s browser, observed stable samples were 60 FPS with a 17 ms 95th-percentile frame interval. Reduced graphics at a real 844 × 390 CSS-pixel viewport also sampled 60 FPS / 17 ms on this same desktop host. A 390 × 844 portrait layout was checked. Steering, brake, accelerator and horn remain available together in the landscape layout. These are desktop viewport measurements, not physical-phone performance or a guarantee for a typical laptop. Actual multi-touch on a phone and sustained midrange-phone 30 FPS remain untested.

## Survey and visual limitations

The new extension has only seven inspected views, including an unresolved start panorama displaced onto the opposing carriageway. The forward/left/right 25 m survey is incomplete. Every 50 m side-section has an explicit gap record; none is certified complete. A full dated cockpit comparison every 250 m and at every ramp/clearance transition remains outstanding.

HSR and Agara crest photos, the three signal approaches and Agara’s screened lake edge have been compared at the architectural/massing level. Generic facades are still widespread. Building footprints are not proof of an exhaustive inventory of present-day guardhouses, shops or temporary structures. Unknown signs remain blank.

Flyover heights, widths, clearances, supports, ramp lengths, cross-street movements and signal cycles are estimates. Opposing road offsets are simplified around distinct map-derived profiles. Service-road intervals are mapped, widths estimated. The Silk Board interchange and metro completion stages need more visual reconciliation. Signals under flyovers do not control the deck; unresolved mapped heads are not activated. The 2022 police junction list does not establish current signals.

Agara’s full polygon and island are retained independently of Ibbalur. Shoreline visibility is partly screened by trees; exact planting, bank/path/fence dimensions and water levels are not measured. No lake geometry has been moved to make it visible. Sarjapur player access is a disclosed game boundary; the hospital remains on the right. No potholes.

The game is a local playable prototype, not publicly deployed. Public hosting and physical-device testing are not claimed.


## Road clearance and navigation feedback — 24 September 2026

The playable carriageway is now 13.8 m wide with three 4.6 m lanes. The construction interval still restricts its right edge, leaving approximately 12.95 m usable width. Traffic, road surfaces, lane markings, junction paths and player boundaries consume the same profiles. Vehicle sizes and collision dimensions are unchanged. This is an intentional gameplay adaptation, not a revised survey measurement.

Every mapped and estimated metro shaft uses a shared rendering clearance rule. Conflicting supports move into the protected median; outer supports clear the widened verges. Linked ORP decks use the adjusted positions. Raw surveyed coordinates remain unchanged, and the JSON export records survey and render offsets separately. The reported 1,048 m HSR viewpoint was checked visually with clear driving lanes; automated checks cover all shaft records and both carriageways. The centreline remains 9,748.223829 m and the original kilometre remains exactly 1,000 m.

The offline navigation widget uses bundled road, footprint and lake geometry, a blue route and a directional player arrow. It follows both distance and lateral movement. Browser driving advanced its position from 5,300 m to 5,433.4 m and updated arrow heading through the bend. No Google map tiles, live requests or imagery are bundled. Lake labels are limited to Agara and Ibbalur, avoiding minor drain names.

298 eligible named buildings/contained businesses have identification cards, with six nearby forward cards visible at once. Unknown structures remain unnamed, and actual facade signage is still limited to observed records. Ambient additions include 110 tree candidates and 81 pedestrian groups with occasional bins. Placement excludes mapped roads, building footprints and water, with deterministic chunk ownership. These props are not survey observations. Tree crowns use four clusters to keep the added vegetation inexpensive.

The revised driving simulation completed three full route loops. All existing vehicle branding checks still pass. Three separate rendered scenery sweeps returned to exactly 1,244 geometries / 78 textures / five chunks after warmup on every pass, with peaks of 2,074 geometries and 170 textures. No browser errors were captured. This tests renderer resource ownership, not total heap allocation.

Desktop at 1,440 × 900 and the 844 × 390 landscape viewport sampled 60 FPS / 17 ms P95 on the development host. Portrait 390 × 844 and landscape navigation/control placement were inspected. The map stays clear of steering and pedal buttons. Physical-phone performance and physical multitouch were not measured. Previous incomplete survey coverage and geographic/architectural uncertainties remain unchanged.
