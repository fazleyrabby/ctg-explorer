# Little Chittagong: coast and flyovers

The world now connects Patenga, the old city, Lalkhan Bazar, Muradpur, Bahaddarhat and Shah Amanat Bridge. Four elevated structures use OpenStreetMap alignments, with simplified piers, rails, ramps and moving traffic. The original main character GLB is retained. Buildings, shops, beach umbrellas, palms, boats, walkers and vehicles use a brighter palette.

## Exploring

Overview starts with the whole miniature. Left-drag pans anywhere within its bounds; the wheel zooms from the whole city down to street detail. Right-drag or Shift-drag rotates. Double-click the ground to enter walking mode. The destination menu offers 14 places and Visit Patenga opens a beach view.

## Scale and accuracy

The old-town core keeps 45% of geographic distance, while outer routes use 5.5%, continuously and reversibly. This produces a roughly 1.17 × 1.61 km miniature with 45 connected ground-road sections. This is a curated interpretation, not a navigation map. Ground corridors beneath elevated routes and the short connections to the old city are simplified. Coast and river banks are generalized. Elevated decks currently carry scenic traffic; the player explores the ground routes.

## Research and provenance

- [CDA elevated expressway project](https://cda.gov.bd/pages/static-pages/6922df70933eb65569e22006): Lalkhan Bazar–Shah Amanat Airport corridor.
- [Akhtaruzzaman flyover project](https://www.maxgroup-bd.com/com-flyover-project-number-1): Muradpur–Gate No. 2–Lalkhan Bazar corridor.
- [Patenga location](https://mapcarta.com/N5152958986), [Shah Amanat Bridge](https://mapcarta.com/25173604), [Bahaddarhat](https://mapcarta.com/N12169804566).
- `data/city/elevated-osm.json` preserves the Overpass response; its source timestamp is 2026-05-31. Expressway ways: 1075414974, 1353155839, 1320233255, 1353155840. Akhtaruzzaman: 532877130. Bahaddarhat: 377616152. Shah Amanat Bridge: 133794971. Parallel carriageways are combined/simplified for exploration.
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL attribution remains visible in the app.
- [Jalan Malaysia](https://kl.jalanmalaysia.com/) inspired the compact world.
- [Poseidon Ocean](https://art.fazleyrabbi.xyz/webgpu/poseidon-ocean) inspired layered waves, Fresnel sky reflection and sun glints. The implementation uses a mesh shader compatible with the existing Three.js renderer, rather than replacing the world with a full-screen raymarched scene. Stronger wave detail is restricted to open ocean, fading between 15 and 85 miniature metres offshore; river and coastal water stay subtle. Shore foam fades with distance from land; fine ripples fade when zoomed out to reduce aliasing.

## Validation

`npm run build` validates TypeScript and production compilation. `npm run test:world` checks connected roads, destination bounds, reversible geographic compression, road winding and height, elevated structures, overview panning and the beach geometry merge regression. Browser checks cover beach rendering and mouse exploration. The production build retains Vite's bundle-size advisory.

## Neighborhood expansion

Added 232 decorative buildings and 460 broadleaf trees, using cream, sand, sage, clay and blue-gray walls. Infill includes windows on all sides, balconies, awnings, setbacks and rooftop tanks. These are authored neighborhood scenery, not additional mapped real buildings. Road and existing-footprint clearances are checked before placement.

The 48-section road network includes explicit links between the expressway, Akhtaruzzaman and Bahaddarhat corridors, plus airport access and the New Bridge approach. Ground corridors are wider so they remain visible alongside the elevated decks. A compact terminal marker and looping decorative aircraft add airport activity; these are not real-time flights.

The corridor sequence is informed by the [Chittagong Strategic Urban Transport Master Plan](https://documents1.worldbank.org/curated/en/186591551758329775/pdf/Deliverable-1-Draft-Master-Plan-164-228.pdf), including Airport Road, Sheikh Mujib Road, Tigerpass, CDA Avenue, Bahaddarhat and the New Bridge approach. The miniature preserves the overall connections while simplifying junctions and distances; it is not a road-by-road surveyed replica.

## Jalan KL visual study

The live reference was inspected at both its globe introduction and playable street view. The useful visual cues were cream sidewalks against dark blue-gray roads, saturated but coordinated roofs and facades, multi-lobed trees, shop awnings, distinct landmark silhouettes and light-filled shaded surfaces. This pass applies those cues through brighter neutral sky fill, a controlled five-color facade palette, terracotta/teal pitched roofs, wider cream pavements, striped awnings, flower beds and soft contact patches. The original player model and subtle river water are preserved.

[Jalan KL's published performance report](https://kl.jalanmalaysia.com/performance/) describes authored GLB assets, shared vegetation, streamed districts and Three.js post-processing. The report labels its integrated branch a review candidate, so its documented renderer settings are not treated as verified settings of the live scene. Chittagong continues to use its own geometry and assets; no Jalan KL artwork is copied.

## Filling the empty districts

A separate instanced scenery layer now fills the broad undeveloped areas with compact building parcels and planted courtyards. These are decorative miniature neighborhoods, not surveyed real buildings or extra long road routes. Placement excludes the main roads, water, existing footprints, trees and landmark parks. Both riverbanks receive short promenade sections, benches and planting; the river corners are rounded while retaining the bridge anchor. Instancing batches the new building parts into a small number of draw calls.

## Ocean motion at overview distance

Large, warped travelling swells now remain visible when zoomed out, while only the fine ripples fade with distance. The water surrounding the map receives rolling blue/teal variation, animated reflections and sparse broken whitecaps. Strong motion blends down toward shore and inside the river. This fixes the earlier overview cutoff that flattened all wave normals at long camera distances.

## Quiet sound mix

The crowded street recording is no longer loaded or played. Ambience is a quiet filtered wind bed with a slow coastal wash that increases near the sea. Overview and nighttime reduce the mix further. Footsteps are shorter and quieter, with a minimum interval to prevent overlapping bursts and automatic node cleanup. Background tabs fade to silence; U still toggles mute.
