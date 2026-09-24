# Expanded route sources — 24 September 2026

## Geographic data

Geometry is derived from [OpenStreetMap](https://www.openstreetmap.org/copyright), licensed under ODbL. Every imported building, support, road and landscape record retains its source URL and original ID. Multipolygon outer rings and holes are retained; relation 3120373 supplies Iblur Lake and its island. Relation 16057542 supplies park geometry.

The public-road start is OSM node **13333375729** at **12.9203128, 77.6657051**, on Sarjapura Road way **609637729**. Hospital parking and private internal roads are not part of the prescribed route. The join is **12.938237046378228, 77.6940037235084**. The original endpoint remains **12.94604284507916, 77.69839450083263**.

Ordered extension ways: 609637729, 610138361, 1108491680, 240694321, 1109938622, 1289252169, 609637808, 1289254986, 377104675, 1215354174, 377104672, 377104670, 1239003799, 1239003789, 377103305, then the partial 378720749 to the exact join. The manifest contains each measured interval and its source link.

The route uses this chosen directed carriageway geometry. It does not force Google's approximate 3.8 km distance or reproduce its service-road diversion. Measurement uses the original local metre projection (origin 12.942, 77.696; Earth radius 6371008.8 m), preserving the old kilometre verbatim.

## Rebuild

The import accepts OSM XML extracts and complete relation XML files. Inputs used in this workspace were hospital, Bellandur, existing ORR and north-corridor extracts, plus complete relations 17500711, 19751547 and 17083842. These public-source temporary files are not runtime dependencies.

```sh
python3 scripts/import-extension.py /path/to/hospital.osm /path/to/bellandur.osm /path/to/orr.osm /path/to/north.osm /path/to/relation-17500711.osm /path/to/relation-19751547.osm /path/to/relation-17083842.osm
npm run build
```

`route-config.json` records the selected path and start node. `segments/adobe-electra.json` is the preserved input, not a generated combined-route output. The importer deduplicates OSM IDs, stitches relation rings, preserves holes and reports missing relation geometry. The latest import reported no missing relation members.

## Visual inspection

[Google driving-route reference](https://www.google.com/maps/dir/?api=1&origin=Manipal+Hospitals+Sarjapur+Road+Bengaluru&destination=12.9382370464,77.6940037235&travelmode=driving). Individual panorama links, actual retained coordinates, headings, image dates and written notes are in `src/survey/extension-observations.json`; the original file remains `observations.json`.

Source links are references, not permission to redistribute imagery. No panorama pixels, map tiles, Google-derived mesh downloads or live Google dependency are included. Wordmarks are rendered only where a recorded view supports the match. A mapped tenant pin alone does not establish signage.

## Explicit limitations

The two OSM station building footprints are rendered above the road. Way 1508372366 is a construction envelope, used as a disclosed approximate silhouette for the third station; it is not a surveyed deck outline. Metro portal supports over flyovers have observed structural presence but estimated individual positions. Elevations, clearances, lane widths, barrier extents and navigation signs are modelling estimates. No legal or survey-grade positional accuracy is claimed.
