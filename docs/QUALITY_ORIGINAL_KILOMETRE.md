# Route research and quality record

## Route selection

One kilometre centred on the midpoint of the road-projected Adobe and Electra locations. Google Maps differentiates Electra/Prestige Tech Park from the newer JPMorgan Embassy TechVillage campus. The user selected the Adobe–Electra area.

- Start: **12.9382370464, 77.6940037235**
- End: **12.9460428451, 77.6983945008**
- Length: **1,000.000 m**, measured along the local metre-projected horizontal OSM polyline. It is not distance-compressed. The visual underpass elevation is approximate.
- OSM source ways: 378720749, 377096333, 377096329, 1302220814, 1203530534, 1203530535, 377096332.
- Import contains 344 building footprints plus the metro station, including off-road campus buildings and scenery buffers. It is not a count of visually verified facades. The update adds 123 footprints over the prior extract, 49 individual mapped supports and 5 observed tree-row records.

## Street-view references inspected

| Checkpoint | Reference | Imagery | Observation |
|---|---|---|---|
| 0 m | [12.938237, 77.694004](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.938237,77.694004&heading=45&pitch=0&fov=100) | Dec 2025 | Underpass approach, blue/white retaining walls, overhead metro viaduct. |
| 250 m | [12.939975, 77.695451](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.939975,77.695451&heading=30&pitch=0&fov=100) | Dec 2025 | Blue/white walls continue on both sides; road rises toward the exit. |
| 500 m | [12.941898, 77.696645](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.941898,77.696645&heading=30&pitch=5&fov=100) | Apr 2026 | Google snaps to the service road: trees, utility lines, shops, metro on the right. Used for surroundings, not main-carriageway placement. |
| 750 m | [12.9438, 77.6976](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9438,77.6976&heading=285&pitch=8&fov=90) | Mar 2026 | Adobe frontage: glazing, pale vertical framing, entrance fence and trees. |
| 1,000 m | [12.946043, 77.698395](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.946043,77.698395&heading=20&pitch=3&fov=100) | Mar 2026 | Elevated structure and concrete piers, work barriers, service-road edge. |

Additional facade reference: [12.9414, 77.69635](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9414,77.69635&heading=178&pitch=0&fov=90), March 2026. Pale vertical facade piers and blue glazing visible across the carriageway. Building matching and heights remain approximate.

Business references: [Adobe office locations](https://www.adobe.com/in/about-adobe/contact/offices.html), [Adobe tower opening, 2023](https://news.adobe.com/en/apac/news/downloads/pdfs/files/in/adobe-expands-operations-in-india-with-new-office-tower-in-bengaluru.pdf), [JPMorgan's new Embassy TechVillage campus, 2023](https://www.jpmorganchase.com/newsroom/press-releases/2023/jpmorgan-chase-opens-new-offices-in-mumbai-and-bengaluru). The last reference explains the campus distinction; it does not authenticate every legacy office sign.

## Automated validation

`npm test` checks measured length and unique footprint IDs, continuous road/elevation at source vertices, acceleration and braking, pause/resume, simultaneous steering/braking, curbs and construction collision boundaries, impact scoring, repeat-lap state, stationary-player traffic replenishment, a ten-minute traffic-following soak across multiple laps, and restart resets.

The soak is a simulation check, not a claim that ten minutes were driven by a human or rendered on a physical phone. Rendering performance is checked separately in-browser.

## Browser checks

- Desktop preview starts, renders and exposes no WebGL/shader errors in the inspected log.
- Desktop renderer observed approximately 60 FPS at sampled checkpoints on the current host. This does not establish performance on all devices.
- Landscape 844 × 390 and portrait 390 × 844 layouts inspected; pedals, steering and orientation guidance remain available.
- Physical iOS/Android hardware and Safari are not available in this test environment; their performance and audio behavior remain to be verified.
- The development-only checkpoint slider permits reproducible visual review at every 250 m without driving through all preceding traffic.

## Remaining fidelity work

Before claiming a close recreation of every roadside building, independently verify each remaining facade and current sign, replace inferred heights where evidence exists, refine campus entrances and service-road connections, and verify up-to-date construction. The inventory makes these omissions visible. Do not expand the route to conceal them.

## Repeatable survey update — 24 September 2026

- 41 nominal checkpoints × forward/left/right = 123 written observations; all source links, imagery dates and inspection date are retained in `src/survey/observations.json`.
- Seven panorama locations retained with IDs and actual coordinates; 34 checkpoints still require location reconciliation. Checkpoint 500 m is flagged as a service-road view. At 450 m Google returned a November 2020 contributor panorama, so that imagery does not establish the later construction state.
- All twenty 50 m sections have a review for each side. All forty remain unresolved until frontage/entrance matching and panorama placement are reconciled. The completion counter deliberately stays zero.
- The atlas, inventory and scenery share stable feature IDs. Adding a building can renumber display serials without changing feature references. Names from OSM remain map-derived; only visually confirmed signs are rendered. Heights calculated from storeys remain estimated.
- Metro supports use mapped individual positions. Wider station slabs use its mapped footprint with estimated elevations and original simplified beams/mesh. Work barriers share dimensions with simulation boundaries.
- Landscape polygons preserve geographic coordinates. Observed tree rows use approximate individual canopies. Mapped water is below road surfaces at the endpoint crossing; no Ibbalur Lake or potholes were added.

### Cockpit comparison after scenery changes

| Metres | Inspected game/reference correspondence | Remaining difference |
|---|---|---|
| 0 | Striped retaining walls, underpass ahead and metro to the right | Wall/deck heights and exact utilities are estimated |
| 250 | Rising enclosed approach, striped walls and continuing viaduct | Individual wall panels and trees are simplified |
| 500 | Campus/service roads, IndiQube green glazing and footbridge ahead | Reference is on the service road; small storefront matching unresolved |
| 750 | Tree row, Sattva coloured facade panels and broad station structure ahead | Canopy density, entrances and facade detail simplified |
| 1,000 | Station exit, metro supports and construction hoarding visible behind/right | Pipe/truss detail and exact construction boundaries not modelled |

Current-host desktop preview sampled 60 FPS. Automated tests include a ten-minute simulation soak completing multiple loops with the fixed traffic pool. Physical-phone frame rate and true simultaneous multitouch are not established by desktop layout inspection.
