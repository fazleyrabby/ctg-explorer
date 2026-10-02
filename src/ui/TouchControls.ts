import type { Input } from "@/player/Input";

const DEAD_ZONE = 0.28;
const SPRINT_ZONE = 0.86;
/** Past this ratio a diagonal push counts on both axes (about 22.5° sectors). */
const AXIS_RATIO = 0.4;

interface TouchButton {
  label: string;
  code: string;
  title: string;
}

const BUTTONS: TouchButton[] = [
  { label: "Jump", code: "Space", title: "Jump, or handbrake while riding" },
  { label: "Ride", code: "KeyF", title: "Get on or off the nearest vehicle" },
  { label: "Car", code: "KeyC", title: "Summon a car" },
  { label: "Bike", code: "KeyB", title: "Summon a bicycle" },
  { label: "Explore", code: "KeyE", title: "Read about the nearest landmark" },
  { label: "Notes", code: "KeyH", title: "Open the History Notebook" },
];

/**
 * On-screen joystick and action buttons for touch devices. They feed the same
 * `Input` state as the keyboard; dragging the canvas still looks around and a
 * two-finger pinch zooms.
 */
export class TouchControls {
  private readonly root: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly pad: HTMLDivElement;
  private activePointer: number | null = null;

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root = document.createElement("div");
    this.root.className = "touch";

    this.pad = document.createElement("div");
    this.pad.className = "touch__pad";
    this.pad.setAttribute("aria-label", "Move");
    this.knob = document.createElement("div");
    this.knob.className = "touch__knob";
    this.pad.appendChild(this.knob);

    const buttons = document.createElement("div");
    buttons.className = "touch__buttons";
    for (const spec of BUTTONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "touch__button";
      button.textContent = spec.label;
      button.title = spec.title;
      const release = (): void => this.input.setVirtualKey(spec.code, false);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.input.setVirtualKey(spec.code, true);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
      buttons.appendChild(button);
    }

    this.root.append(this.pad, buttons);
    parent.appendChild(this.root);
    document.body.classList.add("has-touch");

    this.pad.addEventListener("pointerdown", this.onDown);
    this.pad.addEventListener("pointermove", this.onMove);
    this.pad.addEventListener("pointerup", this.onUp);
    this.pad.addEventListener("pointercancel", this.onUp);
  }

  private onDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.activePointer = event.pointerId;
    try {
      this.pad.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    this.track(event);
  };

  private onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.track(event);
  };

  private onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.knob.style.transform = "";
    this.input.setVirtualMove(0, 0, false);
  };

  private track(event: PointerEvent): void {
    const rect = this.pad.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (event.clientX - rect.left - radius) / radius;
    let dy = (event.clientY - rect.top - radius) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    this.knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    if (length < DEAD_ZONE) {
      this.input.setVirtualMove(0, 0, false);
      return;
    }
    const major = Math.max(Math.abs(dx), Math.abs(dy));
    const axis = (value: number): number => (Math.abs(value) >= major * AXIS_RATIO ? Math.sign(value) : 0);
    // Screen-up is forward.
    this.input.setVirtualMove(axis(-dy), axis(dx), length >= SPRINT_ZONE);
  }
}
