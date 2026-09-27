# Milestone 7 — Polish

**Status:** in progress
**Spec:** §34–35, §22–23, §40–41, §57

## Day/Night cycle (done)

- `src/world/TimeOfDay.ts`: one hour value drives everything. A full day is
  `dayLengthSeconds` (default 480 s); holding **T** fast-forwards.
- Sun arc: direction `(cos θ, sin θ, 0.35)` with `θ = (hour − 6)/12·π`; negative
  height at night.
- Sky/fog retint via `SceneManager.setSky`: day blue → warm sunset → dark night.
- `Lighting.applyTimeOfDay`: sun color/intensity, hemisphere ambient, and shadows
  disable when the key light is off.
- **Moonlight**: at night the key light flips to the opposite direction with a
  cool color and a low intensity, and ambient keeps a navigable floor, so night
  is playable (not pitch black).
- Twilight uses `smoothstep` so sunset isn't an abrupt cliff.
- HUD shows the clock (`HH:MM`).

![day/night](../images/daynight.png)

## Device geolocation (done)

- `src/geography/Geolocation.ts`: `getCurrentLocation()` (one-shot) and
  `watchLocation()` (continuous), plus `insideWorldBounds()`.
- On load the game **starts the player at the device's real location** when it
  falls inside the world bounds; otherwise it falls back to `WORLD_CONFIG.spawn`.
- **L** re-requests location and recenters; **G** toggles live GPS tracking (the
  player follows the device as you move).
- HUD shows a `GPS lat, lon` line; the minimap draws a green GPS marker.

![geolocation](../images/geolocation.png)

## Compact-city polish (2026-09-27)

Vegetation, roadside props, clouds, animated sea/river water and quiet synthesized ambience are implemented. Port cranes, trucks, ships and airport aircraft animate in the existing world. Overview supports mouse exploration and WASD flight.

Night windows use shared emissive uniforms/texture masks; street-lamp heads and subtle ground pools use two instanced batches with no additional point lights. **K** switches day/night, **T** fast-forwards, **P** loads optional effects on demand.

Building/player and follow-camera collision share a static spatial grid. Elevated decks retain the y-aware surface provider and now have solid undersides. Named architecture gains merged entrance, cornice and rooftop details.

Performance: traffic submissions reduced from 204 to 45 by instancing wheels; app/core/effects bundles split. See [current progress](../progress.md) for measurements and limitations.

## Remaining broader work

- Full vehicle physics and collision.
- Device-specific FPS profiling and optional quality settings.
- Large-world streaming only if the compact scope grows.
