import type { NamedBuilding } from "@/world/Buildings";
import type { Player } from "@/player/Player";
import type { Input } from "@/player/Input";
import type { HUD } from "@/ui/HUD";
import type { LandmarkPanel } from "@/ui/LandmarkPanel";

const INTERACT_RANGE = 22;
const DISCOVER_RANGE = 34;

/**
 * Proximity interaction for landmarks (spec §31).
 *
 * Finds the nearest named place, shows an `[E] Explore` prompt, opens the info
 * panel on E or from a label click, and closes it on Escape.
 */
export class LandmarkManager {
  private readonly discovered = new Set<string>();

  constructor(
    private readonly landmarks: NamedBuilding[],
    private readonly panel: LandmarkPanel,
    private readonly hud: HUD,
    private readonly onDiscover?: (landmark: NamedBuilding, restored: boolean) => void,
  ) {}

  update(player: Player, input: Input): void {
    let best: NamedBuilding | null = null;
    let bestDistance = INTERACT_RANGE;
    for (const landmark of this.landmarks) {
      const dx = landmark.x - player.position.x;
      const dz = landmark.z - player.position.z;
      const distance = Math.hypot(dx, dz);

      // Discovery: reaching a landmark records it (notebook + quest).
      if (distance < DISCOVER_RANGE && !this.discovered.has(landmark.id)) {
        this.discovered.add(landmark.id);
        this.onDiscover?.(landmark, false);
      }

      if (distance < bestDistance) {
        best = landmark;
        bestDistance = distance;
      }
    }
    this.hud.setPrompt(
      best && !this.panel.isOpen ? `[E] Explore ${best.name}` : null,
    );

    if (input.wasPressed("KeyE") && best) {
      void this.panel.show(best);
    }
    if (input.wasPressed("Escape")) {
      this.panel.hide();
    }
  }

  /** Re-records saved discoveries (ids) without the visitor walking there again. */
  restore(ids: readonly string[]): void {
    for (const id of ids) {
      const landmark = this.landmarks.find((item) => item.id === id);
      if (!landmark || this.discovered.has(id)) continue;
      this.discovered.add(id);
      this.onDiscover?.(landmark, true);
    }
  }

  /** Forgets every discovery; places near the player are recorded again at once. */
  reset(): void {
    this.discovered.clear();
  }

  /** Opens the panel for a landmark by name (used by world-label clicks). */
  selectByName(name: string): void {
    const landmark = this.landmarks.find((item) => item.name === name);
    if (landmark) void this.panel.show(landmark);
  }
}
