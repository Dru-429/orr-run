# Data, artwork and third-party notices

The [MIT license](LICENSE) covers the project's original code and documentation.
It does not relicense third-party data, fonts, logos, advertisements or dependencies.

## Geographic data

Geometry is derived from © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
This includes the geographic datasets in `src/data/`, their archived segments and
the derived geographic exports in `public/data/`. Preserve the attribution and
applicable ODbL terms when redistributing or adapting these data.

Dataset provenance, source links and import instructions are in
[docs/SOURCES.md](docs/SOURCES.md). Survey annotations distinguish map-derived
geometry, dated observations and estimates. Google Maps and Street View links are
inspection references; Google imagery, tiles and meshes are not bundled.

## Fonts

- DM Sans: see [the included SIL Open Font License](public/fonts/DM-Sans-OFL.txt).
- Space Grotesk: see [the included SIL Open Font License](public/fonts/Space-Grotesk-OFL.txt).

## Branding and advertising artwork

Files in `public/branding/` and `public/hoardings/` are supplied branding and
advertising assets, excluded from the MIT code license. No separate general reuse
license is granted here. Obtain permission for reuse or replace them with your own
artwork. Replacement hoardings must retain the filenames `1.png` through `7.png`
and the 4:3 aspect ratio so the game can load them.

Business names and logos depicted in the game remain the property of their
respective owners. Their appearance does not imply affiliation or endorsement,
and the code license does not grant trademark rights.

## Dependencies

React, Three.js, Vite, Lucide, PostHog and other packages retain their own licenses.
See `package.json`, `package-lock.json` and the license files distributed with each
installed package. Original game models are generated in code; any incorporated
third-party assets must be documented here with their source and license.
