# Chattogram explorer — current progress

Updated 2026-10-02. The compact miniature has 27 destinations (28 notebook entries including the port) and 48 connected road sections; distances are deliberately compressed.

## Design priority

Keep exploration compact, following the Jalan Malaysia concept. Preserve the real-world relative order, general directions and main connections of places and roads; compress distances, simplify bends and omit minor streets. Do not enlarge the playable area to reproduce a one-to-one map. Check authored connections for geographic plausibility and visual clearance rather than exact surveying accuracy.

## Available now

- Walk, run, jump, summon and ride a car or bicycle; original character retained.
- Continuous airport–Patenga–city–Bahaddarhat route, Shah Amanat Bridge, and four elevated structures with smooth, y-aware walkable/rideable decks.
- Chittagong Port: cargo ships, speedboats, warehouses, container stacks, animated cranes and yard trucks, walkable apron.
- Chattogram Railway Station: reserved compact rail parcel, two tracks with sleepers and buffer stops, covered platforms, ticket hall, benches and two animated three-car trains with dwell pauses. Layout is compressed and shifted to the nearest clear parcel; station anchor reference: https://mapcarta.com/W1075277515.
- Shah Amanat Airport: runway, terminal and planes following a flight loop.
- Existing authored districts: Agrabad, GEC, New Market, Chawkbazar, CRB, Foy’s Lake, Nasirabad, Khulshi, Pahartali, Khatunganj and CMCH.
- Rounded island outline within the existing bounds, a flat navigable interior, no rectangular terrain skirt, and a distant ocean-to-sky fade. Overview framing fits the whole island.
- Animated coastal water, subtle river water, vegetation, clouds, pedestrians and traffic.
- Overview mouse exploration and WASD flight; minimap, large map, travel, search, routing, quests and History Notebook.
- Day/night cycle, subtle synthesized city/sea ambience and mute controls.
- Homelab visitor counter: `chattogram` at `https://views.fazleyrabbi.xyz`; localhost does not increment visits.

## This polish pass

- Shared spatial collision grid for mapped buildings, procedural neighborhoods, important buildings and port warehouses. On-foot movement slides along walls; feet above roofs bypass the footprint.
- Follow-camera obstruction checks run after smoothing, pull in immediately, and raise the boom near walls while retaining the minimum orbit distance and terrain clearance.
- Solid flyover undersides and edge thickness, visible from walking view. Continuous cross-section strips replace overlapping ground-road joins; Bahaddarhat has a lower deck and longer approaches. Shops, palms and utility poles reserve clearance around elevated roads.
- Warm window emission and instanced street-lamp heads/pools after dark. **K** toggles day/night; **T** still accelerates time.
- Named buildings gain entrance recesses, cornices, rooftop service volumes, tanks and antennae within existing merged meshes.
- Traffic wheels share one instanced batch: **204 → 45 traffic draw batches**, 159 fewer (78%). This is a geometry submission count, not a measured FPS claim.
- Post-processing loads on first **P** press. Production JS is split into approximately 192 kB app, 569 kB Three core and 112 kB optional effects (minified). Three core still exceeds Vite’s default 500 kB warning; the warning is not suppressed.

## Update 2026-10-02

- **Old-town shop rows.** 24 attached runs (93 shops, 8 corner tea stalls) along ordinary streets around Chawkbazar, Anderkilla and Khatunganj: two to four storeys, varied widths, terracotta/teal gables or parapets with water tanks, awnings, shutters, sign bands and balconies. Parcels are reserved before infill (ADR-0028) and the whole set is one merged draw.
- **Saved progress.** Discoveries, the chosen route and the quality preset persist in `localStorage`. The History Notebook has a **Reset progress** button.
- **Four routes.** A picker in the quest tracker switches between *From the sea to the city*, *Old town bazaars*, *Rails, trade and the port* and *Hills and northern quarters*. A visited place counts for every route that includes it.
- **Touch controls.** On touch devices a joystick (push to the rim to run) and Jump / Ride / Car / Bike / Explore / Notes buttons appear in walking view; drag looks around and a two-finger pinch zooms.
- **Quality presets.** Low / Medium / High set the pixel-ratio cap (1 / 1.5 / 2), sun shadows (off / 1024 / 2048) and ambient crowd density (40% / 70% / 100%). Touch devices start on Medium. A live FPS readout sits beside the control; no device-specific frame-rate figures are claimed.
- **Vehicle collision.** Cars and bicycles slide along building walls and lose speed on a head-on hit; vehicles are never summoned inside a wall. Mapped buildings now collide on their real outline instead of a bounding box, which also removes the invisible corners that used to block streets on foot.
- **Housekeeping.** Root `README.md`, a GitHub Actions workflow running typecheck, world tests and the production build, and the minimap now refits on window resize.

## Verification and limits

Run `npm run typecheck`, `npm run test:world`, and `npm run build`. Regression checks cover graph connectivity, compact bounds, shore geometry, elevated structures, procedural density, collision stability, roof clearance, camera obstruction, traffic batching, shop-row clearances, vehicle wall sliding, drivable road centrelines, quest stops, save/reload/reset and touch input.

Authored and procedural buildings still collide as conservative axis-aligned boxes, so a rotated facade can block slightly beyond what is drawn; mapped buildings use their outline. The camera occlusion test uses boxes for every building. Vehicles have no collision with each other, traffic or props, and no physics beyond the arcade model. Touch controls and quality presets were checked in a desktop browser's phone emulation, not on physical devices. Large-scale streaming remains deferred for this deliberately compact world.
