import type { NamedBuilding } from "@/world/Buildings";
import type { HUD } from "@/ui/HUD";
import type { QuestBeacon } from "@/world/QuestBeacon";
import type { Quest, QuestStop } from "@/quests/quest";

/**
 * Tracks quest progress (spec §75). A stop is complete once its landmark has
 * been discovered (player walks within range), whichever quest was active at
 * the time, so switching routes never loses a visit. The current objective
 * drives the HUD tracker, the world beacon and the minimap marker.
 */
export class QuestManager {
  private readonly discovered = new Set<string>();
  private quest: Quest;

  constructor(
    private readonly quests: readonly Quest[],
    private readonly landmarks: NamedBuilding[],
    private readonly hud: HUD,
    private readonly beacon: QuestBeacon,
    private readonly onSelect?: (id: string) => void,
  ) {
    this.quest = quests[0]!;
    this.hud.setQuestChoices(
      quests.map((quest) => ({ id: quest.id, title: quest.title })),
      (id) => {
        this.select(id);
        this.onSelect?.(id);
      },
    );
    this.refresh();
  }

  get activeId(): string {
    return this.quest.id;
  }

  get total(): number {
    return this.quest.stops.length;
  }

  get completed(): number {
    return this.quest.stops.filter((stop) => this.discovered.has(stop.landmark)).length;
  }

  /** Switches the followed route; unknown ids are ignored. */
  select(id: string): void {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest || quest === this.quest) return;
    this.quest = quest;
    this.refresh();
  }

  currentStop(): QuestStop | null {
    return this.quest.stops.find((stop) => !this.discovered.has(stop.landmark)) ?? null;
  }

  currentLandmark(): NamedBuilding | null {
    const stop = this.currentStop();
    if (!stop) return null;
    return this.landmarks.find((l) => l.name === stop.landmark) ?? null;
  }

  /** Called by the discovery system when a landmark is first reached. */
  notifyDiscovered(name: string): void {
    if (this.discovered.has(name)) return;
    this.discovered.add(name);
    this.refresh();
  }

  reset(): void {
    this.discovered.clear();
    this.quest = this.quests[0]!;
    this.refresh();
  }

  update(): void {
    this.beacon.setTarget(this.currentLandmark());
  }

  private refresh(): void {
    const current = this.currentStop();
    this.hud.setQuest(
      this.quest.id,
      this.quest.subtitle,
      current ? current.landmark : null,
      this.completed,
      this.total,
    );
  }
}
