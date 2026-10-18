// A sandbox for running code that isn't (only) yours: in a shared room, pressing Run executes text
// a partner typed. Python in Pyodide can reach the browser through `import js` (CLAUDE.md
// invariant 6), so in a room the workers run inside a hidden iframe that has
//   - an opaque origin (sandbox="allow-scripts", no allow-same-origin): no cookies, no
//     localStorage or IndexedDB of this site, no access to this page's DOM;
//   - its own Content-Security-Policy: network only to the Pyodide CDN, so code can't send
//     anything anywhere (not even to the room's relay), and no frames, forms or navigation.
// The workers are the ordinary src/runtime/worker.js, run as blob workers (they inherit the
// frame's origin and policy) and handed engine.py by message. Everything they send back is data
// to be checked (src/runtime/validate.js), never trusted. Decision D23, docs/collab.md.
//
// SandboxedWorker has the Worker interface the run controller uses (onmessage, onerror,
// postMessage, terminate), so the controller is unchanged (createWorker is injected, invariant 10).

const PYODIDE_HOST = "https://cdn.jsdelivr.net";
export const SANDBOX_CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${PYODIDE_HOST}`,
  "worker-src blob:",
  `connect-src ${PYODIDE_HOST}`,
  "frame-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

// The frame's only script: build the worker from the source it is given, then relay messages
// between the page and each worker. It answers only its parent window.
const HOST_SCRIPT = `
const workers = new Map();
let url = null, engine = "";
addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const m = e.data || {};
  if (m.kind === "boot" && !url) {
    url = URL.createObjectURL(new Blob([m.workerSource], { type: "text/javascript" }));
    engine = m.engineSource;
    parent.postMessage({ kind: "booted" }, "*");
  } else if (m.kind === "spawn" && url && !workers.has(m.wid)) {
    const w = new Worker(url, { name: "sandbox" }); // classic: module workers fail in opaque origins
    workers.set(m.wid, w);
    w.onmessage = (ev) => parent.postMessage({ kind: "msg", wid: m.wid, data: ev.data }, "*");
    w.onerror = (ev) => { ev.preventDefault?.(); parent.postMessage({ kind: "error", wid: m.wid, message: String(ev.message || "worker error") }, "*"); };
    w.postMessage({ type: "engine", source: engine });
  } else if (m.kind === "post") {
    workers.get(m.wid)?.postMessage(m.data);
  } else if (m.kind === "kill") {
    workers.get(m.wid)?.terminate();
    workers.delete(m.wid);
  }
});
parent.postMessage({ kind: "loaded" }, "*");
`;

export function sandboxDocument() {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><script>${HOST_SCRIPT}</script>`;
}

/** One hidden sandbox frame hosting any number of workers. */
export class SandboxHost {
  /** @param {{workerUrl: URL, engineUrl: URL, doc?: Document}} opts */
  constructor({ workerUrl, engineUrl, doc = document }) {
    this.workers = new Map();
    this.nextId = 1;
    this.frame = doc.createElement("iframe");
    this.frame.setAttribute("sandbox", "allow-scripts");
    this.frame.setAttribute("aria-hidden", "true");
    this.frame.tabIndex = -1;
    this.frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    this.frame.srcdoc = sandboxDocument();
    const sources = Promise.all([
      fetch(workerUrl, { cache: "no-store" }).then((r) => r.text()),
      fetch(engineUrl, { cache: "no-store" }).then((r) => r.text()),
    ]);
    this.booted = new Promise((resolve, reject) => {
      addEventListener("message", (e) => {
        if (e.source !== this.frame.contentWindow) return; // only our frame, never other windows
        const m = e.data || {};
        if (m.kind === "loaded") {
          sources.then(([workerSource, engineSource]) => this.frame.contentWindow.postMessage(
            { kind: "boot", workerSource, engineSource }, "*"), reject);
        } else if (m.kind === "booted") {
          resolve();
        } else if ((m.kind === "msg" || m.kind === "error") && this.workers.has(m.wid)) {
          this.workers.get(m.wid)._receive(m);
        }
      });
    });
    doc.body.append(this.frame);
  }

  spawn(worker) {
    const wid = this.nextId++;
    this.workers.set(wid, worker);
    this.booted.then(() => this._send({ kind: "spawn", wid }));
    return wid;
  }

  post(wid, data) { this.booted.then(() => this._send({ kind: "post", wid, data })); }

  kill(wid) {
    this.workers.delete(wid);
    this.booted.then(() => this._send({ kind: "kill", wid }));
  }

  _send(m) { this.frame.contentWindow?.postMessage(m, "*"); }
}

/** A Worker-shaped handle on a worker inside the sandbox. */
export class SandboxedWorker {
  constructor(host) {
    this.host = host;
    this.onmessage = null;
    this.onerror = null;
    this.wid = host.spawn(this);
  }

  postMessage(data) { this.host.post(this.wid, data); }

  terminate() { this.host.kill(this.wid); }

  _receive(m) {
    if (m.kind === "msg") this.onmessage?.({ data: m.data });
    else this.onerror?.({ message: m.message });
  }
}
