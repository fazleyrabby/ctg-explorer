export type CurvatureMode = "flat" | "curved" | "spherical";

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface WorldBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface WorldConfig {
  city: string;
  country: string;
  /** Geographic bounding box of the playable region (WGS84). */
  bounds: WorldBounds;
  /** Geographic coordinate that maps to local world origin (0, 0, 0). */
  origin: GeoCoordinate;
  /** Where the player spawns, in WGS84. */
  spawn: GeoCoordinate;
  curvature: {
    mode: CurvatureMode;
    /**
     * Radius used by the spherical/curved surface approximation, in meters.
     * Smaller radius = more exaggerated local curvature. This is intentionally
     * NOT Earth scale (Earth is ~6,371,000 m) so the curve reads on a city slice.
     */
    radius: number;
  };
  /** Chunk size in meters (see spec §21). */
  chunkSize: number;
  /** Sea level in meters, added to the curved surface. */
  seaLevel: number;
}

export const WORLD_CONFIG: WorldConfig = {
  city: "Chattogram",
  country: "Bangladesh",
  // Wider city: the old city retains detail; outer corridors compress more strongly.
  bounds: {
    north: 22.387,
    south: 22.221,
    east: 91.873,
    west: 91.756,
  },
  origin: {
    latitude: 22.344,
    longitude: 91.834,
  },
  spawn: {
    latitude: 22.3437,
    longitude: 91.8336,
  },
  curvature: {
    mode: "flat",
    // Flat miniature base with authored, gentle hill relief.
    radius: 3_000_000,
  },
  chunkSize: 500,
  seaLevel: 0,
};

/** Compress travel distances while retaining the geographic layout. */
export const DISTRICT_SCALE = 0.45;
