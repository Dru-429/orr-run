# orr.run

**Just another Monday on Bengaluru’s Outer Ring Road.**

A first-person, browser-based driving game from **Silk Board to Marathahalli**. Sit behind the wheel, find a gap between autos and buses, and try to make it through ORR traffic with your car intact.

Built with **TypeScript, React, Vite and Three.js**. Runs on a static host with no game server, accounts or live map API. Keyboard and simultaneous touch controls are included; analytics is optional.

[Get started](#quick-start) · [Controls](#controls) · [How the map works](#mapping-and-survey-status) · [Contribute](#contributing) · [MIT license](LICENSE)

## The drive

The current route follows Silk Board → HSR → Agara → Ibbalur → Bellandur → the Adobe–Electra area → Marathahalli’s ORR underpass. It ends 100 metres beyond the mapped northern exit ramp.

| Route detail | Current value |
| --- | --- |
| Route ID | `silk-board-to-marathahalli-v4` |
| Displayed length | **11.40 km** |
| Measured horizontal centreline | **11,395.262089 m** |
| Preserved Adobe–Electra segment | **Exactly 1,000 m** |
| Direction and conditions | One prescribed route, daytime, hazy daylight |
| At the finish | Fade back to Silk Board with a new traffic pattern; distance and damage carry over |
| End of a run | Health reaches zero, or the player restarts |

Length is measured along the mapped horizontal centreline, not as a straight line between endpoints or a surveyed 3D road length. The old hospital approach is archived in the atlas.

### What’s in the game

- A right-hand-drive cockpit, speedometer, rear-view mirror, manual pedals and steering, and automatic gears.
- Mixed traffic: 158 moving vehicles (105 same-direction, 53 opposing), approximately 25% above the original pool, plus 12 crossing slots and ten parked coaches. Cars, cabs, autos, motorcycles, BMTC buses and trucks share the road.
- Game-added road conditions: 50% mildly rough, 20% severely damaged and 30% smooth, plus six shallow waterlogged patches. Wheel-path bumps, speed-sensitive suspension and progressive slowdown cause no health loss. Reduced motion keeps the view steady. See [road-condition notes](docs/ROAD_CONDITIONS.md).
- Aggressive gap-seeking autos and motorcycles that filter between queues, straddle markings and make braking-room-checked cut-ins in both directions. Buses retain occasional lane changes, alongside queues, signals and horn reactions. Blocked drivers can respond with a brief comic middle-finger gesture.
- Ten stationary VOLVO tourist coaches: three near Ibbalur Lake, three in Bellandur and four before Marathahalli. They block the left lane and create merging traffic.
- Game-added dirt and crumpled snack packets on service-road footpaths, plus reddish spit stains on flyover supports and underpass walls. These are procedural scenery, not surveyed conditions.
- Fifteen recorded NPC horn variants from six bundled CC0 recordings, with distance attenuation, stereo positioning and a four-voice limit. Stopping in the lane can provoke the drivers behind you. Four or more moving-traffic vehicles in the forward cockpit view trigger a frequent, rotating horn soundscape.
- Forgiving collision damage: one-quarter of the original damage, capped at eight health points per hit, with a two-second cooldown and sustained-contact protection. Camera recoil is independent of health loss.
- A vertical heading-up navigation map with colours derived from **simulated game traffic**, not live traffic data.
- Agara and Ibbalur lakes, directional flyovers, metro structures, construction, service roads, greenery and named buildings where names have supporting records.
- Fourteen left-side advertising hoardings, spaced every 800 m from 400 m to 10,800 m, repeating seven posters twice.
- Pause, restart, mute, reduced camera motion, automatic/high/low graphics, fullscreen, link sharing and a local best distance.
- A field atlas with inventories, source links, dated observations and explicit survey gaps.

This is a playable geographic approximation, **not a navigation tool or a completed survey of present-day ORR**. Roads are widened and some scenery is adjusted for playability. See [mapping status](#mapping-and-survey-status).

## Quick start

### Requirements

- Node.js **22 or newer** and npm.
- A browser with WebGL support and hardware acceleration enabled.
- Git to clone the repository.

Python 3 is only needed to run geographic import scripts; it is not needed to play, build or test the bundled game.

```sh
git clone https://github.com/Sirsho29/orr-run.git
cd orr-run
npm ci
npm run dev -- --host 127.0.0.1
```

Open **http://localhost:5173/** and select **Take the wheel** or press **Enter**. No `.env` file or analytics account is required for local play.

The checked-in map and assets are sufficient to run the game. You do not need to download map extracts or run the import scripts. The development server uses port 5173 with strict port checking; stop another process using that port or pass a different port.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev -- --host 127.0.0.1` | Start the local development server |
| `npm test` | Run the simulation, survey, geometry, traffic, artwork and analytics tests |
| `npx tsc -b` | Check TypeScript without regenerating survey exports |
| `npm run build` | Regenerate inventories, check TypeScript and build the static site |
| `npm run preview -- --host 127.0.0.1` | Preview the production build locally |
| `node --import tsx scripts/export-inventory.ts` | Regenerate public survey exports and inventory documentation |

`npm run build` automatically runs `prebuild`, which writes generated files under `public/data/` and the building, infrastructure and coverage inventories in `docs/`. Review resulting changes when editing survey data; edit source records rather than generated inventories.

`package.json` uses `private: true` to prevent accidental npm publication. The source code is still MIT-licensed.

## Controls

| Action | Desktop |
| --- | --- |
| Start | Enter or **Take the wheel** |
| Accelerate | W or ↑ |
| Brake | S or ↓ |
| Steer | A / D or ← / → |
| Horn | Space |
| Look left / right | Q / E, or drag the windshield |
| Pause / resume | Escape or the pause control |
| Restart, sound, graphics, camera motion | On-screen menus |

On phones and tablets, use the steering buttons, accelerator, brake and horn. Separate pointers allow steering and accelerating together. Landscape orientation gives the widest driving view.

Best distance is stored locally under `orr.best.silk-board-to-marathahalli-v4`; older route records are retained. Settings use `orr.settings`. These are browser-local saves, with no account or cross-device sync.

## Explore and debug

| URL | View |
| --- | --- |
| `/` | The game |
| `/?survey=1` | Field atlas, segment selection, inventories, observations and exports |
| `/?inspect=1` | Development-only station jumps, impact/gesture previews, end-screen preview and scenery sweeps |
| `/?vehicles=1` | Development-only vehicle turntable |

The atlas remains available in production. Inspection controls and the vehicle preview are development-only. Inspection gameplay is excluded from normal gameplay analytics, and SDK events from development/inspection are marked as test events.

## Architecture

Simulation is separate from React and Three.js rendering. Route records provide a common basis for roads, traffic, collision boundaries, navigation and survey views.

```text
src/
  App.tsx                    Menus, HUD, controls and footer
  main.tsx                   Game / atlas / development-preview entry points
  analytics/runAnalytics.ts  Run lifecycle, checkpoints and metric bookkeeping
  posthog.ts                 Optional PostHog integration
  data/
    route-manifest.json      Ordered segments, lengths and cumulative offsets
    map.json                 Bundled geographic features and centreline
    segments/                Preserved earlier routes and original kilometre
    junctions.json           Gameplay junction records
    signal-inventory.json    Signal evidence and unresolved entries
    hoardings.json           Game-added poster placements
  game/
    simulation.ts            Driving, traffic, damage and run state
    engine.ts                Input, game loop, rendering and audio integration
    route.ts                 Route projection and road profiles
    world.ts                 Scene construction and scenery lifecycle
    surveyScene.ts           Models generated from survey records
    assets.ts                Shared vehicle templates and materials
    junctions.ts             Signal phases and crossing movements
    parkedBuses.ts           Fixed coach queues and obstacle bodies
    hoardingScene.ts         Billboard frames and artwork
    poster-artwork.ts        Shared poster loading and quality variants
    npcHorns.ts / audio.ts    NPC horn events, recordings and synthesis fallback
    impact.ts                Visual collision response
    trafficMap.ts            Compact simulated congestion summaries
  survey/                    Feature records, observations, geometry and atlas
  ui/NavigationMap.tsx        Heading-up route navigation
public/
  data/                      Generated survey exports
  hoardings/                 Seven PNG posters and supplied branding
  branding/                  Supplied brand assets
  audio/horns/               CC0 horn recordings, credits and source manifest
  fonts/                     Local fonts and their license notices
scripts/                     Geographic import and export utilities
tests/                       Node test-runner regressions
docs/                        Sources, inventories, survey method and validation
```

Scenery is loaded in approximately 200 m chunks. Vehicle templates, materials and textures are reused; nearby traffic uses fixed pools. Distant detail and poster resolution are reduced on low graphics. Keep resource ownership explicit: unloading a scenery chunk must not dispose assets shared by other chunks or vehicles.

## Mapping and survey status

The bundled geometry comes from **OpenStreetMap**, with original game models and written observations linked to dated Google Maps/Street View references. Google imagery, tiles and downloaded meshes are not bundled, and the game has no live map dependency.

The inventory includes thousands of building footprints and background structures. **A mapped footprint is not a verified facade.** Unknown names stay blank, and mapped business names are not proof of current occupancy.

The survey method describes features by route distance, side/offset, elevation, geometry, appearance and dated evidence:

- `s`: metres along the route.
- `d`: offset from the route, negative on the driver’s left and positive on the right.
- `h`: height with a recorded ground/road reference.
- Permanent feature IDs remain stable; left/right building serials are generated from frontage order.
- Geographic polygons retain their shapes and can include islands or holes.
- Confidence is recorded per attribute; a supported name does not verify an estimated height.
- Nominal observations are spaced every 25 m, with both sides reviewed in 50 m sections and extra views around junctions and obstructions.

**Systematic coverage is incomplete; no side-section is certified survey complete.** Imagery from different dates is not a claim of current conditions. The Marathahalli extension includes six March 2026 views at four locations, with the upper-junction view unresolved for the playable road level. More frontage, entrance, construction, metro-stage, elevation and clearance reconciliation is needed.

Game adaptations include widened roads, adjusted metro-support clearances, estimated ramps and signal timings, wall-nameplate placement, lake fences, ambient trees/pedestrians, advertising hoardings and parked-coach queues. The coach queues and posters are not claims about real parking or advertising locations. Game-added potholes, rough asphalt and six shallow waterlogged patches cover the route; these are not observations of current road damage. Sarjapur Road is a disclosed player boundary; simulated junction traffic can still use it.

### Changing the corridor

1. Read [the survey method](docs/SURVEY_METHOD.md) and [source/rebuild notes](docs/SOURCES.md).
2. Update source data and observations with stable IDs, segment-local distances, source links, capture/inspection dates and explicit uncertainty.
3. Preserve the exact original 1,000 m segment and existing route vertices unless the change intentionally corrects them with evidence.
4. Update the manifest and relevant road/junction records; do not hard-code total route length or segment indices in consumers.
5. Regenerate exports, run affected tests, and compare the atlas and cockpit at joins, ramps, signals and representative stations.

The Python importers expect external OSM extracts and can overwrite the bundled data. Their source files and required inputs are documented in [SOURCES.md](docs/SOURCES.md); historical importers are not interchangeable with the current Marathahalli append. They are not part of routine setup.

## Customizing hoardings and traffic

To use your own posters, replace `public/hoardings/1.png` through `7.png`. Keep a **4:3 aspect ratio**; the supplied posters are **2400 × 1800 px**. All seven files must exist because the start screen waits for the shared loader. Artwork is fitted without cropping or stretching to 12 × 9 m frames.

The 14 placements use `src/data/hoardings.json`, with poster order **1–7, then 1–7 again**. All are on the left verge. Changing placement requires checking road, service-road, building and lake clearance as well as visibility from the approaching cockpit. Regeneration through `scripts/place-hoardings.ts` overwrites that placement file.

Tourist coach groups are defined in `src/game/parkedBuses.ts`; simulation and rendering consume the same records. Traffic and horn configuration live in `src/data/traffic.ts` and the corresponding game modules. See the [hoarding/audio notes](docs/HOARDINGS_AND_AUDIO.md) and [parked-coach notes](docs/PARKED_COACHES.md) before changing pooling, collision or merge behaviour.

Supplied brand artwork has separate terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

## Optional analytics

Without both PostHog settings, analytics stays disabled and the game still runs. To connect your own project:

```sh
cp .env.example .env.local
```

Set `VITE_POSTHOG_KEY` to your project's **public ingestion key** and `VITE_POSTHOG_HOST` to its API host, then restart the development server. Both are build-time settings for production; rebuild after changing them. Do not copy another deployment's credentials into a fork.

All `VITE_*` values are embedded in browser-delivered code. Never put personal API keys, private tokens or other secrets in them. Local environment files are ignored by Git; `.env.example` contains blank values only.

When configured, instrumentation covers:

- Runs, restarts, route completion, 10% milestones, kilometre milestones and loops.
- Distance, overtakes, collisions, health, moving time, waiting time and active on-road time.
- Visible page time, pauses, resumes, control methods and settings.
- Horn usage, route-point reaches, graphics performance and automatic quality changes.
- Sharing, atlas interactions and the end-screen antimattr link.
- SDK page events, exceptions and configured logs.

Anonymous browser identity associates runs; clearing storage or changing devices breaks that continuity. It is not a verified count of people. Delivery is best-effort and can be blocked or interrupted. Use incremental `game_run_metrics` deltas for totals rather than summing repeated cumulative snapshots. Development events carry `is_test_event: true`.

The complete event catalogue, metric definitions, dashboard recipes and limitations are in [docs/ANALYTICS.md](docs/ANALYTICS.md). That guide is a configuration reference, not a pre-created dashboard or a guarantee of ingestion. Review your analytics settings and provide an appropriate notice for your own deployment.

## Building and deploying

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

Deploy the **contents of `dist/`** to a static web host. Configure the build command as `npm run build` and output directory as `dist`. No backend or runtime environment service is required. Serve over HTTPS for clipboard sharing on public deployments.

The current app assumes it is served at the **domain root**: some links and asset paths start with `/`. A repository subpath such as `/orr-run/` requires base-path and absolute-link adjustments; changing Vite's `base` alone is not sufficient. For GitHub Pages, use a suitable root/custom-domain deployment or make and test those adjustments first.

Keep the generated map, fonts and all seven posters in the deployment. PostHog, if enabled, is an external network dependency for telemetry only. Offline installation/service-worker caching is not provided.

## Validation and troubleshooting

Run `npm test` and `npm run build` before submitting a change. Automated coverage includes route continuity, the preserved kilometre, survey ordering, junctions, collision/contact behaviour, horn reactions, coach merges, vehicle resources, hoardings and analytics bookkeeping.

For visual or traffic changes, also inspect approaching/passing cockpit views, desktop and mobile layouts, repeated route loops and scenery loading sweeps. Performance targets are 60 FPS on a typical laptop and stable 30 FPS on a midrange phone with reduced graphics. They are targets, not guarantees; desktop mobile-viewport tests do not establish physical-phone performance. Recorded checks and remaining gaps are in [docs/QUALITY.md](docs/QUALITY.md).

| Symptom | Check |
| --- | --- |
| Development server will not start | Node version, installed dependencies and whether port 5173 is already in use |
| Poster loading error | All seven correctly named PNGs, case-sensitive paths and deployment asset URLs; then retry |
| 3D view fails to start | Browser WebGL/hardware acceleration support and console errors |
| Low frame rate | Select low graphics, close GPU-heavy tabs and compare at a smaller viewport |
| No sound | Start/interact with the game, check mute and device output; browser autoplay rules require interaction |
| Missing analytics | Both environment values, a restarted/rebuilt app, blockers, and production/test filters |
| Missing facade name | Check the inventory; unsupported names intentionally remain blank |

## Contributing

Contributions to driving feel, traffic behaviour, mobile performance, accessibility and evidence-backed map detail are welcome.

1. Open an [issue](https://github.com/Sirsho29/orr-run/issues) for bugs or substantial changes. For map corrections, include the route station, travel direction, source link and imagery date.
2. Fork the repository and create a focused branch.
3. Follow the existing separation between source data, simulation, rendering and UI. Keep moving traffic deterministic; audio choices must not change driving randomness.
4. Add or update meaningful tests when behaviour changes, and run the affected checks plus the production build.
5. Open a pull request describing the change and validation. Include before/after cockpit views for scenery changes, and distinguish physical-device measurements from resized desktop tests.

For bug reports, include browser/device, graphics setting, approximate route station, steps to reproduce and a screenshot if useful. Remove credentials and personal information from logs.

Do not invent business names, silently promote estimates to verified records, bundle Google imagery, or add assets without documented reuse rights. Keep original feature IDs, dated evidence, explicit survey gaps and attribution intact. Improvements to coverage should follow the survey method rather than treating every map pin as a separate building.

### Useful references

| Document | Contents |
| --- | --- |
| [Survey method](docs/SURVEY_METHOD.md) | Repeatable observation and feature-recording process |
| [Sources](docs/SOURCES.md) | Provenance, extracts and import instructions |
| [Building inventory](docs/BUILDING_INVENTORY.md) | Footprints, names, order, evidence and uncertainty |
| [Infrastructure inventory](docs/INFRASTRUCTURE_INVENTORY.md) | Lakes, flyovers, metro works and signals |
| [Coverage gaps](docs/SURVEY_COVERAGE.md) | Unresolved sections on both sides of the road |
| [Quality notes](docs/QUALITY.md) | Validation results and remaining checks |
| [Vehicle visuals](docs/vehicle-visuals.md) | Vehicle modelling notes; later branding changes are in the hoarding/audio notes |
| [Street life](docs/STREET_LIFE.md) | Voluntary lane changes, busy-view horns, litter and wall stains |
| [Hoardings and audio](docs/HOARDINGS_AND_AUDIO.md) | Posters, BMTC branding and NPC horns |
| [Parked coaches](docs/PARKED_COACHES.md) | Fixed bus queues and merge behaviour |
| [Analytics](docs/ANALYTICS.md) | Event catalogue and aggregation recipes |
| [Survey export](public/data/route-survey.json) | Versioned machine-readable records |

## License and credits

Original code and documentation are released under the **[MIT License](LICENSE)**. Geographic data, fonts and brand assets retain separate terms described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

- Geographic geometry: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.
- Fonts: DM Sans and Space Grotesk, with included SIL Open Font Licenses.
- Game models: original procedural models. Dependencies retain their own licenses.
- Horn recordings: CC0, with [source credits and processing details](public/audio/horns/CREDITS.md). Auto variants are adapted car recordings; these are not authenticated local fleet horns.
- Supplied advertisements and branding are **excluded from the MIT code license**; obtain permission or replace them for your own use.

This is an independent game, not affiliated with Bengaluru transport authorities or the businesses depicted. Real names provide local context; they do not imply endorsement.
