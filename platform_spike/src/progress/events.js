// Local event log for playtests (docs/lessons.md section 10). The app has no server, so events
// stay in this browser: the last CAP events, in storage that is wrapped like progress (a full or
// missing store never breaks the game). Export with download() for a playtest session.
const KEY = "gem-rover/events/v1";
export const CAP = 500;

export class EventLog {
  /** @param {{get, set}} storage  @param {() => number} now */
  constructor(storage, now = () => Date.now()) {
    this.storage = storage;
    this.now = now;
    try {
      const raw = JSON.parse(storage.get(KEY) ?? "[]");
      this.events = Array.isArray(raw) ? raw : [];
    } catch {
      this.events = [];
    }
  }

  /** type: e.g. "run", "level.solved", "hint.opened"; data: small plain values only. */
  record(type, data = {}) {
    this.events.push({ t: this.now(), type, ...data });
    if (this.events.length > CAP) this.events.splice(0, this.events.length - CAP);
    this.storage.set(KEY, JSON.stringify(this.events));
  }

  /** The log as a JSON file a playtester can send. */
  toBlob() { return new Blob([JSON.stringify(this.events, null, 1)], { type: "application/json" }); }
}
