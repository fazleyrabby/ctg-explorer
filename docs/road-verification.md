# Road verification — 2026-09-27

Verdict: a connected, map-derived miniature. The owner confirmed that compact exploration takes priority over exact map geometry. Verification should focus on recognizable relative geography and meaningful road connections, not real distances or every street.

## Verified against checked-in source data

- All 479 vertices across the 36 `way/*` ground sections exactly match their source vertices after the current projection (maximum difference: 0 world units). These are clipped/selected streets, not the complete city network.
- All vertices of the four elevated alignments match projected vertices from their listed OSM ways (maximum difference: 0). Elevated snapshot timestamp: 2026-05-31T22:37:44Z. Matching vertices does not independently validate joins, source completeness or current access restrictions.
- The 12 remaining ground sections comprise three surface corridors copied from elevated alignments and nine authored links/approaches/access routes. These are not independently sourced surface roads.
- `curate-city.ts` draws the Shah Amanat Bridge approach with six selected points and inserts nearest-point district links, end-to-end main links, beach access and airport access.
- Projection scales the old town by 0.45 and outer areas by 0.055, independently on latitude and longitude. Distances and some angles/proportions are deliberately distorted.
- RoadGraph inserts edges in both directions, ignoring OSM one-way restrictions. Elevated paths are not separately routed. Visual crossings are not necessarily graph junctions.
- Flyover widths, rises, ramp grades and supports are authored. The lower Bahaddarhat deck fixed the visual hump but is not a measured engineering profile.

## External cross-check

CDA describes the Lalkhan Bazar–Shah Amanat Airport elevated expressway project and its 16.50 km design length:
https://cda.gov.bd/pages/static-pages/6922df70933eb65569e22006

This supports the broad corridor, not every access ramp or the surface alignment used in the game. Live OSM way pages could not be retrieved during this audit; current node-by-node agreement and current ramp access remain unverified.

## Agreed design direction

Keep the current compact footprint, inspired by Jalan Malaysia’s selective exploration model. Do not expand the world or reproduce every OSM/Google Maps road to improve accuracy.

- Preserve the general direction and relative order of important places, coast, river, port, airport and city districts.
- Preserve the main connections and recognizable junction relationships. Shorten, straighten or simplify intermediate roads as needed.
- Keep bridges crossing the appropriate waterway and flyovers connecting the appropriate corridors; avoid misleading shortcuts that suggest unrelated districts are adjacent.
- Allow nearby landmark placement adjustments for clear, attractive parcels. Avoid roads, water, buildings and props overlapping.
- Omit minor streets, redundant carriageways and long empty stretches. Exact widths, distances, ramp profiles and traffic restrictions are not requirements for this exploration world.
- Use real-map evidence to check relationships; synthetic geometry alone is not a defect. Review the authored New Bridge approach, airport access and district links against these criteria before deciding whether they need changes.

The earlier recommendation to replace every authored connector with source geometry is superseded by this clarification. No road geometry or world bounds were changed during this verification or clarification.
