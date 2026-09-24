# Vehicle visual update — 24 September 2026

Cars and cabs now use closed, bevelled bodywork with wheel openings, painted cabin pillars, separate glazed panels, shaped bonnets and boots, bumpers, grilles, mirrors, handles and rear light housings. The collision dimensions and simulation are unchanged. Brake lights enlarge in place, without moving away from the body.

## Artwork

- `public/branding/antimattr.svg` is the supplied original. The white derivative changes only `fill="black"` to `fill="white"`; the path and viewBox remain identical.
- Both bus side panels use the white derivative, with outward-facing, non-mirrored text and the original aspect ratio.
- `public/branding/antimattr-truck.png` is byte-identical to the supplied 1080 × 1208 PNG. Every truck uses the complete image on its rear cargo wall, above its lamps and plate.
- Images load before vehicle templates are constructed. A load failure disables starting and offers a reload. Identical buses/trucks share templates, and all vehicles share the relevant textures. The development-only vehicle turntable is available at `/?vehicles`; it is excluded from production builds.

## Verification

- All 25 automated checks passed, including three complete connected-route simulation loops, geometry envelope checks, artwork placement/orientation, retry after a partial load failure, repeated template cloning, and exactly-once disposal of shared resources.
- Production build passed. The existing bundle-size advisory remains.
- Visually checked car front/rear/quarter views, the cab roof marker and rear plate, both bus logos, and the complete rear truck poster.
- Temporarily removed the truck image: the start button stayed disabled and the expected retry message appeared. Restored the image and successfully reloaded into the game.
- Exercised three rendered endpoint-to-hospital transitions. After warm-up, identical start-position samples after consecutive transitions both reported 284 geometries and 51 textures. These are sampled observations, not a long-duration memory profile.
- Desktop browser ready-scene samples reported approximately 60 FPS before and after the update at 842 × 837. Traffic motion changes the workload; these are spot readings rather than controlled hardware benchmarks.
- Verified the 844 × 390 landscape layout inside a measured frame with reduced graphics. Steering/pedal controls and cockpit remained visible; sampled rendering was 56 FPS on this desktop. No physical phone performance claim is made.
- Restored the saved graphics preference to Auto after testing. Temporary responsive test fixture was removed.
