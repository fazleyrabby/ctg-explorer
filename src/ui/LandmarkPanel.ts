import type { NamedBuilding } from "@/world/Buildings";
import { localToGeo } from "@/geography/Projection";
import { fetchLandmarkInfo } from "@/landmarks/LandmarkInfo";

/**
 * Landmark information panel (spec §32, §33a).
 *
 * Shows name, category and geographic position from OSM, then enriches with a
 * Wikipedia extract (CC BY-SA) when available. Content is attributed and links
 * out to the source. Live OSM/OSM-Wikipedia lookups happen only when opened.
 */
export class LandmarkPanel {
  private readonly root: HTMLDivElement;
  private readonly nameEl: HTMLElement;
  private readonly metaEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly linkEl: HTMLAnchorElement;
  private readonly imgEl: HTMLImageElement;
  private readonly creditEl: HTMLElement;

  private opened = false;
  private requestId = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "landmark-panel";
    this.root.hidden = true;
    this.root.innerHTML = `
      <button class="landmark-panel__close" type="button" aria-label="Close">&times;</button>
      <div class="landmark-panel__name"></div>
      <div class="landmark-panel__meta"></div>
      <img class="landmark-panel__img" alt="" hidden />
      <div class="landmark-panel__body"></div>
      <a class="landmark-panel__link" target="_blank" rel="noopener"></a>
      <div class="landmark-panel__credit"></div>
    `;
    parent.appendChild(this.root);

    this.nameEl = this.root.querySelector(".landmark-panel__name") as HTMLElement;
    this.metaEl = this.root.querySelector(".landmark-panel__meta") as HTMLElement;
    this.bodyEl = this.root.querySelector(".landmark-panel__body") as HTMLElement;
    this.linkEl = this.root.querySelector(".landmark-panel__link") as HTMLAnchorElement;
    this.imgEl = this.root.querySelector(".landmark-panel__img") as HTMLImageElement;
    this.creditEl = this.root.querySelector(".landmark-panel__credit") as HTMLElement;

    (this.root.querySelector(".landmark-panel__close") as HTMLButtonElement).addEventListener(
      "click",
      () => this.hide(),
    );
  }

  get isOpen(): boolean {
    return this.opened;
  }

  async show(landmark: NamedBuilding): Promise<void> {
    this.opened = true;
    this.root.hidden = false;

    const geo = localToGeo({ x: landmark.x, z: landmark.z });
    const osmUrl = /^(way|node|relation)\/\d+$/.test(landmark.id)
      ? `https://www.openstreetmap.org/${landmark.id}`
      : `https://www.openstreetmap.org/?mlat=${geo.latitude}&mlon=${geo.longitude}#map=18/${geo.latitude}/${geo.longitude}`;

    this.nameEl.textContent = landmark.name;
    this.metaEl.textContent = `${titleCase(landmark.type)} · ${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
    this.bodyEl.textContent = landmark.description ?? "Loading information…";
    this.linkEl.href = osmUrl;
    this.linkEl.textContent = "View on OpenStreetMap ↗";
    this.creditEl.textContent = "Data: OpenStreetMap contributors (ODbL)";
    this.imgEl.hidden = true;
    this.imgEl.removeAttribute("src");

    const requestId = ++this.requestId;
    const info = await fetchLandmarkInfo(landmark);
    if (requestId !== this.requestId || !this.opened) return;

    if (!info) {
      if (!landmark.description) {
        this.bodyEl.textContent =
          "No description available yet. This place is mapped in OpenStreetMap but has no linked encyclopedia article.";
      }
      return;
    }

    this.bodyEl.textContent = info.extract;
    if (info.url) {
      this.linkEl.href = info.url;
      this.linkEl.textContent = `Read “${info.title}” on Wikipedia ↗`;
    }
    if (info.thumbnail) {
      this.imgEl.src = info.thumbnail;
      this.imgEl.hidden = false;
    }
    this.creditEl.textContent =
      info.source === "wikipedia"
        ? "Sources: OpenStreetMap (ODbL) · Wikipedia (CC BY-SA)"
        : "Source: OpenStreetMap contributors (ODbL)";
  }

  hide(): void {
    this.opened = false;
    this.requestId++;
    this.root.hidden = true;
  }
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
