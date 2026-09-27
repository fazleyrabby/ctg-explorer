/**
 * Keyboard + mouse input collection (spec §25).
 *
 * The player controller reads state from here; nothing in this class mutates
 * game objects directly. Continuous pointer movement is accumulated per frame
 * and consumed via consumePointerDelta()/consumeWheelDelta().
 */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export class Input {
  private readonly keys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly listeners: Array<() => void> = [];

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pointerDeltaX = 0;
  private pointerDeltaY = 0;
  private wheelDelta = 0;
  private orbitDrag = false;
  private orbitDeltaX = 0;
  private orbitDeltaY = 0;
  private viewportHeight = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bind(window, "keydown", this.onKeyDown as EventListener);
    this.bind(window, "keyup", this.onKeyUp as EventListener);
    this.bind(window, "blur", this.onBlur as EventListener);

    this.bind(canvas, "pointerdown", this.onPointerDown as EventListener);
    this.bind(window, "pointermove", this.onPointerMove as EventListener);
    this.bind(window, "pointerup", this.onPointerUp as EventListener);
    this.bind(window, "pointercancel", this.onPointerUp as EventListener);
    this.bind(canvas, "contextmenu", ((e: Event) =>
      e.preventDefault()) as EventListener);
    this.bind(canvas, "wheel", this.onWheel as EventListener, { passive: false });
  }

  private bind(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (isEditable(e.target)) return;
    if (e.code === "Space" || e.code === "Tab" || e.code.startsWith("Arrow")) {
      e.preventDefault();
    }
    if (!this.keys.has(e.code)) this.justPressed.add(e.code);
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (isEditable(e.target)) return;
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
    this.pointerDeltaX = this.pointerDeltaY = this.orbitDeltaX = this.orbitDeltaY = 0;
    this.wheelDelta = 0;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.orbitDrag = e.button !== 0 || e.shiftKey;
    this.viewportHeight = this.canvas.clientHeight;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
    this.pointerDeltaX += dx;
    this.pointerDeltaY += dy;
    if (this.orbitDrag) { this.orbitDeltaX += dx; this.orbitDeltaY += dy; }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelDelta += e.deltaY;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. Cleared by endFrame(). */
  wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  /** Call once per frame after reading input. */
  endFrame(): void {
    this.justPressed.clear();
  }

  get moveForward(): number {
    return (this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0);
  }

  get moveRight(): number {
    return (this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0);
  }

  get sprinting(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  get jumpPressed(): boolean {
    return this.isDown("Space");
  }

  consumePointerDelta(): { x: number; y: number } {
    const delta = { x: this.pointerDeltaX, y: this.pointerDeltaY };
    this.orbitDeltaX = this.orbitDeltaY = 0;
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
    return delta;
  }

  consumeOverviewDelta(): { panX: number; panY: number; orbitX: number; orbitY: number; height: number } {
    const result = { panX: this.pointerDeltaX-this.orbitDeltaX, panY: this.pointerDeltaY-this.orbitDeltaY, orbitX: this.orbitDeltaX, orbitY: this.orbitDeltaY, height: this.viewportHeight };
    this.pointerDeltaX = this.pointerDeltaY = this.orbitDeltaX = this.orbitDeltaY = 0;
    return result;
  }

  consumeWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }
}
