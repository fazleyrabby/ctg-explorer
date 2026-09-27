# Road verification — 2026-09-27

Verdict: a connected, map-derived miniature, not a geographically faithful road network.

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

## Recommended correction order

1. Replace the authored Bahaddarhat–Shah Amanat Bridge approach and airport access with selected real surface-road geometry.
2. Separate surface roads from elevated alignments instead of duplicating the flyover path at ground level.
3. Use real junctions for the nine authored links; keep compression and omit minor streets to retain compact exploration.
4. Preserve road direction and road level in routing if realistic driving is desired.

No road geometry was changed during this verification.
