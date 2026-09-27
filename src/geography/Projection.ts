import { WORLD_CONFIG, DISTRICT_SCALE, type GeoCoordinate } from "@/config/WorldConfig";

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Converts WGS84 lat/lon into a compressed local frame centered on WORLD_CONFIG.origin.
 *
 * This is a local equirectangular approximation, which is accurate enough for a
 * city-scale slice and keeps the projection deterministic and dependency-free.
 * A full projection (e.g. UTM 46N via proj4) can replace this later without
 * touching call sites, because everything consumes LocalPoint.
 */
export interface LocalPoint {
  /** East/west, miniature world units. +X = east. */
  x: number;
  /** North/south, miniature world units. +Z = north (Three.js forward is -Z). */
  z: number;
}

export function metersPerDegreeLon(latitude: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
}

// Piecewise cartographic compression: an expanded old town surrounded by short
// coastal/northern corridors. Monotonic and invertible, so source links remain exact.
const LAT_CORE = [22.333, 22.3465] as const;
const LON_CORE = [91.827, 91.8395] as const;
const OUTER_SCALE = 0.055;
function compress(value: number, core: readonly [number, number]): number {
  if (value < core[0]) return core[0] * DISTRICT_SCALE + (value-core[0]) * OUTER_SCALE;
  if (value > core[1]) return core[1] * DISTRICT_SCALE + (value-core[1]) * OUTER_SCALE;
  return value * DISTRICT_SCALE;
}
function expand(value: number, core: readonly [number, number]): number {
  if (value < core[0]*DISTRICT_SCALE) return core[0] + (value-core[0]*DISTRICT_SCALE)/OUTER_SCALE;
  if (value > core[1]*DISTRICT_SCALE) return core[1] + (value-core[1]*DISTRICT_SCALE)/OUTER_SCALE;
  return value/DISTRICT_SCALE;
}
export function geoToLocal(coord: GeoCoordinate): LocalPoint {
  const lonScale = metersPerDegreeLon(WORLD_CONFIG.origin.latitude);
  return {
    x: (compress(coord.longitude,LON_CORE) - compress(WORLD_CONFIG.origin.longitude,LON_CORE)) * lonScale,
    z: (compress(coord.latitude,LAT_CORE) - compress(WORLD_CONFIG.origin.latitude,LAT_CORE)) * METERS_PER_DEGREE_LAT,
  };
}

export interface LocalBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

let cachedBounds: LocalBounds | null = null;

/** World-local bounds of the playable district. */
export function localWorldBounds(): LocalBounds {
  if (cachedBounds) return cachedBounds;
  const sw = geoToLocal({
    latitude: WORLD_CONFIG.bounds.south,
    longitude: WORLD_CONFIG.bounds.west,
  });
  const ne = geoToLocal({
    latitude: WORLD_CONFIG.bounds.north,
    longitude: WORLD_CONFIG.bounds.east,
  });
  cachedBounds = {
    minX: Math.min(sw.x, ne.x),
    maxX: Math.max(sw.x, ne.x),
    minZ: Math.min(sw.z, ne.z),
    maxZ: Math.max(sw.z, ne.z),
  };
  return cachedBounds;
}

/** Keeps a position inside the district (with an optional inset margin). */
export function clampToWorld(x: number, z: number, margin = 0): [number, number] {
  const b = localWorldBounds();
  return [
    Math.max(b.minX + margin, Math.min(b.maxX - margin, x)),
    Math.max(b.minZ + margin, Math.min(b.maxZ - margin, z)),
  ];
}

export function localToGeo(point: LocalPoint): GeoCoordinate {
  const lonScale = metersPerDegreeLon(WORLD_CONFIG.origin.latitude);
  return {
    latitude: expand(compress(WORLD_CONFIG.origin.latitude,LAT_CORE) + point.z / METERS_PER_DEGREE_LAT,LAT_CORE),
    longitude: expand(compress(WORLD_CONFIG.origin.longitude,LON_CORE) + point.x / lonScale,LON_CORE),
  };
}
