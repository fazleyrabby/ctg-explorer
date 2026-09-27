# Chattogram explorer — current progress

Updated 2026-09-27. The compact miniature has 26 destinations and 48 connected road segments; distances are deliberately compressed.

## Available now

- Walk, run, jump, summon and ride a car or bicycle; original character retained.
- Continuous airport–Patenga–city–Bahaddarhat route, Shah Amanat Bridge, and four elevated structures with smooth, y-aware walkable/rideable decks.
- Chittagong Port: cargo ships, speedboats, warehouses, container stacks, animated cranes and yard trucks, walkable apron.
- Shah Amanat Airport: runway, terminal and planes following a flight loop.
- Existing authored districts: Agrabad, GEC, New Market, Chawkbazar, CRB, Foy’s Lake, Nasirabad, Khulshi, Pahartali, Khatunganj and CMCH.
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

## Verification and limits

Run `npm run typecheck`, `npm run test:world`, and `npm run build`. Regression checks cover graph connectivity, compact bounds, shore geometry, elevated structures, procedural density, collision stability, roof clearance, camera obstruction and traffic batching.

Collision uses conservative axis-aligned building boxes, so rotated corners can block slightly beyond the visible facade. Vehicle collision with buildings and full physics are outside this pass. Large-scale streaming remains deferred for this deliberately compact world.
