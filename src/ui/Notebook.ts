import type { NamedBuilding } from "@/world/Buildings";

/**
 * History notebook / discovery log (spec §33a, §75): collects the landmarks the
 * player has reached, with a completion count. Opening an entry shows its story.
 * Toggle with **H**.
 */
export class Notebook {
  private readonly root: HTMLDivElement;
  private readonly countEl: HTMLElement;
  private readonly listEl: HTMLElement;

  private readonly seen = new Set<string>();
  private readonly entries: NamedBuilding[] = [];
  private opened = false;

  constructor(
    parent: HTMLElement,
    private total: number,
    private readonly onSelect: (name: string) => void,
    private readonly onReset?: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "notebook";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="notebook__head">
        <div>
          <div class="notebook__title">History Notebook</div>
          <div class="notebook__count" data-count>0 / ${total}</div>
        </div>
        <button class="notebook__close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="notebook__hint">Walk up to places to record them. Click a story to read it.</div>
      <div class="notebook__list" data-list></div>
      <div class="notebook__foot">
        <span>Progress is saved in this browser.</span>
        <button class="notebook__reset" type="button">Reset progress</button>
      </div>
    `;
    parent.appendChild(this.root);

    this.countEl = this.root.querySelector("[data-count]") as HTMLElement;
    this.listEl = this.root.querySelector("[data-list]") as HTMLElement;
    (this.root.querySelector(".notebook__close") as HTMLButtonElement).addEventListener("click", () =>
      this.close(),
    );

    (this.root.querySelector(".notebook__reset") as HTMLButtonElement).addEventListener("click", () => {
      if (this.entries.length === 0) return;
      if (window.confirm("Forget every recorded place and quest stop?")) this.onReset?.();
    });

    // Click outside closes it.
    document.addEventListener("pointerdown", (event) => {
      if (this.opened && event.target instanceof Node && !this.root.contains(event.target)) {
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  setTotal(total: number): void {
    this.total = total;
    this.updateCount();
  }

  add(landmark: NamedBuilding): void {
    if (this.seen.has(landmark.id)) return;
    this.seen.add(landmark.id);
    this.entries.push(landmark);
    this.updateCount();
    if (this.opened) this.render();
  }

  /** Empties the log (used by Reset progress). */
  clear(): void {
    this.seen.clear();
    this.entries.length = 0;
    this.updateCount();
    if (this.opened) this.render();
  }

  toggle(): void {
    this.opened ? this.close() : this.open();
  }

  open(): void {
    this.opened = true;
    this.root.hidden = false;
    this.render();
  }

  close(): void {
    this.opened = false;
    this.root.hidden = true;
  }

  private updateCount(): void {
    this.countEl.textContent = `${this.entries.length} / ${this.total}`;
  }

  private render(): void {
    this.listEl.innerHTML = "";
    if (this.entries.length === 0) {
      this.listEl.innerHTML = `<div class="notebook__empty">No places recorded yet.</div>`;
      return;
    }
    for (const entry of this.entries) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "notebook__item";
      row.innerHTML = `<span class="notebook__name">${escapeHtml(entry.name)}</span><span class="notebook__type">${entry.type}</span>`;
      row.addEventListener("click", () => this.onSelect(entry.name));
      this.listEl.appendChild(row);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
