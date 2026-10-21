// Trace player: owns the replay position and timing. No DOM; the renderer and editor subscribe
// via onFrame. Timers are injectable so the player is unit-tested in Node.
import { SENSORS } from "./frames.js";

export const MAX_PLAY_MS = 30_000;
const TICK_MS = 16;

export class TracePlayer {
  /**
   * @param {object} opts
   * @param {(frame, index, total) => void} opts.onFrame   called for every shown frame
   * @param {(playing: boolean) => void} [opts.onPlayState]
   * @param {() => void} [opts.onEnd]                        reached the last frame while playing
   * @param {number} [opts.stepsPerSecond=4]
   */
  constructor({ onFrame, onPlayState = () => {}, onEnd = () => {}, stepsPerSecond = 4,
                setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
    Object.assign(this, { onFrame, onPlayState, onEnd, setTimer, clearTimer });
    this.frames = [];
    this.index = 0;
    this.playing = false;
    this.timer = null;
    this.setSpeed(stepsPerSecond);
  }

  get total() { return this.frames.length; }
  get atEnd() { return this.index >= this.frames.length - 1; }

  load(frames) {
    this.pause();
    this.frames = frames;
    this.index = 0;
    this._emit();
  }

  /** Steps per second; sensor checks take 40% of a step so movement stays the focus. */
  setSpeed(stepsPerSecond) {
    this.stepMs = 1000 / Math.max(0.25, Math.min(60, stepsPerSecond));
  }

  /** A long run (a loop that hit the step cap: 10,000 steps) still plays in at most MAX_PLAY_MS,
   *  speeding up past the chosen speed, so its result doesn't wait half an hour. */
  delayFor(frame) {
    const ms = Math.min(this.stepMs, MAX_PLAY_MS / Math.max(1, this.frames.length - 1));
    return frame?.event && SENSORS.has(frame.event.action) ? ms * 0.4 : ms;
  }

  play() {
    if (!this.frames.length) return;
    if (this.atEnd) {
      this.index = 0;
      this._emit();
    }
    this.playing = true;
    this.onPlayState(true);
    this._schedule();
  }

  pause() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (this.playing) {
      this.playing = false;
      this.onPlayState(false);
    }
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  step(delta = 1) {
    this.pause();
    this.seek(this.index + delta);
  }

  seek(index) {
    const clamped = Math.max(0, Math.min(this.frames.length - 1, index));
    if (clamped === this.index && this.frames.length) return;
    this.index = clamped;
    this._emit();
  }

  toEnd() { this.pause(); this.seek(this.frames.length - 1); }

  _schedule() {
    // Faster than a screen refresh (a long run, see delayFor): move several steps per tick, since
    // timers can't fire that often and the screen couldn't show it anyway.
    const delay = this.delayFor(this.frames[this.index + 1]);
    const per = delay < TICK_MS ? Math.ceil(TICK_MS / delay) : 1;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (!this.playing) return;
      this.index = Math.min(this.frames.length - 1, this.index + per);
      this._emit();
      if (this.atEnd) {
        this.pause();
        this.onEnd();
      } else {
        this._schedule();
      }
    }, per > 1 ? TICK_MS : delay);
  }

  _emit() {
    if (this.frames.length) this.onFrame(this.frames[this.index], this.index, this.frames.length);
  }
}
