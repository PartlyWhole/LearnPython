// Panel layout: a draggable divider between the editor and the world, the top row filling the
// window height, and a fullscreen button on each panel. The split is a per-browser convenience in
// localStorage (wrapped: a missing or blocked store just means the default split).

export const SPLIT = Object.freeze({ min: 0.25, max: 0.75, initial: 0.5, step: 0.03 });
const KEY = "learnpython/layout/v1";

/** Keep the editor's share of the width within reach of both panels. */
export function clampSplit(f) {
  return Number.isFinite(f) ? Math.min(SPLIT.max, Math.max(SPLIT.min, f)) : SPLIT.initial;
}

/** The divider's position from a pointer x, relative to the layout's left edge and width. */
export function splitFromPointer(x, left, width) {
  return clampSplit((x - left) / width);
}

export function loadSplit(storage = globalThis.localStorage) {
  try { return clampSplit(JSON.parse(storage?.getItem(KEY) ?? "null")?.split); } catch { return SPLIT.initial; }
}

export function saveSplit(f, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ split: clampSplit(f) })); } catch { /* private mode: fine */ }
}

/**
 * Wire the page. els: {layout, splitter, editorPanel, worldPanel, fullscreenButtons: [{button, panel}]}
 * onResize(): called when panel sizes change (CodeMirror re-measures).
 */
export function setupLayout({ layout, splitter, fullscreenButtons, icon, onResize = () => {} }) {
  let split = loadSplit();
  const apply = () => {
    layout.style.setProperty("--split", String(split));
    splitter.setAttribute("aria-valuenow", String(Math.round(split * 100)));
    onResize();
  };
  apply();

  // The top row fills what's left of the window below the header (the editor was a fixed 300px).
  const fit = () => {
    const top = layout.getBoundingClientRect().top + window.scrollY;
    layout.style.setProperty("--avail", `${Math.max(420, window.innerHeight - top - 24)}px`);
    onResize();
  };
  fit();
  window.addEventListener("resize", fit);
  new ResizeObserver(fit).observe(document.querySelector("header.top"));

  // Drag (mouse, pen, touch), keyboard (arrows, Home/End), double-click to reset.
  splitter.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    layout.classList.add("resizing");
    const move = (ev) => {
      const r = layout.getBoundingClientRect();
      split = splitFromPointer(ev.clientX, r.left, r.width);
      apply();
    };
    const up = () => {
      splitter.removeEventListener("pointermove", move);
      layout.classList.remove("resizing");
      saveSplit(split);
    };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", up, { once: true });
    splitter.addEventListener("pointercancel", up, { once: true });
  });
  splitter.addEventListener("keydown", (e) => {
    const next = { ArrowLeft: split - SPLIT.step, ArrowRight: split + SPLIT.step, Home: SPLIT.min, End: SPLIT.max }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    split = clampSplit(next);
    apply();
    saveSplit(split);
  });
  splitter.addEventListener("dblclick", () => { split = SPLIT.initial; apply(); saveSplit(split); });

  // Fullscreen: the browser's own where available (Esc exits), else a full-window panel.
  const isFull = (panel) => document.fullscreenElement === panel || panel.classList.contains("is-max");
  const sync = () => {
    for (const { button, panel } of fullscreenButtons) {
      const full = isFull(panel);
      button.querySelector("svg.icon")?.remove();
      button.insertAdjacentHTML("afterbegin", icon(full ? "minimize" : "maximize"));
      button.setAttribute("aria-label", full ? "Exit full screen" : "Full screen");
      button.title = full ? "Exit full screen (Esc)" : "Full screen";
    }
    onResize();
  };
  for (const { button, panel } of fullscreenButtons) {
    button.addEventListener("click", async () => {
      if (isFull(panel)) {
        if (document.fullscreenElement === panel) await document.exitFullscreen();
        panel.classList.remove("is-max");
      } else if (panel.requestFullscreen && document.fullscreenEnabled) {
        // Some embedded browsers neither grant nor refuse: if nothing happens soon, fill the window.
        const timeout = new Promise((resolve) => setTimeout(resolve, 800));
        try { await Promise.race([panel.requestFullscreen(), timeout]); } catch { /* refused */ }
        if (document.fullscreenElement !== panel) panel.classList.add("is-max");
      } else {
        panel.classList.add("is-max");
      }
      sync();
    });
  }
  document.addEventListener("fullscreenchange", () => {
    // A late grant after the fallback: keep one mechanism, the real one.
    if (document.fullscreenElement) document.fullscreenElement.classList.remove("is-max");
    sync();
  });
  document.addEventListener("keydown", (e) => {
    const maxed = document.querySelector(".panel.is-max");
    if (e.key === "Escape" && maxed && !e.defaultPrevented) { maxed.classList.remove("is-max"); sync(); }
  });
  sync();
}
