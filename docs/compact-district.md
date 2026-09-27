> Expanded coast-and-flyover version: see [current implementation](coast-and-flyovers.md). This document records the initial old-town scope.

# Little Chittagong: a compact old-city world

Implemented 27 September 2026. This is an edited, geographically anchored miniature, not a navigation map or an architectural survey.

## Reference and scope

[Jalan KL](https://kl.jalanmalaysia.com/) demonstrates a legible miniature with selective landmarks, a small road network and a playful overview. We borrow the compact exploration model without copying its artwork or making a spherical projection that bends roads and buildings.

The first district covers Cheragi Pahar, DC Hill, Anderkilla, Laldighi and Court Hill. CRB, Patenga, Foy’s Lake and the port remain outside this district: including them would require long, relatively empty connections. They are candidates for separate future districts rather than longer roads on this map.

Real directions and relative locations are retained with a uniform 0.45 horizontal compression. The geographic window is 22.333–22.3465 N, 91.827–91.8395 E. The playable miniature is approximately 579 × 676 world units. Distances reported by in-world routing are miniature distances, not real travel distances; the interface explicitly identifies compression.

## Geographic evidence

Roads and five building footprints use the project's existing OpenStreetMap extracts, retaining original OSM IDs. Sources can be inspected through the landmark panel. This pass does not claim to have refreshed the full OSM extract.

Additional anchors checked against public geographic sources:

| Place | Latitude | Longitude | Source |
| --- | --- | --- | --- |
| Cheragi Pahar | 22.34367 | 91.83368 | [Wikipedia coordinate and cultural context](https://en.wikipedia.org/wiki/Cheragi_Pahar) |
| DC Hill | 22.341944 | 91.831944 | [Wikimedia Commons location](https://commons.wikimedia.org/wiki/Category:DC_Hill,_Chattagram) |
| Laldighi park | 22.33768 | 91.83766 | [OSM node 4635199673 via Mapcarta](https://mapcarta.com/N4635199673) |
| Court Building | 22.33483 | 91.83461 | [OSM node 1329024520 via Mapcarta](https://mapcarta.com/fr/N1329024520) |

The Laldighi anchor is the mapped park point, not a surveyed pond centroid. The pond outline, temple, lamp monument and courthouse models are authored interpretations. [The World Bank transport plan](https://documents1.worldbank.org/curated/en/186591551758329775/pdf/Deliverable-1-Draft-Master-Plan-164-228.pdf) additionally identifies the Jamal Khan/Momin, city corporation and JM Sen/Lal Dighi road junctions. OSM attribution and the ODbL link remain visible in the application.

## Implementation

- A reproducible curation script reads the original extracts without modifying them. It selects primary exploration streets and their anonymous connecting sections, splits boundary exits, retains the connected component, removes excess buildings, and reserves space around authored landmarks.
- Output: 36 connected road sections, 12 named streets plus unnamed connectors, 119 buildings and nine total destinations. The six-stop walk selects the main cultural and historic anchors.
- All geographic conversion, terrain, player motion, roads, vehicles, navigation and minimap use the same compressed coordinate frame. The reverse conversion still returns actual latitude/longitude for source links.
- Terrain now uses a finely tessellated common height function with gentle DC Hill and Court Hill relief. No raw DEM discontinuities are rendered.
- Road segments are tessellated every two units, with round joins and upward winding. Independent quads do not twist at hairpins, duplicate vertices or acute corners.
- Building rings have duplicate closure points removed before roof triangulation, keeping height and vertex arrays aligned.
- Overview fits portrait screens; quick travel avoids long walks. GPS remains opt-in. Blurring/chromatic postprocessing and utility wires are off in this miniature.
- The hidden top of the diorama base is omitted, preventing depth conflicts with the terrain. The overview near/far planes are tightened for precision on portrait screens. Ground shadow reception is disabled; building shadows remain available.

## Rebuild and verification

Run `npm run world:compact` after changing source extracts or curation rules. Run `npm run test:world` and `npm run build` before release. Geometry regression checks cover duplicate points, reversals, acute bends, long segments, upward triangle winding, finite geometry, connected roads, all quest destinations, reachable bounds and geographic round trips.

Known limits: the architectural models are stylized, building collision remains absent as in the original project, and mobile exploration uses orbit/quick travel rather than a touch walking joystick. No live map service or API key is required to load the world. Optional encyclopedia enrichment still requires a network connection. The production build retains the existing large Three.js bundle warning.
