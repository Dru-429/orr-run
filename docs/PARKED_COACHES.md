# Parked tourist coaches

Ten game-added tourist coaches block the leftmost ORR lane: three at Ibbalur Lake, three in Bellandur and four before Marathahalli. These are gameplay scenarios, not claims of surveyed bus parking.

The queues begin at rear-bumper stations 5,300 m, 6,000 m and 10,189.844314349493 m. The last location is derived as 500 m before the Marathahalli underpass descent. Each coach is 10.8 × 2.55 m with 2 m gaps. All face the direction of travel and remain stationary across impacts, horns, restarts and loops.

A separate shared tourist template uses cream paint, continuous dark windows, teal trim and VOLVO panels above the front and rear windows. Moving city buses keep BMTC branding. Ten fixed clones use the existing scenery chunk visibility range and release their shared resources only on engine disposal.

The same placement records supply collision bodies, traffic following gaps, merge reservations, spawn checks and navigation summaries. Traffic seeks a safe adjacent lane within 80 m, otherwise braking into a queue until space opens. Close followers in the lane being vacated cannot veto a safe escape; closing-speed reservations still protect the destination lane. Waiting traffic can recognize the coaches as silent horn blockers. Tourist coaches never respond to the horn, gesture, move, or award overtakes. Player hits retain the existing quarter-strength damage, eight-point cap and sustained-contact protection.

Automated scenarios cover all six moving vehicle kinds at all three queues, a blocked merge that later clears, dense competing merges with fast adjacent traffic, collisions and contact persistence, spawn/recycle clearance, route-relative positioning and navigation congestion. Template checks verify front/rear lettering orientation, absence of BMTC on tourist coaches, shared geometry/materials/textures and single disposal. Visual and performance results are recorded in QUALITY.md.
