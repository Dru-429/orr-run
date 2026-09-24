# orr.run — repeatable roadside survey

## Coordinate formula

P(s,d,h) = C(s) + d × Nright(s) + h × up.

`s` is cumulative horizontal distance in metres on the route polyline; `d` is negative driver-left and positive driver-right. Local x is east, local z is south. For a unit tangent `(tx,tz)`, the right normal is `(-tz,tx)`. Absolute elevation and road-relative elevation must not be mixed. The existing game uses an estimated road elevation profile; heights do not claim geodetic accuracy.

Project geographic points with the map origin and retain the original footprint polygons. The field atlas is a flattened schematic, with lateral distance compressed for readability; it must never become a source of geographic geometry. The combined horizontal centreline is 9,748.223829 m: 5,161.884240 m from Silk Board, 3,586.339589 m of retained Bellandur road, and the preserved 1,000 m segment. This is not a 3D ramp length. Segment-local distances are retained and whole-route distances equal segment offset plus local distance minus the retained interval’s sourceFrom.

## Collection procedure

1. Import licensed road, footprint, support, landscape and water geometry. Record source IDs, extraction date and licence. `scripts/import-extension.py` reconstructs the selected directed route from licensed OSM XML extracts; see SOURCES.md. It does not fetch Google imagery. New route sections require an explicitly selected route and a new geographic extract; never stretch this kilometre.
2. Open `/?survey=1`, then **Street View checklist**. Inspect all 194 segment-local 25 m checkpoint entries (153 extension, 41 original; the shared join has an entry for each segment) forward, left and right. Add backward and intermediate views at occlusions, entrances and changes in construction. Links alone do not count as inspections.
3. Confirm the loaded panorama's actual coordinates, heading, panorama ID and capture date from Maps' visible URL/interface. Record a service-road snap explicitly. Do not treat the requested coordinates or today's inspection date as the photograph's location or capture date. Unknown capture month stays null.
4. Keep original observations in `src/survey/observations.json`; add extension observations to `src/survey/extension-observations.json`, using `/data/observation-template.json` as a starting point. New Silk Board observations go in `src/survey/silk-observations.json` with IDs `silk-hsr:sv-<local-station>-<direction>`. Archived hospital observations retain their old IDs. Older extension IDs are `manipal-approach:sv-<local-station>-<direction>`; original `sv-<station>-<direction>` IDs remain unchanged; suffix additional observations at the same station. Associate permanent feature IDs only after matching the scene. Unknown identity stays unassociated. Never infer a current logo from an old company name.
5. Match footprints across overlapping views. A building and its tenants are separate records. The compiler attaches a business only when its point falls within exactly one footprint; ambiguous pins stay unassigned. Do not attach signage by nearest distance.
6. Record confidence separately for geometry, height, storeys, facade, roof, entrances, signage, elevation, construction stage and equipment. `observed` requires dated visual evidence; `map-derived` describes map data; `estimated` is a disclosed model choice; `unknown` has no established value. Empty evidence must not be converted into a confident observation.
7. Review each 50 m section on both sides. Record obscured frontage, missing direction views, unmatched names and imagery-date conflicts. Existing coverage deliberately remains unresolved while any frontage reconciliation is outstanding. A reviewed gap is not a completed survey. A missing footprint does not prove open ground.
8. Build with `npm run build`. The compiler produces the atlas, JSON inventory, building CSV, checkpoint links and Markdown coverage register from the same records used by the game. Compare cockpit views every 250 m, at both segment endpoints, the join, bridges and construction transitions and validate all physical changes.

## Feature rules

- All buildings use permanent map-derived IDs. L001/R001 are generated presentation numbers sorted by the start of the nearest road-facing edge, then ID; they are not permanent identifiers.
- Piers use mapped positions and reference numbers. A reference is metadata, not proof of a painted sign. Heights and individual construction stage remain estimated until verified. Do not make every pier appear unfinished just to add construction.
- Flyovers/underpasses need separate geometry, deck/ramp intervals, supports and vertical-clearance evidence. An OSM layer is not a height in metres.
- Road work has one shared barrier record used for rendering and vehicle bounds. Map-derived construction land is drawn as ground; machinery and excavation are not invented.
- Lakes, ponds, drains and fountains preserve their mapped type. Do not rename a wastewater polygon a lake. Ibbalur Lake belongs to the extension only; its outer shoreline and island hole remain geographic polygons.
- Vegetation polygons are map-derived. Trees generated within them have estimated canopy positions and heights; mapped point trees take precedence. Do not place trees through buildings, water or carriageways.
- No potholes are included, observed or fictional.
- Distributable geometry comes from OpenStreetMap under ODbL, with original game models. Google Maps/Street View is retained as links and written inspection notes only. Do not bundle map tiles or panorama pixels.

## Outputs and limitations

The atlas includes scenery before/after the segment and farther campus buildings for a natural horizon. The original kilometre remains exactly 1,000 m within the longer connected drive. Wider mapped coverage is not proof that every background building is visible from a car. Individual facades, current signs, tree locations, heights, construction dates and water levels remain uncertain wherever their records say so. Physical-device performance requires a real phone check; browser viewport resizing alone is not that check.

## Completing a section

`src/survey/reviews.json` retains original reviews; `extension-reviews.json` stores 76 extension sections on each side, including the final 37.610887 m interval. After matching all visible frontages and checking open land, set `frontagesReconciled`, record any open-space evidence IDs, and resolve the explicit gap list. Completion also requires side-facing checkpoint observations and reconciled panorama locations. A 2020-only construction view remains an explicit date conflict. Do not clear gaps merely to raise the completion count.

The combined records contain 255 inspected directions: 123 original and 132 extension. Extension coverage is every 25 m through 750 m, followed by 250 m checkpoints and the exact join. 109 extension checkpoints still lack their three-view inspection. All 192 side-sections remain unresolved. Some inspected directions lack actual panorama coordinates or have obstructed facades; a view checkmark is not a completion certificate.
