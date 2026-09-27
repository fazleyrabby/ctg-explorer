import "@/style.css";
import { Game } from "@/core/Game";
import { initVisitorCounter } from "@/visitorCounter";

const canvas = document.getElementById("game-canvas");
const hudRoot = document.getElementById("hud");
const loading = document.getElementById("loading");

if (!(canvas instanceof HTMLCanvasElement) || !(hudRoot instanceof HTMLElement)) {
  throw new Error("Game canvas or HUD root not found in the document.");
}

const game = new Game(canvas, hudRoot);

// Debug handle for development tooling (spec §80).
(window as unknown as { __CTG__: Game }).__CTG__ = game;

try {
  await game.load();
  loading?.remove();
  game.start();
  void initVisitorCounter();
} catch (error) {
  console.error(error);
  if (loading) {
    loading.querySelector(".loading__text")!.textContent =
      "Failed to load world. See console.";
  }
}
