# Silk Board corridor sources — 24 September 2026

Geometry is derived from [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0. The complete Agara Lake relation is [8469370](https://www.openstreetmap.org/relation/8469370), with its mapped hole retained. Ibbalur is the separate relation 3120373. These are geographic footprints, not traced Google screenshots.

Start: OSM node 3805003790 at 12.9173954, 77.6229259 on the eastbound ORR just east of Silk Board junction. Join: node 1644166489 at 12.9212738, 77.6662615. The chosen directed ORR path is recorded in `src/data/silk-route-config.json`; adjacent way-node membership is validated by the importer. It deliberately stays on ORR across Agara rather than taking the shorter Sarjapur Road connection.

Eastbound HSR bridge ways 611380787/611380780 and Agara ways 377106135/380706142 provide the horizontal profiles. Opposing profiles use ways 380980312/380980313, 380980307/377085060 and Ibbalur way 380929042. Opposing widths and offsets remain estimated around these distinct intervals; they are not a centimetre-accurate carriageway survey. Vertical profiles, support spacing, clearance and ramps remain model estimates.

The same local metre projection as the original route is used (origin 12.942, 77.696; radius 6371008.8 m). No rounded distance is imposed. The earlier route is archived in `segments/manipal-v2.json`; the original kilometre geometry is unchanged.

## Inputs and regeneration

The importer uses the Silk Board and Agara extracts in addition to the earlier hospital/Bellandur/ORR/north extracts. Complete relations: 8469370, 5298814, 5298815, 17083842, 17500711 and 19751547. Inputs were retrieved from the public OSM API on 24 September 2026. Missing relation members are reported by the importer. Runtime geometry and source links are bundled locally; temporary XML files are not runtime dependencies.

```sh
python3 scripts/import-silk.py /path/to/silk.osm /path/to/agara.osm /path/to/agara-lake.osm /path/to/hospital.osm /path/to/bellandur.osm /path/to/orr.osm /path/to/north.osm /path/to/relation-17083842.osm /path/to/relation-17500711.osm /path/to/relation-19751547.osm /path/to/relation-5298814.osm /path/to/relation-5298815.osm
python3 scripts/build-corridor-details.py
npm run build
```

`import-extension.py` is the historical v2 importer, not the current rebuild command. Historical sources remain in [SOURCES_MANIPAL.md](SOURCES_MANIPAL.md).

## Street references and junctions

Dated panorama coordinates, headings, IDs, links, observations and feature matches are in `src/survey/silk-observations.json`. HSR 5th Main: November 2025; Agara approach and both flyover crests: March 2026; Sarjapur: April 2026. The signal inventory links these references and separately states that subsequent operation is unknown. Every game signal cycle, phase offset, movement path, stop-line offset and conflict width is an explicit simulation estimate.

The [Bengaluru Traffic Police / ORRCA presentation, 10 October 2022](https://www.orrca.org.in/wp-content/uploads/2022/10/DCP-Traffic-East-ORRCA-Presentation.pdf), page 4, lists Silk Board, HSR 5th/14th/17th Main, Agara, 27th Main and Ibbalur junctions. It does not establish current traffic-light operation or which deck a head controls. Unresolved nodes remain inactive in gameplay.

No Google image pixels, map tiles or downloaded Google meshes are distributed. Unknown names remain blank on buildings. Construction, facades and individual metro completion stages still require extensive reconciliation; the included map should not be described as a complete current survey.

## Marathahalli append, version 4

The v3 centreline and data are preserved in `src/data/segments/silk-v3.json` and its manifest. `scripts/import-marathahalli.py` appends the directed northbound ways 1203530535, 377096332, 1323814011, 376784366, 380704970, 380704971, 1086240288 and 1105681083. The OSM bbox extract (77.694,12.944,77.711,12.966) and full relation 18434930 were retrieved 24 September 2026. No missing relation members remain in this append.

```sh
python3 scripts/import-marathahalli.py /path/to/orr-marathahalli.osm /path/to/orr-mara-relation.osm
python3 scripts/build-corridor-details.py
npm run build
```

The final coordinate is 12.960511585435912, 77.70135844780202. The extension measures 1,647.038261 m in the original local projection. The underpass north ramp ends at combined station 11,295.262089 m; the finish is 100 m farther along the centreline. Horizontal topology is map-derived; the -5.5 m trough depth, clearance and smooth vertical profile are estimates. March 2026 Street View shows the sunken through-road, blue/cream walls and unfinished metro structures; it does not establish September completion.

Six observations with actual panorama positions, headings and capture dates are stored in `src/survey/marathahalli-observations.json`. The upper-junction panorama is marked unresolved for the playable road level. Only two new facade records have matched building evidence. The remaining 25 m inspections and comprehensive 250 m cockpit-reference comparison remain open; map pins alone do not verify facade signage.
