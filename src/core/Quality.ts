export type QualityLevel = "low" | "medium" | "high";

export interface QualitySettings {
  /** Upper bound on the device pixel ratio. */
  pixelRatio: number;
  /** Sun shadow-map resolution; 0 disables sun shadows. */
  shadowMapSize: number;
  /** Fraction of ambient pedestrians and traffic kept visible. */
  crowd: number;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = ["low", "medium", "high"];

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { pixelRatio: 1, shadowMapSize: 0, crowd: 0.4 },
  medium: { pixelRatio: 1.5, shadowMapSize: 1024, crowd: 0.7 },
  high: { pixelRatio: 2, shadowMapSize: 2048, crowd: 1 },
};

/** True on phones and tablets, where touch is the primary pointer. */
export function isTouchDevice(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
  );
}

/** Touch devices start one step down; nothing is measured, so the visitor can change it. */
export function defaultQuality(): QualityLevel {
  return isTouchDevice() ? "medium" : "high";
}
