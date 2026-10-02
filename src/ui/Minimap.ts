import {localWorldBounds} from "@/geography/Projection";
import {shoreDistance} from "@/geography/CityGeography";
import type { BuildingData, NamedBuilding } from "@/world/Buildings";
import type { RoadData } from "@/world/Roads";
import type { Player } from "@/player/Player";

const SMALL = { size: 190, span: 400 };
const LARGE = { size: 400, span: 1800 };
const COMPACT_SIZE = 132;
const MARGIN = 300;

interface Pin {
  name: string;
  worldX: number;
  worldZ: number;
  screenX: number;
  screenY: number;
}

/**
 * Canvas2D minimap / map view (spec §55, MVP-core).
 *
 * Reuses the same world vectors as the 3D scene. The static world is rendered
 * once; each frame a player-centred crop is blitted with named-place pins and a
 * facing arrow. **Click anywhere to travel** (or click a pin). Toggle size with
 * **N**. Reuses the same data — no second pipeline.
 */
export class Minimap {
  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly staticMap: HTMLCanvasElement;
  private readonly named: NamedBuilding[];
  private readonly pins: Pin[] = [];

  private minX = 0;
  private maxZ = 0;
  private readonly staticW: number;
  private readonly staticH: number;

  private size = SMALL.size;
  private span = SMALL.span;
  private scale = SMALL.size / SMALL.span;

  private sx = 0;
  private sy = 0;
  private visible = true;
  private large = false;
  private gps: { x: number; z: number } | null = null;
  private questTarget: { x: number; z: number } | null = null;
  private route: Array<[number, number]> = [];
  private destination: { x: number; z: number } | null = null;

  constructor(
    parent: HTMLElement,
    buildings: BuildingData[],
    roads: RoadData[],
    named: NamedBuilding[],
    private readonly onTravel: (x: number, z: number) => void,
  ) {
    this.named = named;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const b of buildings) {
      for (const [x, z] of b.ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    if (!Number.isFinite(minX)) {
      minX = -1000;
      maxX = 1000;
      minZ = -1000;
      maxZ = 1000;
    }
    const bounds=localWorldBounds();
    minX=bounds.minX;maxX=bounds.maxX;minZ=bounds.minZ;maxZ=bounds.maxZ;
    this.minX = minX - MARGIN;
    this.maxZ = maxZ + MARGIN;
    this.staticW = Math.ceil(maxX - minX + MARGIN * 2);
    this.staticH = Math.ceil(maxZ - minZ + MARGIN * 2);

    this.staticMap = this.renderStatic(buildings, roads);

    this.container = document.createElement("div");
    this.container.className = "minimap";
    this.canvas = document.createElement("canvas");
    this.container.appendChild(this.canvas);
    parent.appendChild(this.container);

    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.applySize();
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  /** Refits the map to the window; also called when the window is resized. */
  resize(): void {
    this.applySize();
  }

  private applySize(): void {
    // A window that reports no width yet (hidden tab) must not produce a negative canvas.
    // Phones get a smaller corner map so it sits beside the quest tracker.
    const small = window.innerWidth < 760 ? COMPACT_SIZE : SMALL.size;
    this.size = Math.max(96, Math.min(this.large ? LARGE.size : small, window.innerWidth - 32));
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.ctx.scale(dpr, dpr);
    this.scale = this.size / this.span;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    // Pin hit-test first.
    let best: Pin | null = null;
    let bestDistance = 16;
    for (const pin of this.pins) {
      const distance = Math.hypot(pin.screenX - cx, pin.screenY - cy);
      if (distance < bestDistance) {
        best = pin;
        bestDistance = distance;
      }
    }
    if (best) {
      this.onTravel(best.worldX, best.worldZ);
      return;
    }

    const srcX = this.sx + cx / this.scale;
    const srcY = this.sy + cy / this.scale;
    this.onTravel(srcX + this.minX, this.maxZ - srcY);
  };

  private toStatic(x: number, z: number): [number, number] {
    return [x - this.minX, this.maxZ - z];
  }

  private renderStatic(buildings: BuildingData[], roads: RoadData[]): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.staticW;
    canvas.height = this.staticH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    ctx.fillStyle = "#cdd5c2";
    ctx.fillRect(0, 0, this.staticW, this.staticH);

    for(let x=0;x<this.staticW;x+=12)for(let y=0;y<this.staticH;y+=12){
      const d=shoreDistance(x+this.minX,this.maxZ-y);
      ctx.fillStyle=d<0?"#209cbe":d<14?"#ffe2a0":"#91d876";ctx.fillRect(x,y,12,12);
    }
    ctx.fillStyle = "#eaa168";
    for (const b of buildings) {
      ctx.beginPath();
      for (let i = 0; i < b.ring.length; i++) {
        const [px, py] = this.toStatic(b.ring[i]![0], b.ring[i]![1]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    for (const pass of [0, 1]) {
      for (const road of roads) {
        if (road.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < road.points.length; i++) {
          const [px, py] = this.toStatic(road.points[i]![0], road.points[i]![1]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        const w = Math.max(2, road.width);
        ctx.lineWidth = pass === 0 ? w + 2 : w;
        ctx.strokeStyle = pass === 0 ? "#a9a49a" : "#f7f5f0";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    }

    return canvas;
  }

  setGps(point: { x: number; z: number } | null): void {
    this.gps = point;
  }

  /** Highlights the current quest objective. */
  setQuestTarget(point: { x: number; z: number } | null): void {
    this.questTarget = point;
  }

  /** Draws the active navigation route and its destination. */
  setRoute(points: Array<[number, number]>, destination: { x: number; z: number } | null): void {
    this.route = points;
    this.destination = destination;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "block" : "none";
    return this.visible;
  }

  /** Enlarges the map for easier pin picking / travel. */
  toggleLarge(): boolean {
    this.large = !this.large;
    this.size = this.large ? LARGE.size : SMALL.size;
    this.span = this.large ? LARGE.span : SMALL.span;
    this.applySize();
    return this.large;
  }

  update(player: Player): void {
    if (!this.visible) return;
    const ctx = this.ctx;
    const size = this.size;

    const [pcx, pcy] = this.toStatic(player.position.x, player.position.z);
    this.sx = clamp(pcx - this.span / 2, 0, Math.max(0, this.staticW - this.span));
    this.sy = clamp(pcy - this.span / 2, 0, Math.max(0, this.staticH - this.span));
    const sx = this.sx;
    const sy = this.sy;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.staticMap, sx, sy, this.span, this.span, 0, 0, size, size);

    // Navigation route.
    if (this.route.length > 1) {
      ctx.strokeStyle = "#39d2ff";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < this.route.length; i++) {
        const [rx, ry] = this.toStatic(this.route[i]![0], this.route[i]![1]);
        const dx = (rx - sx) * this.scale;
        const dy = (ry - sy) * this.scale;
        if (i === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      }
      ctx.stroke();
    }

    // Pins + labels.
    this.pins.length = 0;
    ctx.font = "600 10px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    let drawn = 0;
    for (const place of this.named) {
      const [mx, my] = this.toStatic(place.x, place.z);
      const dx = (mx - sx) * this.scale;
      const dy = (my - sy) * this.scale;
      if (dx < 4 || dy < 4 || dx > size - 4 || dy > size - 4) continue;
      this.pins.push({ name: place.name, worldX: place.x, worldZ: place.z, screenX: dx, screenY: dy });
      if (drawn++ > 12) continue;

      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();

      const label = place.name.length > 18 ? `${place.name.slice(0, 17)}…` : place.name;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(16,22,30,0.82)";
      ctx.fillRect(dx + 5, dy - 7, w + 8, 14);
      ctx.fillStyle = "#f4f7fa";
      ctx.fillText(label, dx + 9, dy + 0.5);
    }

    // GPS marker.
    if (this.gps) {
      const [gx, gy] = this.toStatic(this.gps.x, this.gps.z);
      const dx = (gx - sx) * this.scale;
      const dy = (gy - sy) * this.scale;
      if (dx >= 0 && dy >= 0 && dx <= size && dy <= size) {
        ctx.strokeStyle = "#1f9d55";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Quest objective marker.
    if (this.questTarget) {
      const [qx, qy] = this.toStatic(this.questTarget.x, this.questTarget.z);
      const dx = (qx - sx) * this.scale;
      const dy = (qy - sy) * this.scale;
      if (dx >= 0 && dy >= 0 && dx <= size && dy <= size) {
        ctx.strokeStyle = "#ffd54a";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(dx, dy, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#ffd54a";
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Navigation destination.
    if (this.destination) {
      const [dx0, dy0] = this.toStatic(this.destination.x, this.destination.z);
      const dx = (dx0 - sx) * this.scale;
      const dy = (dy0 - sy) * this.scale;
      if (dx >= 0 && dy >= 0 && dx <= size && dy <= size) {
        ctx.fillStyle = "#39d2ff";
        ctx.strokeStyle = "#0b3b4d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 8);
        ctx.lineTo(dx + 6, dy + 5);
        ctx.lineTo(dx - 6, dy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Player arrow.
    const px = (pcx - sx) * this.scale;
    const py = (pcy - sy) * this.scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.facing);
    ctx.fillStyle = "#2f80ed";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Compass + hint.
    ctx.fillStyle = "rgba(16,22,30,0.75)";
    ctx.beginPath();
    ctx.arc(size - 16, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f7fa";
    ctx.textAlign = "center";
    ctx.fillText("N", size - 16, 16.5);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(16,22,30,0.62)";
    ctx.fillRect(8, size - 22, 132, 15);
    ctx.fillStyle = "#f4f7fa";
    ctx.fillText("Click map to travel · N", 13, size - 14.5);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
