/**
 * Keyboard, mouse and touch input collection (spec §25).
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
  /** Canvas pointers currently down; two of them pinch-zoom instead of dragging. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private virtualForward = 0;
  private virtualRight = 0;
  private virtualSprint = false;

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
    this.pointers.clear();
    this.virtualForward = this.virtualRight = 0;
    this.virtualSprint = false;
    this.dragging = false;
    this.pointerDeltaX = this.pointerDeltaY = this.orbitDeltaX = this.orbitDeltaY = 0;
    this.wheelDelta = 0;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.setPointerCapture(e.pointerId);
    if (this.pointers.size === 2) {
      // A second finger turns the drag into a pinch.
      this.dragging = false;
      this.pinchDistance = this.pointerSpread();
      return;
    }
    if (this.pointers.size > 2) return;
    this.dragging = true;
    this.orbitDrag = e.button !== 0 || e.shiftKey;
    this.viewportHeight = this.canvas.clientHeight;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onPointerMove = (e: PointerEvent): void => {
    // Pointers that went down elsewhere (e.g. the touch joystick) never steer the camera.
    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) return;
    tracked.x = e.clientX;
    tracked.y = e.clientY;
    if (this.pointers.size === 2) {
      const spread = this.pointerSpread();
      // Spreading fingers zooms in, matching a wheel scroll up.
      this.wheelDelta -= (spread - this.pinchDistance) * 2.5;
      this.pinchDistance = spread;
      return;
    }
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
    this.pointerDeltaX += dx;
    this.pointerDeltaY += dy;
    if (this.orbitDrag) { this.orbitDeltaX += dx; this.orbitDeltaY += dy; }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    const remaining = [...this.pointers.values()][0];
    if (this.pointers.size === 1 && remaining) {
      // Lifting one pinch finger resumes a drag from the finger still down.
      this.dragging = true;
      this.orbitDrag = false;
      this.lastX = remaining.x;
      this.lastY = remaining.y;
    } else if (this.pointers.size === 0) {
      this.dragging = false;
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
    return Math.sign((this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0) + this.virtualForward);
  }

  get moveRight(): number {
    return Math.sign((this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0) + this.virtualRight);
  }

  get sprinting(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight") || this.virtualSprint;
  }

  /**
   * On-screen joystick state. Axes are -1, 0 or 1 like the keyboard, so the
   * controller's held-direction logic treats both sources identically.
   */
  setVirtualMove(forward: number, right: number, sprint: boolean): void {
    this.virtualForward = Math.sign(forward);
    this.virtualRight = Math.sign(right);
    this.virtualSprint = sprint;
  }

  /** Holds or releases a key from an on-screen button. */
  setVirtualKey(code: string, down: boolean): void {
    if (down) {
      if (!this.keys.has(code)) this.justPressed.add(code);
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
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
