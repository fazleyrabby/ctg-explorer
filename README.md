# Little Chittagong

A browser-based 3D miniature of Chattogram (Chittagong), Bangladesh. Walk, cycle or drive from Patenga beach to Bahaddarhat through a compact island version of the city: the port, airport, railway station, flyovers, old-town bazaars and hill quarters, with landmark stories, guided routes and a day/night cycle.

Real-world order, directions and main connections are kept; distances are deliberately compressed and minor streets omitted. It is not a surveyed map.

Built with [Three.js](https://threejs.org/), TypeScript and Vite. No game engine or physics library.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript check |
| `npm run test:world` | World regression checks (roads, clearances, collision, quests, saves) |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build |

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move / run | WASD, Shift | Joystick; push to the rim to run |
| Look / zoom | Drag, wheel | Drag, pinch |
| Jump (handbrake while riding) | Space | Jump |
| Summon car / bicycle, ride | C / B, F | Car / Bike, Ride |
| Read about a landmark | E | Explore |
| History Notebook | H | Notes |
| Overview | O | Walk / Overview button |
| Search and route | / | — |
| Map, big map | Tab, N | Tap the map to travel |
| Time, day/night | T (hold), K | — |
| Locate, live GPS | L, G | — |
| Post-effects, mute | P, M | — |

In overview: drag to pan, right-drag to orbit, scroll to zoom, WASD to fly, double-click to walk there.

Discoveries, the chosen route and the quality preset are saved in the browser. Use **Reset progress** in the History Notebook to start again.

## Project layout

```
src/core        game loop, renderer, save data, quality presets
src/world       terrain, roads, buildings, shop rows, port, airport, railway, traffic
src/geography   projection, shoreline and reserved-parcel layouts
src/player      input, controller, avatar
src/vehicles    car and bicycle
src/quests      guided routes
src/ui          HUD, minimap, notebook, search, touch controls
scripts         OSM/DEM fetch and curation, world regression checks
public/world    generated world data served to the browser
docs            decisions (ADRs), milestones, progress, build log
```

World data is regenerated with the `world:*` scripts; the generated files in `public/world` are committed. See [docs/README.md](docs/README.md) for the engineering record and [docs/progress.md](docs/progress.md) for current status and known limits.

## Data and credits

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Elevation from Copernicus DEM. Landmark summaries are loaded from Wikipedia/Wikidata at runtime. Sources and licences are listed in [docs/references.md](docs/references.md).
