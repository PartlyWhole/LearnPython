// Test doubles: a manual clock and a scriptable fake Worker.
import { MSG } from "../../src/runtime/protocol.js";

export class FakeClock {
  constructor() { this.now = 0; this.timers = new Map(); this.nextId = 1; }
  setTimer = (fn, ms) => { const id = this.nextId++; this.timers.set(id, { fn, at: this.now + ms }); return id; };
  clearTimer = (id) => { this.timers.delete(id); };
  /** Advance time, firing due timers in order (including ones they schedule). */
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
    }
    this.now = end;
  }
}

/**
 * Fake Worker. `behaviour(msg, worker)` decides what to do with each request:
 * return a payload to reply with RESULT, return null to never reply (simulates a hang).
 */
export function fakeWorkerFactory(behaviour, { loadOk = true } = {}) {
  const made = [];
  const create = () => {
    const w = {
      onmessage: null, onerror: null, terminated: false, received: [],
      postMessage(msg) {
        if (this.terminated) return;
        this.received.push(msg);
        const payload = behaviour(msg, this);
        if (payload !== null) queueMicrotask(() => !this.terminated && this.onmessage?.({ data: { type: MSG.RESULT, id: msg.id, payload } }));
      },
      terminate() { this.terminated = true; },
      emitReady() {
        this.onmessage?.({ data: loadOk ? { type: MSG.READY, loadMs: 10, python: "3.12.1" }
                                         : { type: MSG.LOAD_FAILED, message: "no network" } });
      },
    };
    made.push(w);
    return w;
  };
  return { create, made };
}

export const flush = () => new Promise((r) => setImmediate(r));
