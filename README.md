# orr.run

A first-person browser driving prototype from **Silk Board through HSR, Agara, Ibbalur and Bellandur to Adobe–Electra**, toward Marathahalli.

The new extension measures **5,161.884240 m**. It joins the old ORR vertex at **12.9212738, 77.6662615**, retaining **3,586.339589 m** of the Bellandur approach and the original **1,000 m** kilometre. Total horizontal centreline: **9,748.223829 m**. The earlier **201.271298 m** hospital approach is archived. Ramp heights and dimensions are estimates; the horizontal measurement is not a surveyed 3D road length.

## Play locally

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open http://localhost:5173. Enter starts; W/↑ accelerates; S/↓ brakes; A/D or ←/→ steers; Space honks; Escape pauses. Q/E and windshield dragging look sideways. Mobile steering and pedals accept separate pointers. The cockpit, damage, controls, fuller vehicles and antimattr artwork are retained.

Open `/?survey=1` for the atlas, lake/flyover/signal inventory, dated references and explicit gaps. The original kilometre and archived hospital approach remain selectable.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

`dist/` runs as a static site without accounts, backend or live maps. Local preview links are not public deployment links.

## Included

- 3,835 building footprints plus five station models; unknown buildings remain unsigned. Counts include background scenery, not just verified frontages.
- Complete licensed Agara and Ibbalur lake polygons with islands/holes; Agara label, minimap landmark and geographic atlas outline. Large water surfaces are persistent meshes with extent-based visibility.
- Separate eastbound/westbound HSR and Agara profiles, and the westbound Ibbalur structure. Each profile has deck and ramp records. Mapped horizontal intervals; estimated widths, supports, heights and ramp transitions.
- 383 mapped metro supports, mapped service-road intervals, construction and vegetation. No potholes.
- 27 signal-node inventory entries. Three dated approach references power gameplay junctions: HSR 5th Main, Agara Lake approach, and Ibbalur/Sarjapur. Other heads remain unresolved and do not stop the player.
- Shared junction records: stop lines, road levels, conflict areas and phases. Estimated 35/3/2/12/3/2-second cycle, independent offsets, occupied clearance holds, exit-space checks and progressive queues. Elevated opposing traffic passes above Sarjapur’s ground-level signal.
- 126 road vehicles and a shared fixed pool of 12 crossing vehicles. Right-side Agara/Sarjapur branches turn onto ORR; merged vehicles follow traffic and downstream signals. Player braking is manual; no red-light fines.
- Sarjapur turn is an explicitly signed game boundary. Manipal Hospital remains on the right. Looping returns to Silk Board, preserving distance and damage.
- Shared lane/elevation/restriction records; approximately 200 m scenery chunks, at most seven retained. Original shared vehicle assets and resource ownership retained.
- Route-specific best key `orr.best.silk-board-to-adobe-v3`; earlier saved keys remain untouched.
- Version 3 survey export, 394 checkpoints and 392 side-section gap records.

## Survey status

**This is a playable geographic prototype, not a completed street-by-street survey.** The new extension has seven dated inspected views: a displaced Silk Board start panorama, three signal approaches, Agara’s screened lake edge, and the two flyover crests. Its 208 nominal 25 m checkpoints still require systematic forward/left/right reconciliation. The active combined route retains 235 observations; 27 earlier approach observations are preserved in the archive. No side-section is certified complete.

The new references date from November 2025, March 2026 and April 2026, inspected on 24 September 2026. They do not establish September construction or signal operation. Small unmapped structures, individual facades, entrances, metro stages, ramps, clearances and exact movement paths remain unresolved or approximate. HSR 14th/17th/27th Main and Agara junction signal assignments need additional ground-level inspection; the 2022 police list is an investigation checklist, not proof of current active signals.

- [Building inventory](docs/BUILDING_INVENTORY.md)
- [Lake, flyover and signal inventory](docs/INFRASTRUCTURE_INVENTORY.md)
- [Coverage gaps](docs/SURVEY_COVERAGE.md)
- [Survey procedure](docs/SURVEY_METHOD.md)
- [Sources and rebuild procedure](docs/SOURCES.md)
- [Validation and remaining checks](docs/QUALITY.md)
- [Versioned export](public/data/route-survey.json)

## Development

`src/data/route-manifest.json` holds ordered segments, retained source intervals and cumulative offsets. `segments/adobe-electra.json` preserves the original kilometre; `segments/manipal-v2.json` preserves the previous route. Simulation is independent of React and rendering. `src/survey` supplies the atlas and scene records. `junctions.json`, `signal-inventory.json`, `opposite-flyovers.json` and `service-roads.json` hold separate infrastructure records.

Development-only `/?inspect=1` supports exact stations, junction jumps and three scenery sweeps with rendering counters. `/?vehicles` is the vehicle turntable. These controls are omitted in production. The extra asphalt beyond the endpoint is scenery only.

Geometry © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. Google Maps/Street View is used only for links and written observations; imagery is not bundled. Game models are original. Fonts retain their included SIL Open Font Licences. This independent game is not affiliated with depicted businesses.
