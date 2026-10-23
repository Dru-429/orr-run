# Visual presentation

The HUD reads the existing simulation snapshot at the engine's existing throttled UI cadence. It does not run a second game loop. `src/ui/HUD/GameHUD.tsx` contains the speed/mode, fuel, health/navigation distance, route progress, control legend and utility components; `hud.css` contains shared tokens and responsive layouts. The navigation panel retains the bundled route, landmark and traffic calculations.

The visual target is the supplied Bengaluru daytime reference: dark glass panels, mint indicators, a blue navigation route, warm daylight and weathered urban materials. The environment remains procedural; this change does not introduce photographic buildings or downloaded vehicle models.

## Rendering budget

- Seeded asphalt detail textures are generated once per world; the normal road and worn overlays use shared textures. Surface relief uses bump mapping, with no extra road geometry.
- Low-frequency world-position variation reduces obvious asphalt tiling. No new screen-space render passes are added.
- Facade variations are baked into existing shared texture atlases. Concrete materials share a single 512-pixel detail texture.
- Traffic details are merged into existing material batches and cached vehicle templates. Vehicle envelopes and traffic counts remain unchanged.
- A shared 256 × 128 environment texture supplies restrained paint/glass reflections. It is released with the renderer.
- The high-quality sun shadow map is 2048 × 2048 with tighter coverage. Low quality retains the existing disabled-shadow behavior. Auto quality continues to reduce resolution and shadows when frames are slow.
- HUD state still updates approximately every 85 ms; CSS transitions interpolate bars independently of physics. Blur is limited to HUD panels, with an opaque fallback for browsers without backdrop filtering.

## Verification

Use the existing `?inspect` mode and canvas telemetry (`fps`, `frameMsP95`, `drawCalls`, `triangles`, `geometries`, `textures`) to compare the same road station and camera before/after on the target hardware. Check 1366×768, 1440×900, 1920×1080 and 2560×1440, then low graphics and touch layouts. No live FPS measurement or screenshot comparison was available in the implementation environment.

Reset Car enters the existing crash/recovery lifecycle with zero velocity. It adds no damage and does not call restart, refill fuel or restore health. The HUD reports the controller's existing recovery states.
