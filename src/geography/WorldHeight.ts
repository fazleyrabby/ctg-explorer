import { shoreDistance } from "@/geography/CityGeography";
import { geoToLocal } from "@/geography/Projection";

export type HeightProvider = (x: number, z: number) => number;

// Authored relief preserves the two recognizable hills without draping roads
// over noisy 30 m DEM cells. All renderers and movement use this same surface.
const hills = [
  { ...geoToLocal({latitude:22.341944, longitude:91.831944}), rise:8, radius:58 },
  { ...geoToLocal({latitude:22.33483, longitude:91.83461}), rise:6, radius:42 },
];
export function createHeightProvider(): HeightProvider {
  return (x,z) => {
    const shore=shoreDistance(x,z);
    if(shore<0) return Math.max(-3, .15+shore*.55);
    const base=2 + Math.min(1,shore/12)*2;
    return base + hills.reduce((height,hill) => {
    const r2=((x-hill.x)**2+(z-hill.z)**2)/(hill.radius**2);
    return height+hill.rise*Math.exp(-r2);
  },0);
  };
}
