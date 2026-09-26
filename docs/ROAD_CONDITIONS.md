# Game-added road conditions

This layer is an invented gameplay scenario, not a survey of present-day Bengaluru road damage. It does not change route vertices, road elevations, lake polygons, or dated observation records.

The moving traffic pool is 158: 105 same-direction and 53 opposing (25.4% above 126 after rounding). Initial row spacings are 28.8 m and 62.4 m, retaining approximately the previous population extent while increasing density by 25%. Safety gaps, twelve crossing slots, ten parked coaches and the four-voice NPC horn limit remain unchanged. A partially completed merge that becomes blocked at a bend can retreat smoothly toward its source lane after checking NPCs, crossing traffic, parked coaches and player clearance; this avoids permanently locking adjacent lanes.

## Placement

`src/game/roadConditions.ts` deterministically allocates 50% mildly rough, 20% severely damaged and 30% smooth centreline length. Twenty-metre records are ranked in seeded 100 m clusters; fractional end records preserve exact coverage. First 100 m is smooth. Severe areas exclude active junction conflict zones with 35 m buffers and elevation transitions with 25 m buffers on either carriageway.

There are 746 individually seeded potholes on the forward carriageway. Worn surface treatments also appear on the opposite carriageway at its own elevation. Each patch has stable identity, route station, lateral position, extent, severity and a game-added designation. The original road elevation and collision envelope remain intact; crater depth is a visual approximation.

Six shallow, partial-width water patches have centres at 1,510, 3,110, 4,950, 6,810, 8,130 and 9,770 m, with respective lengths of 30, 35, 40, 45, 50 and 55 m. They are ground-level, outside junction and ramp buffers and away from parked coach queues. Their irregular muddy banks remain within the carriageway; at least one lane stays dry. Water overlaps the underlying roughness allocation, rather than adding to it. These locations are not claims of real flooding.

The build exports `public/data/game-road-conditions.json` separately from survey evidence, with version 1, route ID, coverage, intervals, holes and water footprints.

## Driving and motion

Targets are 55 km/h on mild damage, 30 km/h on severe damage and 20 km/h through water. Above a target, progressive resistance slows the player at up to 3 m/s²; no instant velocity clamp occurs at entry. Braking and steering remain under player control. Overlapping restrictions use the lowest target rather than cumulative penalties. Same-direction and opposing NPCs anticipate roughness through normal braking; forward and merged junction vehicles also account for water.

Four wheel paths determine pothole and water contact. The same irregular outline supplies geometry and contact tests. Wheel paths are swept in steps of at most 0.2 m to avoid skipping narrow holes. A wheel can miss a hole even when it passes beneath the middle of the car.

Continuous suspension excitation depends on distance and speed, with 0.6-second damped responses to new pothole contacts. Surface-only vertical travel is limited to 0.01 m for mild damage and 0.04 m for severe bumps. Combined camera displacement/rotation respects existing collision limits. This never changes the player's collision body, road station, health, collision count or scoring.

Reduced motion suppresses surface camera/cockpit offsets. Pause freezes response and water animation. Restart, inspection jumps and looping clear transient contacts; surface records do not change. Stationary vibration settles. Damage to health still comes only from existing physical collision rules.

## Rendering and resource ownership

Road overlays and pothole rims are merged per material per 200 m scenery chunk. Two procedural textures and shared surface materials are reused across the route. Puddles belong to their centre chunk; surrounding preload/retention covers their complete extent. One fixed 32-instance wheel-spray pool supports at most eight nearby wet vehicles. Low graphics uses at most two and disables animated water ripples. It preserves the same surface physics.

The shared material owner disposes textures once when the world closes; chunks release only their own geometry. No image services, external artwork, new per-frame textures or per-lap asset allocations are introduced.

## Validation

`tests/road-conditions.test.ts` covers counts, safe initial population, exact coverage, geographic exclusions, puddle clearance, wheel hit/avoid/straddle behaviour, progressive slowdown without damage, speed targets, anticipation, motion limits, pause/reset/reduced motion, mesh orientation, three geometry sweeps and blocked-merge recovery with and without the player occupying the return lane. Existing traffic, junction, horn, collision and parked-coach regressions remain applicable. Browser measurements and full-loop results are recorded in `QUALITY.md` after validation.
