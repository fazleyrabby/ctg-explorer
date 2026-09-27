import * as THREE from "three";

const DAY = new THREE.Color(0x59bdf5);
const SUNSET = new THREE.Color(0xef9d64);
const NIGHT = new THREE.Color(0x0b1220);
const SUN_WARM = new THREE.Color(0xff8a4a);
const SUN_WHITE = new THREE.Color(0xfffcf3);
const MOON = new THREE.Color(0x9fb4dd);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Simple time-of-day system (spec §34).
 *
 * A single hour value drives the sun direction, sky/fog color, and light
 * intensities. One full day lasts `dayLengthSeconds` of real time; holding T
 * fast-forwards. No astronomical simulation.
 */
export class TimeOfDay {
  private hours: number;
  private readonly sunDirection = new THREE.Vector3();

  constructor(
    startHour = 10,
    private readonly dayLengthSeconds = 2400,
  ) {
    this.hours = startHour;
  }

  update(delta: number, fastForward: boolean): void {
    const rate = (24 / this.dayLengthSeconds) * (fastForward ? 60 : 1);
    this.hours = (this.hours + delta * rate) % 24;
  }

  get hour(): number {
    return this.hours;
  }

  /** Unit vector pointing from the world toward the sun. */
  getSunDirection(): THREE.Vector3 {
    const angle = ((this.hours - 6) / 12) * Math.PI;
    return this.sunDirection.set(Math.cos(angle), Math.sin(angle), 0.35).normalize();
  }

  /** Sun height above the horizon, roughly -1..1. */
  get sunHeight(): number {
    return this.getSunDirection().y;
  }

  get isNight(): boolean {
    return this.sunHeight < -0.02;
  }

  get skyColor(): THREE.Color {
    const h = this.sunHeight;
    const color = new THREE.Color();
    if (h >= 0.35) return color.copy(DAY);
    if (h >= 0) return color.copy(SUNSET).lerp(DAY, h / 0.35);
    if (h >= -0.25) return color.copy(NIGHT).lerp(SUNSET, (h + 0.25) / 0.25);
    return color.copy(NIGHT);
  }

  get sunColor(): THREE.Color {
    const h = this.sunHeight;
    const color = new THREE.Color();
    if (h >= 0.3) return color.copy(SUN_WHITE);
    return color.copy(SUN_WARM).lerp(SUN_WHITE, Math.max(0, h) / 0.3);
  }

  /** Key-light direction: sun by day, moon (opposite) by night. */
  getLightDirection(): THREE.Vector3 {
    const direction = this.getSunDirection();
    return this.isNight ? direction.clone().multiplyScalar(-1) : direction;
  }

  get lightColor(): THREE.Color {
    return this.isNight ? MOON : this.sunColor;
  }

  /** Smooth twilight falloff so sunset isn't an abrupt cliff. */
  get sunIntensity(): number {
    const daylight = smoothstep(-0.08, 0.35, this.sunHeight) * 2.15;
    return this.isNight ? 0.45 : daylight;
  }

  get ambientIntensity(): number {
    // Night keeps a navigable floor; day rises smoothly.
    return 0.7 + smoothstep(-0.2, 0.35, this.sunHeight) * 1.0;
  }

  /** "HH:MM" for the HUD. */
  get label(): string {
    const h = Math.floor(this.hours);
    const m = Math.floor((this.hours - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
