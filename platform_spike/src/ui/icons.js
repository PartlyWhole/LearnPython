// A small icon set, so controls can be pictures instead of words (the UI stays minimal and
// visual). Every icon is a 24-unit stroke drawing in currentColor. A button using one must
// carry its own aria-label (and title, for a hover hint); the svg itself is aria-hidden.
const PATHS = {
  back: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  replay: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  eye: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z",
  steps: "M9 6.5h10M9 12h10M9 17.5h10M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01",
  // Drive-mode commands: forward, turn left (a road-sign arrow), and a gem lifted / set down.
  move: "M12 19V5M6 11l6-6 6 6",
  turn_left: "M17 20v-7a4 4 0 0 0-4-4H6M10 5L6 9l4 4",
  pick: "M12 11.5l4 3.5-4 5-4-5zM12 2.5v5.5M9.5 5l2.5-2.5L14.5 5",
  put: "M12 11.5l4 3.5-4 5-4-5zM12 2.5v5.5M9.5 5.5L12 8l2.5-2.5",
  undo: "M9 14l-5-5 5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  stop: "M7 7h10v10H7z",
  step_back: "M7 6v12M18 6l-8 6 8 6z",
  step_fwd: "M17 6v12M6 6l8 6-8 6z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.2a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2.2-2.4 3.6M12 17h.01",
  levels: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z",
  dot: "M12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z",
  eye_off: "M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2",
  bag: "M5.5 8.5h13l-1.2 11.5H6.7zM9 8.5V7a3 3 0 0 1 6 0v1.5",
  gem: "M12 4l6.5 6-6.5 10-6.5-10zM5.5 10h13",
  speed: "M4 18h2.5M9 18v-4M13 18v-8M17 18V6",
  output: "M4 5h16v14H4zM7.5 10l3 2.5-3 2.5M12.5 15h4",
  star: "M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.4-4.1 6-.8z",
  gear: "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7.6 7.6 0 0 1-2 1.2l-.3 2h-3.6l-.3-2a7.6 7.6 0 0 1-2-1.2l-1.9.7L5.4 14.7l1.6-1.2a7.7 7.7 0 0 1 0-3l-1.6-1.2 1.8-3.1 1.9.7a7.6 7.6 0 0 1 2-1.2l.3-2h3.6l.3 2a7.6 7.6 0 0 1 2 1.2l1.9-.7 1.8 3.1-1.6 1.2a7.7 7.7 0 0 1 0 3z",
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">` +
    `<path d="${PATHS[name]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Fill every <button data-icon="name"> with its icon (labels live in aria-label), and every
 *  <span data-glyph="name"> with a decorative icon (the text next to it carries the meaning). */
export function applyIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon], [data-glyph]")) {
    el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon ?? el.dataset.glyph));
  }
}

/** Swap a button's icon (Play ↔ Pause). */
export function setIcon(el, name) {
  el.querySelector("svg.icon")?.remove();
  el.insertAdjacentHTML("afterbegin", icon(name));
}

/** Progress dots: one per step, done ones checked, the current one filled. Purely visual. */
export function renderDots(container, total, current, { done = current } = {}) {
  container.replaceChildren(...Array.from({ length: total }, (_, i) => {
    const dot = document.createElement("span");
    dot.className = `dot${i < done ? " done" : ""}${i === current ? " now" : ""}`;
    return dot;
  }));
}
