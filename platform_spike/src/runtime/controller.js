// Run controller: owns the Pyodide workers, the wall-clock timeout and Stop.
//
// Two workers are kept: an active one that runs code and a spare that is already loading or
// loaded. When a run must be killed (timeout or Stop), the active worker is terminated, the
// spare is promoted and a new spare starts loading in the background. Terminating is the only
// way to stop a loop that never calls the robot API (docs/decisions.md D5).
//
// Browser-free by design: the worker factory and timers are injected, so the controller is
// unit-tested in Node with fake workers (tests/js/controller.test.mjs).
import { MSG } from "./protocol.js";

/** Wraps one worker: a ready promise plus request/response matching by id. */
class PooledWorker {
  constructor(createWorker) {
    this.worker = createWorker();
    this.pending = new Map();
    this.info = null;
    this.dead = false;
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      this.worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === MSG.READY) {
          this.info = { loadMs: msg.loadMs, python: msg.python };
          resolve(this.info);
        } else if (msg.type === MSG.LOAD_FAILED) {
          reject(new Error(msg.message));
        } else if (msg.id !== undefined && this.pending.has(msg.id)) {
          this.pending.get(msg.id)(msg);
          this.pending.delete(msg.id);
        }
      };
      this.worker.onerror = (event) => {
        const err = new Error(event?.message || "worker error");
        reject(err);
        for (const settle of this.pending.values()) settle({ type: MSG.FAILED, message: err.message });
        this.pending.clear();
      };
    });
    this.ready.catch(() => {}); // surfaced through run() / start()
  }

  request(message) {
    return new Promise((resolve) => {
      this.pending.set(message.id, resolve);
      this.worker.postMessage(message);
    });
  }

  terminate() {
    this.dead = true;
    this.worker.terminate();
    // Anything still waiting for this worker to load must stop waiting (a run that was
    // queued behind a cold worker and then stopped would otherwise hang forever).
    this.rejectReady(new Error("worker terminated"));
    for (const settle of this.pending.values()) settle({ type: "terminated" });
    this.pending.clear();
  }
}

export class RunController {
  /**
   * @param {object} opts
   * @param {() => Worker} opts.createWorker  factory returning a Worker-like object
   * @param {number} [opts.timeoutMs=5000]    wall-clock limit for one request
   * @param {(state: string, detail?: object) => void} [opts.onState]
   * @param {Function} [opts.setTimer] / [opts.clearTimer]  injectable timers (tests)
   */
  constructor({ createWorker, timeoutMs = 5000, onState = () => {},
                setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
    this.createWorker = createWorker;
    this.timeoutMs = timeoutMs;
    this.onState = onState;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.active = null;
    this.spare = null;
    this.current = null; // { settle, timer } while a request is in flight
    this.nextId = 1;
    this.state = "idle";
  }

  _setState(state, detail) {
    this.state = state;
    this.onState(state, detail);
  }

  /** Start both workers. Resolves when the active worker is ready to run code. */
  async start() {
    if (!this.active) {
      this._setState("loading");
      this.active = new PooledWorker(this.createWorker);
      this.spare = new PooledWorker(this.createWorker);
    }
    const worker = this.active;
    try {
      const info = await worker.ready;
      if (!this.current) this._setState("ready", info);
      return info;
    } catch (err) {
      // Replaced by Stop/timeout while loading: wait for the worker that took over instead.
      if (this.active && this.active !== worker) return this.start();
      this._setState("load_failed", { message: err.message });
      throw err;
    }
  }

  /**
   * Run one request ({type: "run"|"check", ...}). Resolves to one of:
   *   { status: "done", payload }      finished; learner errors are inside payload
   *   { status: "timeout" }            killed after timeoutMs
   *   { status: "stopped" }            killed by stop()
   *   { status: "failed", message }    the runtime itself failed
   *   { status: "busy" }               another request is still running
   */
  async run(request) {
    if (this.current) return { status: "busy" };
    if (!this.active) this.start().catch(() => {});
    const worker = this.active;
    let settle;
    const outcome = new Promise((resolve) => { settle = resolve; });
    this.current = { settle, timer: null };
    this._setState("running");

    try {
      await worker.ready;
    } catch (err) {
      this._finish({ status: "failed", message: err.message });
      return outcome;
    }
    if (!this.current || this.active !== worker) return outcome; // stopped while waiting to load

    this.current.timer = this.setTimer(() => this._kill("timeout"), this.timeoutMs);
    worker.request({ ...request, id: this.nextId++ }).then((msg) => {
      if (msg.type === MSG.RESULT) this._finish({ status: "done", payload: msg.payload });
      else if (msg.type === MSG.FAILED) this._finish({ status: "failed", message: msg.message });
      // "terminated" means _kill already settled this run
    });
    return outcome;
  }

  /** Stop the running request, if any. */
  stop() {
    if (this.current) this._kill("stopped");
  }

  _finish(result) {
    if (!this.current) return;
    const { settle, timer } = this.current;
    if (timer !== null) this.clearTimer(timer);
    this.current = null;
    this._setState(this.active?.info ? "ready" : "loading", this.active?.info ?? undefined);
    settle(result);
  }

  _kill(reason) {
    const dying = this.active;
    this.active = this.spare;
    this.spare = new PooledWorker(this.createWorker);
    this._finish({ status: reason });
    dying.terminate();
    // The promoted spare may still be loading; report "restarting" until it is ready.
    if (!this.active.info) {
      this._setState("restarting");
      this.active.ready.then((info) => { if (!this.current) this._setState("ready", info); }).catch(() => {});
    }
  }

  dispose() {
    this.stop();
    this.active?.terminate();
    this.spare?.terminate();
    this.active = this.spare = null;
    this._setState("disposed");
  }
}
