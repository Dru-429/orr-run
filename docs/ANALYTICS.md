# orr.run — PostHog event and measurement guide

Analytics is optional: the game runs without PostHog when either environment setting is absent. Configure your own public ingestion key and API host using `.env.example`; existing deployments keep their configured project. Gameplay analytics v2 gives each run a UUID (`run_id`), keeps it through route loops, and creates a new one on restart. A completed route is a lap, not a new run. A run ends through health depletion, restart, page exit or engine disposal.

PostHog's existing anonymous `distinct_id` associates visits and runs from the same browser. Do not call `identify` with made-up accounts or reset identity on restart. Clearing browser storage/private browsing creates a new identity; different devices are not linked. This is browser-level usage, not a verified count of human people. See the [PostHog identity documentation](https://posthog.com/docs/product-analytics/identify).

## Production filters and common properties

Filter every production insight to `is_test_event = false`, `analytics_version = 2` for the new run events, and the desired `route_id`. Development events are labelled test events; inspection mode suppresses gameplay events. Existing SDK pageviews/autocapture/exceptions and survey events carry the environment/test labels, but do not all carry a run ID or analytics version.

Run events include `run_id`, `route_id`, exact `route_length_m`, graphics settings, reduced-motion and mute preferences. Run summaries include:

| Property | Meaning |
|---|---|
| `distance_m` | Accumulated distance this run, including multiple laps |
| `route_station_m` | Current position within the route |
| `route_progress_percent` | Current lap percentage; resets at the loop |
| `max_route_completion_percent` | How much of the route the run has completed, capped at 100%; stays 100 after the first lap |
| `on_road_seconds` / `elapsed_seconds` | Simulation time in active gameplay, including stopped traffic; excludes pauses, hidden-tab pauses and loop fades |
| `moving_seconds` | Sampled active time at or above 1 km/h |
| `waiting_seconds` | Active gameplay below 1 km/h; can include voluntary stopping, not exclusively congestion |
| `visible_paused_seconds` | Time paused while the document is visible |
| `run_wall_seconds` | Wall time from start to finish, including pauses/hidden time; frozen after finishing |
| `overtakes`, `collisions`, `health` | Current simulation counters and remaining health |
| `lap`, `completed_laps` | Current lap and number of complete route passes |
| `max_speed_kph`, `average_speed_kph` | Peak sampled speed and distance divided by active gameplay time |
| `horn_presses`, `horn_seconds` | Player horn press count and held time; excludes NPC horns |
| `pause_count` | Genuine transitions into pause, including automatic blur/visibility pauses |

## Events now collected

| Event | When | Useful properties / questions answered |
|---|---|---|
| `game_loaded` | Posters and the game engine are ready | `load_time_ms`, route ID/length; load-to-play funnel |
| `game_started` | Home-screen start or restart, once per run | `start_source = home/restart`, run ID; total runs, runs per browser, repeat plays |
| `game_progress` | Every 10% of each lap, once | `milestone_percent`, `milestone_lap`; completion and drop-off funnel |
| `game_distance_milestone` | Every accumulated kilometre | `kilometre`; long-run engagement |
| `route_lap_completed` | Crossing the route endpoint, once per lap | `completed_lap`, elapsed time, health, overtakes; first-lap completion and repeat laps |
| `game_route_point_reached` | Passing a segment boundary, hoarding station or parked-coach queue start | `point_id`, `point_kind`, `point_station_m`, `point_lap`, optional `poster_number`; where players reach |
| `game_run_metrics` | Every 30 active seconds, pause, tab hide, and terminal checkpoint | Additive deltas plus full summary; totals include unfinished runs |
| `game_collision` | One new impact contact, not every overlapping frame | `obstacle_type`, `health_lost`, `impact_severity`, station; difficult locations and coach impacts |
| `game_paused` | Genuine pause transition | `pause_reason = manual/dialog/window_blur/tab_hidden/webgl_context_lost`; interruptions |
| `game_resumed` | Genuine resume from pause | Resume reason and run summary |
| `game_restarted` | Restart action, attached to the previous run | Previous run summary; replay behaviour |
| `game_run_finished` | Exactly one terminal event per run when observable | `finish_reason = health_depleted/restart/page_exit/engine_closed`; results and abandonment |
| `game_ended` | Health reaches zero, once | Retained compatibility event; use `game_run_finished` for all final outcomes |
| `game_page_engagement` | Every 30 visible page seconds and on hide/exit | `delta_visible_seconds`, `visible_seconds`, `page_metric_sequence`; visible time including home, driving and menus after engine initialization |
| `game_control_used` | First use of each control family per run | `input_method = keyboard/touch`; control adoption |
| `game_settings_opened` | Opening settings | Run context |
| `game_settings_updated` | A settings change | `muted`, `reduced_motion`, `graphics_quality` |
| `game_map_notes_opened` | Opening map notes | Run context; survey interest |
| `game_link_copied` | Successful copy | Run context and phase; sharing intent, not a confirmed social share |
| `game_performance_sample` | Every 30 active seconds | `fps`, `frame_ms_p95`, actual graphics quality, viewport dimensions |
| `game_quality_adjusted` | Automatic graphics reduction | `reason = slow_frames`, actual graphics quality |
| `antimattr_clicked` | End-popup CTA click | Run summary, `placement = game_over`, exact destination URL; campaign click-through |
| `survey_feature_viewed` | Existing atlas feature click | Feature, side and segment IDs |
| `survey_tab_selected` | Existing atlas tab change | Tab and segment |
| `survey_exported` | Existing survey export action | Segment, feature and checkpoint counts |
| SDK `$pageview`, `$pageleave`, exceptions/logs | Existing PostHog integration | Acquisition/referrer/UTM, browser/device context, errors and page sessions |

A hoarding reach event is **not a viewable ad impression**. It says the vehicle crossed that station; it does not prove the player looked at the poster. An antimattr click records outbound intent; conversions on antimattr require analytics on that destination. The supplied UTM URL is preserved exactly.

## Accurate totals and suggested PostHog insights

`game_run_metrics` is the canonical additive stream. Sum only its `delta_*` values, never the cumulative `distance_m`/`elapsed_seconds` repeated on heartbeat, milestone and finish events.

| Dashboard measurement | PostHog setup |
|---|---|
| Total runs | Unique `run_id` count on `game_started` |
| Runs by a user/browser | Group `game_started` by `distinct_id`; count unique `run_id` |
| Total distance covered | Sum `delta_distance_m` on `game_run_metrics`; divide by 1,000 for km |
| Distance by user | Same sum grouped by `distinct_id` |
| Total active/on-road time | Sum `delta_on_road_seconds` on `game_run_metrics` |
| Total moving / waiting / paused time | Sum corresponding `delta_moving_seconds`, `delta_waiting_seconds`, `delta_visible_paused_seconds` |
| Total time spent on the page | Sum `delta_visible_seconds` on `game_page_engagement`; includes visible home/menu time, excludes hidden time |
| Total overtakes / damaging collisions | Sum `delta_overtakes` / `delta_collisions` on `game_run_metrics` |
| Horn usage | Sum `delta_horn_presses` or `delta_horn_seconds` |
| Per-run results, including abandoned runs | Group by run ID; use latest metrics/finish summary, or maximum cumulative distance/time/overtakes |
| Completion funnel | `game_started` → 10%, 50%, 90% `game_progress` → `route_lap_completed` with `completed_lap = 1`; hold `run_id` constant |
| Drop-off by route location | Bucket the last observed `route_station_m` per run; separate death/restart/page-exit reasons |
| Replay conversion | `game_run_finished` → `game_started` with `start_source = restart`, grouped by browser identity |
| Best distances and top runs | Maximum `distance_m` per run/browser, from summaries; avoid summing them |
| Returning players | PostHog retention on `game_started`, using persistent anonymous identity |
| End-popup CTA rate | Unique run IDs with `antimattr_clicked` / unique run IDs with `game_ended` |
| Campaign traffic | Destination receives `utm_source=orr-run`, `utm_medium=organic`, `utm_campaign=orr-run-campaign-sep-24` |
| Poster reach | Count unique run IDs for `game_route_point_reached`, filtered to `point_kind=hoarding`; break down by point ID or poster number |
| Bottleneck effects | Compare collision stations, waiting deltas and progress around the three coach queue stations; waiting deltas cover an interval, not an exact per-metre heatmap |
| Performance by device | Percentiles of FPS/frame time, broken down by SDK browser/device and viewport/graphics properties |

Every metric checkpoint has a monotonically increasing `metric_sequence` within its run. For custom exports or warehouse queries, deduplicate by `(run_id, metric_sequence)` before summing deltas. Do not add `game_ended` and `game_run_finished` together: a death emits both for compatibility. Loops do not increase the run count.

## Delivery and limits

Gameplay events are centralized in an isolated bookkeeping class rather than duplicated across React and the engine. No per-frame position/input stream is sent. Metrics are checkpointed before an outbound page departure; urgent capture uses the SDK's sendBeacon transport. Visibility checkpoints preserve recent data even if a later mobile termination never emits pagehide. Back/forward-cache suspension checkpoints but does not close the run.

Delivery remains best-effort: ad blockers, offline exits and force-closed browsers can lose the final partial interval. Treat a start without a terminal event as an incomplete run and use its last checkpoint, not as proof of death. Browser totals are measured since tracking began and are not retroactive. No new user account, GPS access or user-supplied personal information is introduced.

The [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js) supplies identity and transport. Events use your existing configured project. The repository includes the instrumentation and this dashboard recipe; creating saved dashboard panels or verifying ingestion in the PostHog project requires access to that project.
