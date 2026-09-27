import type { Player } from "@/player/Player";
import { localToGeo } from "@/geography/Projection";

/**
 * Minimal heads-up display (spec §56). Kept deliberately small for Milestone 1;
 * landmark prompts and the minimap arrive in later milestones.
 */
export class HUD {
  private readonly fpsEl: HTMLSpanElement;
  private readonly coordEl: HTMLSpanElement;
  private readonly promptEl: HTMLDivElement;
  private readonly clockEl: HTMLSpanElement;
  private readonly gpsEl: HTMLDivElement;
  private readonly destinationEl: HTMLDivElement;
  private readonly questEl: HTMLDivElement;
  private readonly questTitleEl: HTMLElement;
  private readonly questObjectiveEl: HTMLElement;
  private readonly questProgressEl: HTMLElement;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hud__title">Little Chittagong</div>
      <div class="hud__district">Patenga to Bahaddarhat · A living miniature</div>
      <div class="hud__stats">
        <span data-fps>--</span> FPS &middot;
        <span data-coord>--</span> &middot;
        <span data-clock>--:--</span>
      </div>
      <div class="hud__gps" data-gps hidden></div>
      <div class="hud__destination" data-destination hidden></div>
      <div class="hud__prompt" hidden></div>
      <div class="hud__quest" hidden>
        <div class="hud__quest-title" data-quest-title></div>
        <div class="hud__quest-objective" data-quest-objective></div>
        <div class="hud__quest-progress" data-quest-progress></div>
      </div>
      <details class="hud__controls"><summary>How to explore</summary>
        <p>Overview: drag to explore · scroll to zoom · right-drag to orbit · WASD/arrows to fly · double-click to walk there.</p>
        WASD Move &middot; Mouse Drag Camera &middot; Wheel Zoom &middot; Shift Sprint &middot; Space Jump<br />
        Riding: W Accelerate &middot; S Brake / Reverse &middot; A/D Steer &middot; Space Handbrake<br />
        E Explore &middot; / Search route &middot; H Notebook &middot; O Overview &middot; C Car &middot; B Bicycle &middot; F Ride &middot; Tab Map &middot; N Big map &middot; T Time &middot; K Day / Night &middot; L Locate &middot; G GPS &middot; P Post-FX &middot; M Mute
      </details>
      <div class="hud__footer">
        <div id="visitor-counter-mount"></div>
        <div class="district-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Distances compressed</div>
      </div>
    `;

    this.fpsEl = root.querySelector("[data-fps]") as HTMLSpanElement;
    this.coordEl = root.querySelector("[data-coord]") as HTMLSpanElement;
    this.promptEl = root.querySelector(".hud__prompt") as HTMLDivElement;
    this.clockEl = root.querySelector("[data-clock]") as HTMLSpanElement;
    this.gpsEl = root.querySelector("[data-gps]") as HTMLDivElement;
    this.destinationEl = root.querySelector("[data-destination]") as HTMLDivElement;
    this.questEl = root.querySelector(".hud__quest") as HTMLDivElement;
    this.questTitleEl = root.querySelector("[data-quest-title]") as HTMLElement;
    this.questObjectiveEl = root.querySelector("[data-quest-objective]") as HTMLElement;
    this.questProgressEl = root.querySelector("[data-quest-progress]") as HTMLElement;
  }

  /** Navigation destination line, e.g. "Agrabad · 320 m". Null hides it. */
  setDestination(text: string | null): void {
    if (!text) {
      if (!this.destinationEl.hidden) this.destinationEl.hidden = true;
      return;
    }
    if (this.destinationEl.textContent !== text) this.destinationEl.textContent = `➤ ${text}`;
    if (this.destinationEl.hidden) this.destinationEl.hidden = false;
  }

  /** Quest tracker (spec §75). `objective` null means the quest is complete. */
  setQuest(title: string, objective: string | null, done: number, total: number): void {
    this.questEl.hidden = false;
    this.questTitleEl.textContent = title;
    this.questObjectiveEl.textContent = objective
      ? `Next: ${objective}`
      : "All stops discovered — route complete!";
    this.questProgressEl.textContent = `${done} / ${total}`;
  }

  setClock(label: string): void {
    if (this.clockEl.textContent !== label) this.clockEl.textContent = label;
  }

  /** Shows a GPS status line, or hides it when null. */
  setGps(text: string | null): void {
    if (!text) {
      if (!this.gpsEl.hidden) this.gpsEl.hidden = true;
      return;
    }
    if (this.gpsEl.textContent !== text) this.gpsEl.textContent = text;
    if (this.gpsEl.hidden) this.gpsEl.hidden = false;
  }

  /** Shows or hides the contextual interaction prompt (spec §56). */
  setPrompt(text: string | null): void {
    if (!text) {
      if (!this.promptEl.hidden) this.promptEl.hidden = true;
      return;
    }
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
    if (this.promptEl.hidden) this.promptEl.hidden = false;
  }

  update(delta: number, player: Player): void {
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsEl.textContent = String(fps);
      this.fpsAccum = 0;
      this.fpsFrames = 0;

      const geo = localToGeo({ x: player.position.x, z: player.position.z });
      this.coordEl.textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
    }
  }
}
