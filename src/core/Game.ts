import {UrbanFabric} from '@/world/UrbanFabric';
import {Neighborhoods} from '@/world/Neighborhoods';
import * as THREE from "three";
import { Renderer } from "@/core/Renderer";
import { SceneManager } from "@/core/SceneManager";
import { Atmosphere } from "@/world/Atmosphere";
import { CityStructures } from "@/world/CityStructures";
import { CityLife } from "@/world/CityLife";
import { shoreDistance, coastX } from "@/geography/CityGeography";
import { Terrain } from "@/world/Terrain";
import { DistrictLandmarks } from "@/world/DistrictLandmarks";
import { Roads } from "@/world/Roads";
import { Buildings } from "@/world/Buildings";
import { LandmarkDetails } from "@/world/LandmarkDetails";
import { StreetProps } from "@/world/StreetProps";
import { Pedestrians } from "@/world/Pedestrians";
import { Traffic } from "@/world/Traffic";

import { Lighting } from "@/world/Lighting";
import { GltfAvatar } from "@/player/GltfAvatar";
import { Player } from "@/player/Player";
import { PlayerController } from "@/player/PlayerController";

import { AudioManager } from "@/audio/AudioManager";
import { VehicleManager } from "@/vehicles/VehicleManager";
import { Input } from "@/player/Input";
import { ThirdPersonCamera } from "@/camera/ThirdPersonCamera";
import { OverviewCamera } from "@/camera/OverviewCamera";
import { HUD } from "@/ui/HUD";
import { WorldLabels } from "@/ui/WorldLabels";
import { PostFX } from "@/rendering/PostFX";
import { Minimap } from "@/ui/Minimap";
import { LandmarkPanel } from "@/ui/LandmarkPanel";
import { LandmarkManager } from "@/landmarks/LandmarkManager";
import { TimeOfDay } from "@/world/TimeOfDay";
import { QuestBeacon } from "@/world/QuestBeacon";
import { QuestManager } from "@/quests/QuestManager";
import { CHEARGI_WALK } from "@/quests/quest";
import { Notebook } from "@/ui/Notebook";
import { RoadGraph } from "@/navigation/RoadGraph";
import { Navigation } from "@/navigation/Navigation";
import { buildSearchIndex, SearchBox } from "@/ui/SearchBox";
import {
  clearLocationWatch,
  getCurrentLocation,
  insideWorldBounds,
  watchLocation,
  type DeviceLocation,
} from "@/geography/Geolocation";
import { WORLD_CONFIG } from "@/config/WorldConfig";
import { clampToWorld, geoToLocal } from "@/geography/Projection";
import { createHeightProvider, type HeightProvider } from "@/geography/WorldHeight";

/**
 * Owns the game loop and wires the systems together (spec §61).
 *
 * Systems stay independent: the loop advances player, camera, and (later) the
 * world streamer, then renders. World assets are loaded in `load()` before the
 * loop starts.
 */
export class Game {
  private readonly clock = new THREE.Clock();
  private readonly renderer: Renderer;
  private readonly sceneManager = new SceneManager();
  private readonly lighting = new Lighting();
  private readonly input: Input;
  private readonly player = new Player();
  private readonly cameraRig: ThirdPersonCamera;
  private readonly hud: HUD;
  private readonly cameraTarget = new THREE.Vector3();

  private controller: PlayerController;
  private getHeight: HeightProvider = createHeightProvider();
  private labels?: WorldLabels;
  private minimap?: Minimap;
  private pedestrians?: Pedestrians;
  private traffic?: Traffic;
  private atmosphere?: Atmosphere;
  private cityLife?: CityLife;
  private quest?: QuestManager;
  private notebook?: Notebook;
  private beacon?: QuestBeacon;
  private navigation?: Navigation;
  private searchBox?: SearchBox;
  private overview?: OverviewCamera;
  private neighborhoods?: Neighborhoods;
  private mode: "follow" | "overview" = "follow";
  private clickStart: { x: number; y: number } | null = null;
  private landmarks?: LandmarkManager;
  private vehicles?: VehicleManager;
  private postfx: PostFX | undefined;
  private readonly audio = new AudioManager();
  private readonly timeOfDay = new TimeOfDay();
  private gpsWatchId: number | null = null;
  private gpsTracking = false;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
  ) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.cameraRig = new ThirdPersonCamera(this.renderer.aspect);
    this.controller = new PlayerController(
      this.player,
      this.input,
      this.cameraRig,
      this.getHeight,
    );
    this.hud = new HUD(hudRoot);

    this.player.onFootstep = (intensity) => this.audio.footstep(intensity);
    window.addEventListener("pointerdown", this.onFirstGesture, { once: true });
    window.addEventListener("keydown", this.onFirstGesture, { once: true });

    this.sceneManager.scene.add(this.lighting.object, this.player.object);

    canvas.addEventListener("pointerdown", (event) => {
      this.clickStart = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("dblclick", this.onCanvasClick);

    window.addEventListener("resize", this.onResize);
    this.onResize();

    try {
      this.postfx = new PostFX(
        this.renderer.instance,
        this.sceneManager.scene,
        this.cameraRig.camera,
        window.innerWidth,
        window.innerHeight,
      );
    } catch (error) {
      console.warn("[postfx] disabled:", error);
      this.postfx = undefined;
    }
  }

  /** Browsers require a user gesture before audio can start. */
  private onFirstGesture = (): void => {
    this.audio.resume();
    this.audio.startAmbience();
  };

  /** Loads world assets and sets up the player at the configured spawn. */
  async load(): Promise<void> {
    this.getHeight = createHeightProvider();
    this.overview = new OverviewCamera(this.renderer.aspect, this.getHeight);
    this.controller = new PlayerController(
      this.player,
      this.input,
      this.cameraRig,
      this.getHeight,
    );

    const terrain = new Terrain(this.getHeight);
    const roads = await Roads.load(this.getHeight);
    const structures = await CityStructures.load(this.getHeight);
    this.cityLife = new CityLife(roads.roads, this.getHeight);
    this.atmosphere = new Atmosphere();
    this.sceneManager.scene.add(structures.object, this.cityLife.object, this.atmosphere.object);
    const buildings = await Buildings.load(this.getHeight);
    this.neighborhoods = new Neighborhoods(roads.roads, buildings.list, this.getHeight);
    this.sceneManager.scene.add(this.neighborhoods.object, new UrbanFabric(roads.roads, buildings.list, this.neighborhoods, this.getHeight).object);
    buildings.named.unshift(...this.cityLife.named);
    const districtLandmarks = new DistrictLandmarks(this.getHeight);
    buildings.named.push(...districtLandmarks.named);
    this.sceneManager.scene.add(districtLandmarks.object);
    const landmarkDetails = LandmarkDetails.build(
      buildings.list,
      buildings.named,
      this.getHeight,
    );
    const streetProps = new StreetProps(roads.roads, this.getHeight);
    this.pedestrians = new Pedestrians(roads.roads, this.getHeight);
    this.traffic = new Traffic(roads.roads, this.getHeight, structures.paths);
    this.navigation = new Navigation(
      new RoadGraph(roads.roads),
      this.getHeight,
      this.hud,
    );
    this.sceneManager.scene.add(
      landmarkDetails.object,
      streetProps.object,
      this.pedestrians.object,
      this.traffic.object,
      this.navigation.object,
    );

    // Quest + discovery (spec §75).
    const beacon = new QuestBeacon(this.getHeight);
    this.beacon = beacon;
    this.sceneManager.scene.add(beacon.object);
    this.notebook = new Notebook(document.body, buildings.named.length, (name) =>
      this.landmarks?.selectByName(name),
    );
    this.quest = new QuestManager(CHEARGI_WALK, buildings.named, this.hud, beacon);

    const landmarkPanel = new LandmarkPanel(document.body);
    this.landmarks = new LandmarkManager(
      buildings.named,
      landmarkPanel,
      this.hud,
      (landmark) => {
        this.notebook?.add(landmark);
        this.quest?.notifyDiscovered(landmark.name);
      },
    );
    this.labels = new WorldLabels(buildings.named, this.getHeight, (name) =>
      this.landmarks?.selectByName(name),
    );
    this.minimap = new Minimap(
      document.body,
      buildings.list,
      roads.roads,
      buildings.named,
      (x, z) => this.travelTo(x, z),
    );
    this.vehicles = new VehicleManager(this.sceneManager.scene, this.getHeight);
    this.searchBox = new SearchBox(
      document.body,
      buildSearchIndex(buildings.named, roads.roads),
      (item) => this.navigation?.setDestination(item, this.player),
      () => this.navigation?.clear(),
    );

    await this.loadAvatar();
    await this.audio.loadAmbience();

    this.sceneManager.scene.add(terrain.object, roads.object, buildings.object);

    this.spawnPlayer();
    this.setupDistrictControls(buildings.named);
    this.toggleOverview();

    // Try to start the player at the device's real location (spec §54 extension).
    // Location remains available on request with L; the curated start is stable.
  }

  private setupDistrictControls(places: import("@/world/Buildings").NamedBuilding[]): void {
    const toolbar = document.createElement("nav");
    toolbar.className = "district-controls";
    toolbar.setAttribute("aria-label", "Explore Chittagong");
    const overview = document.createElement("button");
    overview.textContent = "Walk / Overview";
    overview.addEventListener("click", () => this.toggleOverview());
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Visit a landmark");
    select.add(new Option("Visit a landmark…", ""));
    for (const place of places) select.add(new Option(place.name, place.id));
    select.addEventListener("change", () => {
      const place = places.find(p => p.id === select.value);
      if (!place) return;
      this.travelTo(place.x, place.z + 30);
      this.cameraRig.yaw = 0;
      this.cameraRig.pitch = 0.4;
      this.cameraRig.distance = window.innerWidth < 760 ? 40 : 28;
      this.player.facing = Math.PI;
      if (this.mode === "overview") this.toggleOverview();
      select.value = "";
    });
    const home = document.createElement("button");
    home.textContent = "Start at Cheragi";
    home.addEventListener("click", () => {
      if (this.vehicles?.mounted) this.vehicles.toggleMount(this.player);
      this.spawnPlayer(); this.cameraRig.snap();
      if (this.mode === "overview") this.toggleOverview();
    });
    const beach = document.createElement("button");
    beach.textContent = "Visit Patenga";
    beach.addEventListener("click", () => {
      const p = geoToLocal({latitude:22.23444,longitude:91.79226});
      this.travelTo(p.x+12,p.z+15);
      this.cameraRig.yaw = Math.PI/2;
      this.cameraRig.pitch = .48;
      this.cameraRig.distance = 14;
      if(this.mode === "overview") this.toggleOverview();
    });
    toolbar.append(beach, overview, select, home); document.body.append(toolbar);
  }

  private async loadAvatar(): Promise<void> {
    try {
      this.player.setAvatar(await GltfAvatar.load());
    } catch (error) {
      console.warn("[avatar] GLB unavailable; using procedural avatar.", error);
    }
  }

  /** Requests the device location and spawns/marks it if inside the world. */
  private async startAtDeviceLocation(): Promise<void> {
    const location = await getCurrentLocation(8000);
    if (!location) {
      this.hud.setGps("GPS unavailable — press L to retry");
      return;
    }
    this.applyDeviceLocation(location);
  }

  private applyDeviceLocation(location: DeviceLocation): void {
    const inside = insideWorldBounds(location.latitude, location.longitude);
    const coords = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    const local = geoToLocal({ latitude: location.latitude, longitude: location.longitude });
    this.minimap?.setGps(local);

    if (!inside) {
      this.hud.setGps(`GPS ${coords} · outside Chattogram map`);
      return;
    }

    this.player.position.set(local.x, this.getHeight(local.x, local.z), local.z);
    this.player.velocity.set(0, 0, 0);
    this.player.sync();
    this.hud.setGps(`GPS ${coords}${this.gpsTracking ? " · live" : ""}`);
  }

  private toggleGpsTracking(): void {
    if (this.gpsTracking) {
      if (this.gpsWatchId !== null) clearLocationWatch(this.gpsWatchId);
      this.gpsWatchId = null;
      this.gpsTracking = false;
      this.hud.setGps("GPS tracking off");
      return;
    }

    const id = watchLocation((location) => this.applyDeviceLocation(location));
    if (id === null) {
      this.hud.setGps("GPS unavailable");
      return;
    }
    this.gpsWatchId = id;
    this.gpsTracking = true;
    this.hud.setGps("GPS tracking on");
  }

  private spawnPlayer(): void {
    const spawn = geoToLocal(WORLD_CONFIG.spawn);
    this.player.position.set(
      spawn.x,
      this.getHeight(spawn.x, spawn.z),
      spawn.z,
    );
    this.player.sync();
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.cameraRig.resize(width / height);
    this.overview?.resize(width / height);
    this.postfx?.setSize(width, height);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.neighborhoods?.update(delta);
    this.atmosphere?.update(delta, this.timeOfDay.isNight, this.player.position, this.mode === "overview");
    
    this.pedestrians?.update(delta);
    this.traffic?.update(delta, this.timeOfDay.isNight);

    this.handleVehicleInput();

    let activeCamera: THREE.Camera;
    if (this.mode === "overview" && this.overview) {
      this.overview.handleInput(this.input);
      this.overview.update(delta);
      activeCamera = this.overview.camera;
    } else {
      this.cameraRig.handleInput(this.input);
      const mounted = this.vehicles?.mounted ?? null;
      if (mounted) {
        this.vehicles?.drive(delta, this.input);
        this.vehicles?.syncRider(this.player);
        this.player.updateRiding(delta);
        // Camera is free to orbit while riding (mouse drag / wheel zoom), exactly
        // like on foot; it only follows the vehicle's position.
        if (!this.vehicles?.getCameraTarget(this.cameraTarget)) {
          this.player.getCameraTarget(this.cameraTarget);
        }
      } else {
        this.controller.update(delta);
        this.player.getCameraTarget(this.cameraTarget);
      }
      this.cameraRig.update(delta, this.cameraTarget);
      activeCamera = this.cameraRig.camera;
    }

    this.landmarks?.update(this.player, this.input);
    this.navigation?.update(delta, this.player);
    this.minimap?.setRoute(
      this.navigation?.getRoute() ?? [],
      this.navigation?.getTarget() ?? null,
    );
    this.quest?.update();
    this.beacon?.update(delta);
    const objective = this.quest?.currentLandmark() ?? null;
    this.minimap?.setQuestTarget(objective ? { x: objective.x, z: objective.z } : null);
    this.labels?.update(activeCamera);
    this.minimap?.update(this.player);

    // Day/night (spec §34): hold T to fast-forward.
    this.timeOfDay.update(delta, this.input.isDown("KeyT"));
    this.lighting.applyTimeOfDay(
      this.timeOfDay.lightColor,
      this.timeOfDay.sunIntensity,
      this.timeOfDay.ambientIntensity,
      this.timeOfDay.sunHeight > 0.2,
    );
    this.sceneManager.setSky(this.timeOfDay.skyColor);
    this.hud.setClock(this.timeOfDay.label);
    this.audio.updateAmbience(delta, this.timeOfDay.isNight, Math.max(0, 1 - Math.abs(this.player.position.x - coastX(this.player.position.z)) / 120), this.mode === "overview");
    this.updateSun(this.timeOfDay.getLightDirection());

    if (this.postfx) {
      this.postfx.setCamera(activeCamera);
      this.postfx.render(delta, this.sceneManager.scene, activeCamera);
    } else {
      this.renderer.instance.render(this.sceneManager.scene, activeCamera);
    }
    this.hud.update(delta, this.player);
    this.input.endFrame();
  };

  private handleVehicleInput(): void {
    const vehicles = this.vehicles;
    if (!vehicles) return;

    if (this.input.wasPressed("KeyC")) vehicles.summon("car", this.player);
    if (this.input.wasPressed("KeyB")) vehicles.summon("bicycle", this.player);
    if (this.input.wasPressed("KeyM")) this.minimap?.toggle();
    if (this.input.wasPressed("KeyN")) this.minimap?.toggleLarge();
    if (this.input.wasPressed("KeyH")) this.notebook?.toggle();
    if (this.input.wasPressed("Slash")) this.searchBox?.toggle();
    if (this.input.wasPressed("Escape")) {
      this.searchBox?.close();
      this.notebook?.close();
    }
    if (this.input.wasPressed("KeyL")) void this.startAtDeviceLocation();
    if (this.input.wasPressed("KeyG")) this.toggleGpsTracking();
    if (this.input.wasPressed("KeyP")) this.postfx?.toggle();
    if (this.input.wasPressed("KeyU")) this.audio.toggleMute();
    if (this.input.wasPressed("KeyO")) this.toggleOverview();
    if (this.input.wasPressed("KeyF")) {
      vehicles.toggleMount(this.player);
      const mounted = vehicles.mounted;
      if (mounted) {
        // Face away from the camera so W accelerates into the screen.
        mounted.heading = this.cameraRig.yaw + Math.PI;
        this.cameraRig.distance = mounted.spec.camDistance;
      } else {
        this.cameraRig.distance = 12;
      }
    }
  }

  /** Toggles the detached globe/overview camera. */
  private toggleOverview(): void {
    if (!this.overview) return;
    const entering = this.mode !== "overview";
    this.mode = entering ? "overview" : "follow";
    document.body.classList.toggle("is-overview", entering);
    if (entering) {
      this.overview.snap();
      this.sceneManager.setFogFar(9000);
    } else {
      this.cameraRig.snap();
      this.sceneManager.setFogFar(3600);
    }
  }

  /** In overview, double-clicking the ground travels there and returns to follow. */
  private onCanvasClick = (event: MouseEvent): void => {
    if (this.mode !== "overview" || !this.overview) return;
    if (
      this.clickStart &&
      Math.hypot(event.clientX - this.clickStart.x, event.clientY - this.clickStart.y) > 6
    ) {
      return;
    }
    const terrain = this.sceneManager.scene.getObjectByName("Terrain");
    if (!terrain) return;
    const hit = this.overview.pickGround(event.clientX, event.clientY, this.canvas, terrain);
    if (!hit) return;
    this.travelTo(hit[0], hit[1]);
    if (this.mode === "overview") this.toggleOverview();
    this.cameraRig.snap();
  };

  /** Teleports the player to a world position (map click / pin). */
  private travelTo(x: number, z: number): void {
    if (this.vehicles?.mounted) this.vehicles.toggleMount(this.player);
    let [cx, cz] = clampToWorld(x, z, 12);
    // Keep map clicks on the promenade/bank instead of dropping the visitor in water.
    if (shoreDistance(cx,cz)<4) {
      let best=Infinity;
      for(let dx=-60;dx<=60;dx+=4)for(let dz=-60;dz<=60;dz+=4){
        const [px,pz]=clampToWorld(x+dx,z+dz,12),distance=dx*dx+dz*dz;
        if(distance<best&&shoreDistance(px,pz)>6){best=distance;cx=px;cz=pz;}
      }
      if(!Number.isFinite(best))return;
    }
    this.player.position.set(cx, this.getHeight(cx, cz), cz);
    this.player.velocity.set(0, 0, 0);
    this.player.sync();
    this.cameraRig.snap();
  }

  private updateSun(direction: THREE.Vector3): void {
    const p = this.player.position;
    // Snap the shadow frustum to the shadow-map texel grid. Without this the
    // moving shadow camera re-samples the map every frame and edges shimmer.
    const texel = this.lighting.shadowTexel;
    const sx = Math.round(p.x / texel) * texel;
    const sz = Math.round(p.z / texel) * texel;
    const distance = 2500;

    this.lighting.sun.position.set(
      sx + direction.x * distance,
      p.y + direction.y * distance,
      sz + direction.z * distance,
    );
    this.lighting.sun.target.position.set(sx, p.y, sz);
    this.lighting.sun.target.updateMatrixWorld();
  }
}
