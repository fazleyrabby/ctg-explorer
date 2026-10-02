import type { QualityLevel } from "@/core/Quality";

const STORAGE_KEY = "chattogram:save";
const VERSION = 1;

export interface SaveData {
  /** Ids of discovered landmarks, in discovery order. */
  discovered: string[];
  /** Id of the quest being followed, if the visitor picked one. */
  quest?: string;
  quality?: QualityLevel;
}

/**
 * Visitor progress in localStorage: discoveries (which drive the History
 * Notebook and every quest), the chosen quest and the quality preset. Storage
 * can be unavailable (private windows, blocked site data), so every access is
 * guarded and the game runs without it.
 */
export class SaveGame {
  readonly data: SaveData;

  constructor() {
    this.data = SaveGame.read();
  }

  private static read(): SaveData {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as
        | (Partial<SaveData> & { v?: number })
        | null;
      if (raw && raw.v === VERSION && Array.isArray(raw.discovered)) {
        const data: SaveData = { discovered: raw.discovered.filter((id) => typeof id === "string") };
        if (typeof raw.quest === "string") data.quest = raw.quest;
        if (raw.quality === "low" || raw.quality === "medium" || raw.quality === "high") data.quality = raw.quality;
        return data;
      }
    } catch {
      /* storage unavailable or corrupt */
    }
    return { discovered: [] };
  }

  private write(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ...this.data }));
    } catch {
      /* storage unavailable */
    }
  }

  addDiscovery(id: string): void {
    if (this.data.discovered.includes(id)) return;
    this.data.discovered.push(id);
    this.write();
  }

  setQuest(id: string): void {
    this.data.quest = id;
    this.write();
  }

  setQuality(level: QualityLevel): void {
    this.data.quality = level;
    this.write();
  }

  /** Forgets discoveries and the chosen quest; display preferences are kept. */
  resetProgress(): void {
    this.data.discovered = [];
    delete this.data.quest;
    this.write();
  }
}
