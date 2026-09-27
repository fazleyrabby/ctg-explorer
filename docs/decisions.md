# Architecture Decision Records

## ADR-0001 — Core stack

**Status:** Accepted

**Decision**

- **TypeScript (strict)** + **Vite** — matches spec §47/§79.
- **Three.js** (WebGL2) owns the render loop.
- **React is optional and deferred.** Milestone 1 uses plain DOM for the HUD so the
  game loop stays dependency-free. React can be introduced later for menus/panels
  only; it must never drive the render loop (§47).
- **No physics engine in Milestone 1.** The player uses a small custom
  gravity/ground controller against the procedural surface. A lightweight engine
  (Rapier, §48) is evaluated when real terrain/buildings arrive (Milestone 2/4).

**Rationale**

Keep M1 dependency-light to prove the loop, projection, and camera before adding
WASM physics or a UI framework.

**Alternatives considered**

- React now — rejected for M1: adds build surface for no gameplay value.
- Rapier now — deferred: no collidable terrain/buildings exist yet.

---

## ADR-0002 — Local coordinate projection

**Status:** Accepted (MVP)

**Decision**

WGS84 lat/lon → local metric frame centered on `WORLD_CONFIG.origin`, using a
local equirectangular approximation (`src/geography/Projection.ts`).

**Rationale**

City-scale accuracy is sufficient, the transform is deterministic and
dependency-free, and call sites only depend on the `LocalPoint` interface. A full
projection (`proj4`, UTM 46N) can replace the implementation later without
touching consumers.

**Alternatives considered**

- `proj4` UTM 46N now — more accurate over the full district, but unnecessary for
  the MVP corridor and adds a dependency.
- Raw lat/lon as Three.js coordinates — rejected (spec §6).

---

## ADR-0003 — Curved world presentation

**Status:** Accepted (MVP)

**Decision**

The "miniature globe" is a **paraboloid approximation** of a large sphere:
`y = -(x² + z²) / (2·radius)`, with `radius` configurable and far smaller than
Earth (default 50,000 m).

**Rationale**

Gives a subtle curved horizon and readable roads while keeping buildings upright
and movement natural (spec §5). Buildings stay axis-up; only the ground drops.

**Alternatives considered**

- Literal Earth radius — curve invisible at city scale.
- True sphere-cap mesh — more complex terrain overlap; revisit if needed.

---

## ADR-0004 — Browser world format (planned)

**Status:** Proposed — decided before Milestone 2

**Decision**

Emit **glTF/GLB per chunk** + JSON metadata, instead of raw GeoJSON or a custom
binary blob.

**Rationale**

Three.js `GLTFLoader` is native, geometry is GPU-ready, and **Meshopt/Draco** and
**KTX2** compression apply directly. Metadata stays in JSON for POIs, labels, and
the minimap.

**Alternatives considered**

- FlatBuffers/msgpack custom binary — more control, more tooling, less ecosystem.
- GeoJSON at runtime — too heavy to parse every load (spec §8 forbids runtime OSM).

---

## ADR-0005 — Minimap is MVP-core

**Status:** Accepted (spec updated §55)

**Decision**

Promote the minimap from optional to MVP. It reuses generated world vectors
(roads/water/landmarks), renders with **Canvas2D** outside the render loop, and
supports a toggle (M).

**Rationale**

Orientation is core to a free-roam exploration/learning tool.

---

## ADR-0006 — Educational layer

**Status:** Accepted (spec §33a added)

**Decision**

Add a learning layer: curated landmark content plus Wikipedia/Wikidata/Commons
enrichment, a discovery log, and a persistent accuracy/attribution disclaimer.

**Rationale**

The project doubles as an educational tool; framing stays "geographically based
on real Chattogram data," never "exact replica."

---

## ADR-0007 — Scope is a compact district (revised)

**Status:** Accepted (revised)

**Decision**

The world is a **compact district** around Cheragi Pahar — bounds
`22.333–22.355 N, 91.823–91.845 E` (~2.3 × 2.4 km), origin at the centre
(`22.344, 91.834`), spawn unchanged (`22.3437, 91.8336`). Terrain, roads and
buildings are all generated for exactly these bounds.

**Rationale (revised)**

Original decision was "Chittagong city, not the district" (~16 × 20 km). Walking
a world that large is tedious and it had no extra value for the MVP — the
"little city" framing (Jalan KL) wanted a small, dense, roam-able space. The
district contains the whole buildings dataset plus a green margin; the player is
kept inside it (ADR-0018).

**Important**

When the origin/bounds change, **all** generators must be re-run together
(`world:dem`, `world:roads`, `world:buildings`) — they each project with
`WORLD_CONFIG.origin`, so a mismatch offsets the layers (this bit us once).

**Alternatives considered**

- Whole-district / whole-city bbox — rejected: unwieldy to roam, heavy data.

---

## ADR-0008 — Avatar: Blender GLB with procedural fallback

**Status:** Accepted

**Decision**

Author the player avatar in Blender (`scripts/blender/build_character.py`) and
export `public/models/character.glb`. The GLB exposes named joint nodes
(`JointTorso`, `JointHead`, `JointArmL/R`, `JointLegL/R`); `GltfAvatar` animates
those nodes. `PlayerModel` remains a procedural fallback if the GLB fails to
load, behind the shared `PlayerAvatar` interface. The avatar is **static at
rest** and animates only in response to input.

**Rationale**

Better-looking hero asset without adding a runtime dependency, and the joint-node
approach keeps animation identical between both avatars. Matches the spec's
stylized (not photoreal) target.

**Notes**

- Blender is Z-up; the exporter converts to Y-up. The model faces -Y in Blender
  (= +Z in-game).
- Do **not** overwrite joint `position` from JS — offset bobs from the joint's
  base value (a bug where `JointTorso.y` (0.92) was overwritten and collapsed the
  body).

**Alternatives considered**

- Fully rigged armature + baked animation clips — unnecessary for M2/M3; revisit
  if richer animation is needed.
- Third-party rigged avatar (Mixamo) — deferred.

---

## ADR-0020 — Globe overview camera

**Status:** Accepted

**Decision**

**O** detaches the camera into a "globe overview": it orbits the district centre
at ~1.25 km, drag rotates, wheel zooms, and **clicking the ground raycasts to the
terrain, travels the player there, and returns to follow**. Fog is extended
(9000) while in overview and restored (3600) on exit. The post stack is made
camera-aware (`PostFX.setCamera`) so the composer follows the active camera.

**Rationale**

Matches the reference's overview/globe mode and makes the small world legible at
a glance — a "little city" you can spin and jump into. Chosen over turning the
play space into a literal sphere, which breaks movement and routing.

**Gotcha**

`RenderPass`/`GTAOPass` capture the camera at construction; swapping the render
camera requires updating them (this is why the first overview attempt rendered
the follow camera).

---

## ADR-0018 — Invisible walls (clamp to district)

**Status:** Accepted

**Decision**

Player movement, driving and map teleports are clamped to the district bounds
with an inset margin (`clampToWorld`, margin ~120 m for the player, 110 m for
vehicles). Beyond the terrain there is nothing to stand on.

**Rationale**

With a small world it is trivial to walk off the edge into the void (a black/
grey gap under the fog). Invisible walls keep play on real terrain. A soft edge
skirt could be added later, but the clamp is the simplest correct fix.

---

## ADR-0019 — Search + road routing

**Status:** Accepted

**Decision**

A search box (slash key) over landmark names and named roads; selecting a result
sets a destination. `RoadGraph` builds a routable graph from the major-road
polylines (vertices merged by 1 m rounding) and `RoadGraph.route` runs Dijkstra
from the player's nearest node to the destination's. `Navigation` renders the
path as a glowing draped ribbon, a flag marker, a HUD distance, and a route
polyline on the minimap. No path (disconnected crossing) falls back to a
straight line.

**Rationale**

Real route guidance without a full routing engine. Reuses existing road data.
Crossings that share no OSM node remain disconnected — acceptable at this scale.

---

## ADR-0017 — Discovery-driven quests

**Status:** Accepted

**Decision**

Quests are ordered lists of landmark names. **Discovery** (walking within 34 m of
a named building, handled in `LandmarkManager`) records the place in the notebook
and completes it if it is a quest stop — no separate "accept quest" step and no
per-frame distance checks scattered elsewhere. One world beacon, a HUD tracker
and a minimap marker render the single current objective.

**Rationale**

Simplest system that yields the Jalan KL experience: reaching a place *is* the
action. Keeps quest state in one place and reuses the existing named-building
data. Easy to extend to multiple quests and story tabs.

---

## ADR-0016 — Map is interactive (click to travel)

**Status:** Accepted

**Decision**

The minimap is clickable: clicking a named pin teleports the player to that
landmark, and clicking elsewhere travels to that world point (inverse-mapped
through the same crop transform). **N** enlarges the map (240 → 640 px, 520 →
1500 m) for easier picking. The camera snaps after a teleport; a mounted vehicle
is dismounted first.

**Rationale**

Directly inspired by Jalan KL's "tap a pin → Go here" visitor map. Makes a small
world feel navigable without walking everywhere, and reuses the minimap's
existing crop/scale math — no extra data or systems.

---

## ADR-0015 — Post-processing stack for the "premium" look

**Status:** Accepted

**Decision**

Render through an effect composer (`src/rendering/PostFX.ts`): RenderPass → GTAO
(ground-truth ambient occlusion) → UnrealBloom → a custom grade pass
(chromatic aberration, miniature tilt-shift blur, saturation/contrast, vignette)
→ SMAA → OutputPass (ACES tone mapping). Toggle with **P**; falls back to direct
rendering if the composer fails to initialise.

**Rationale**

The gap between "blockout" and "amazing" is mostly post-processing and art
direction, not geometry (see the Jalan KL comparison in `references.md`).
GTAO in particular grounds buildings so they stop reading as floating boxes.
Budget: ~58 FPS with the stack on. A quality preset can drop AO/bloom on weaker
GPUs later.

**Alternatives considered**

- pmndrs `postprocessing` — good, but three's built-in passes (GTAO, UnrealBloom,
  SMAA, Output) covered the need without another dependency.

---

## ADR-0014 — City life is instanced ambience, not simulation

**Status:** Accepted

**Decision**

Roadside props, pedestrians and traffic are **instanced ambience**, not AI:
utility poles + sagging cables and street trees (`StreetProps`, InstancedMesh),
~90 pedestrians walking road sidewalks (`Pedestrians`), and ~50 cars / CNG
auto-rickshaws / cycle rickshaws looping along the major roads (`Traffic`) — each
vehicle type one InstancedMesh with per-instance colour. City sound is
synthesized in `AudioManager` (traffic hum + random horns/birds, day/night
scaled).

**Rationale**

Spec §41–43, §57 and §23 want a lived-in city without simulation cost. Path
following + instancing gives the crowd feel at 60 FPS; skeletal pedestrians and
real traffic AI are out of scope.

**Notes**

Stylised/cartoonish per the owner's direction — detail without realism.

---

## ADR-0013 — Named buildings get a procedural detail pass

**Status:** Accepted

**Decision**

Named (authentic) buildings keep their OSM footprint and estimated height, but
gain extra architecture from `src/world/LandmarkDetails.ts`, inspired by their
real typology: a plinth and cornice for all; **religious** buildings get a
drummed dome, finial, four corner minarets and an arched portal; **civic /
commercial / educational** buildings get a colonnaded portico with a roof slab.

**Rationale**

Spec §16 says important buildings should not rely solely on procedural
extrusion, and §76–77 asks for "geographically based," stylised results — not
literal replicas. A type-inspired procedural pass scales to all 38 named
buildings immediately, and keeps the pipeline data-driven.

**Alternatives / next step**

Hand-authoring GLB hero models in Blender (still available) gives real
per-building fidelity for the most iconic few; the procedural pass remains the
fallback and the base shell. This is the intended follow-up for a curated set.

---

## ADR-0011 — Day/night is a single time value

**Status:** Accepted

**Decision**

One hour value in `TimeOfDay` drives sun direction, sky/fog color, light color
and intensity. No astronomical simulation. Night uses a cool low-intensity key
light (moon) in the opposite direction plus an ambient floor, so it stays
navigable.

**Rationale**

Spec §34 asks for a simple time-of-day, not an ephemeris. Keeping every value
derived from one number makes the cycle trivial to tune and test (set
`timeOfDay.hours`).

---

## ADR-0012 — Device geolocation drives the spawn

**Status:** Accepted

**Decision**

On load, request the device position (browser Geolocation API). If it is inside
`WORLD_CONFIG.bounds`, spawn the player there and mark it on the minimap;
otherwise fall back to the configured spawn. **L** re-requests, **G** toggles
live tracking (`watchPosition`).

**Rationale**

"Start from my own location" is a natural fit for a real-geography world.
Falls back gracefully when permission is denied or the device is outside
Chattogram. Requires a secure context (localhost/HTTPS).

**Notes**

The initial request is non-blocking: the default spawn happens first, then the
player is moved to the device location if available.

---

## ADR-0010 — Summonable vehicles (stretch feature)

**Status:** Accepted

**Decision**

Add a simple **car** and **bicycle**, summoned instantly with **C** / **B** and
ridden with **F** (mount/dismount). Procedural meshes, arcade model:
W/S accelerate/brake-reverse, A/D steer (steering scales with speed). While
riding, the camera trails the vehicle heading so W reads as forward, and the
avatar stays visible (`VehicleManager.syncRider`). `VehicleManager` owns
summon/mount/drive; `Vehicle` owns the mesh + physics.

**Rationale**

Spec lists vehicles as an explicit MVP non-goal (§74) and a stretch/future
feature (§42, §75); this is an optional gameplay layer on top of the core
exploration, isolated from the player controller.

**Notes**

- First pass reversed the controls (forward was relative to the vehicle's stale
  facing) and hid the avatar; both fixed. Heading on mount = camera yaw + π.
- The rider has no seated pose yet, so it overlaps the vehicle — polish later.

**Alternatives considered**

- Blender-authored vehicle GLBs — deferred; procedural is enough to prove it.

---

## ADR-0009 — Audio via a single WebAudio bus

**Status:** Accepted

**Decision**

All sound routes through `AudioManager` (one `AudioContext` + master gain).
Footsteps are **synthesized** (filtered noise burst with an envelope) — no asset
files yet. The context is created/resumed on the first user gesture (browser
autoplay policy). A mute/toggle API exists.

**Rationale**

A single bus keeps future layers — city ambience, birds, traffic, environmental
loops (spec §57) — consistent and easy to mix. Synthesized footsteps avoid asset
licensing and load cost for the first audio pass; sample-based footsteps can be
added later behind the same API.

**Update (ambience is now a real recording).** The synthesized hum "sounded
static", so ambience is a **real street recording** — "Sounds of Traffic and
Sellers" (Ready Street, Wikimedia Commons, **CC BY-SA 4.0**) — trimmed to a 90 s
mono loop (`public/audio/ambience-street.ogg`, ~694 KB) via ffmpeg, low-passed
and kept **subtle** (gain ~0.09 day / 0.05 night). Synthesized ambience remains
the fallback if decoding fails. Randomized synth horns/birds were removed (they
sounded artificial). **U** mutes. Footsteps stay synthesized.

**Alternatives considered**

- HTMLAudio/asset files now — licensing + load overhead for little gain yet.
- Third-party audio engine — unnecessary for this scope.

---

## ADR-0021 — Resample the DEM ourselves (don't trust `readRasters` bbox)

**Status:** Accepted

**Decision**

`scripts/fetch-dem.ts` reads the Copernicus GLO-30 COG as a **native-resolution
pixel window** (`{ window }`) and does its own area-average (box filter) downsample
to the target grid. It no longer calls `readRasters({ bbox, width, height })`.

**Rationale**

The bbox-resampling path on this COG silently mis-samples. For the compact
district it returned a **bogus ~455 m ridge along the NE edge** (real elevation
there is ~5 m), which rendered as a wall of sharp "shark-fin" mountains and made
the whole valley look like steep hills. The fake slopes also stretched buildings
and road ribbons draped on them (dark patches / "squished" look). Reading the
native window and resampling ourselves gives the true range for the district:
**1.07 … 58.27 m** (was −0.8 … 455.7 m). Verified against Open-Meteo
(Copernicus GLO-90) point queries, which also report ~3–36 m across the box.

**Gotcha**

The same root cause can hide behind the original city-wide box: a 543 m max was
recorded in M2 for the much larger footprint, so a high maximum alone is not
proof of a bug — check it against an independent elevation source.

**Update (road tone).** With real slopes gone, the remaining "black hole" at
Cheragi Pahar was the asphalt of a dense junction at a grazing camera angle,
crushed further by the vignette/contrast grade. Asphalt is now a mid slate-grey
(`0x51515a`).

**Update (road winding).** The bigger cause of that black patch was the road
ribbon **winding**: `addRibbon` emitted triangles whose normals all pointed
**down** (−Y). GTAO reads the normal buffer, so every road was treated as fully
occluded and shaded to black — boosting ambient did nothing. Reversed the index
order (`a, c, b, b, c, d`) so road normals face up; GTAO now leaves roads alone.

**Alternatives considered**

- Keep bbox resampling and clamp outliers — masks the bug, keeps wrong heights.
- Switch DEM source — Copernicus is fine; the bug was in *how* we read it.


## ADR-0022 — Shared building collision grid and solid elevated decks

Keep one spatial grid built at load from mapped footprints and authored structure boxes. On-foot circle push-out respects building vertical extents, allowing roofs and flyovers above lower structures. The camera uses the same boxes after smoothing, with immediate pull-in and an elevated fallback near tall walls. Conservative AABBs trade exact rotated corners for cheap queries. Deck collision remains the existing y-aware height provider; closed concrete slabs fix missing undersides visually.

## ADR-0023 — Night lights without per-building point lights

Use a shared emission uniform for baked/instanced window colors, an emissive window mask for mapped facades, and instanced lamp heads/ground pools. Day/night drives all three without cloning materials each frame. K is an explicit day/night preview control. Important buildings retain merged geometry for new entrances, cornices and rooftop equipment.

## ADR-0024 — Instance traffic wheels and defer optional effects

Keep all 44 ambient vehicle bodies and motion paths. Replace individual wheel meshes with one shared instanced batch, reducing traffic geometry submissions from 204 to 45. Load PostFX only when P first enables it; split the reusable Three core from application code. The remaining core-size warning is reported rather than hidden. No FPS uplift is claimed without device-specific profiling.
