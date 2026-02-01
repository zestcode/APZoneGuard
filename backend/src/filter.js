/**
 * Sliding-window smoothing (rolling average)
 *
 * Motivation:
 * - Wi-Fi RSSI fluctuates heavily indoors/warehouses; using a single RSSI sample causes position "jumping".
 * - A simple effective technique: average the latest N samples (N=5~10).
 *
 * This file provides:
 * - A per-key rolling average (RollingAverage)
 * - Key can be composite like "tag_id|ap_id" to smooth per Tag per AP independently
 */

/**
 * Fixed-length queue to keep the latest N values.
 */
class FixedQueue {
  /**
   * @param {number} capacity 最大长度
   */
  constructor(capacity) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error("FixedQueue capacity must be a positive number");
    }
    this.capacity = capacity;
    /** @type {number[]} */
    this.items = [];
  }

  /**
   * Append a value; if capacity is exceeded, drop the oldest value.
   * @param {number} value
   */
  push(value) {
    this.items.push(value);
    if (this.items.length > this.capacity) {
      this.items.shift();
    }
  }

  /**
   * @returns {number} Current number of elements
   */
  size() {
    return this.items.length;
  }

  /**
   * @returns {number|null} Average value; null if empty
   */
  average() {
    if (this.items.length === 0) return null;
    let sum = 0;
    for (const v of this.items) sum += v;
    return sum / this.items.length;
  }
}

/**
 * Per-key rolling average
 */
class RollingAverage {
  /**
   * @param {{ windowSize: number }} opts
   */
  constructor(opts) {
    const { windowSize } = opts;
    if (!Number.isFinite(windowSize) || windowSize <= 0) {
      throw new Error("RollingAverage windowSize must be a positive number");
    }
    this.windowSize = windowSize;
    /** @type {Map<string, FixedQueue>} */
    this.queues = new Map();
  }

  /**
   * Push a value into the window for the given key and return the current rolling average.
   *
   * @param {string} key Grouping key, e.g. `${tagId}|${apId}`
   * @param {number} value Value to insert (e.g. RSSI)
   * @returns {{ avg: number|null, count: number }} avg is the mean; count is the current sample count
   */
  pushAndGetAverage(key, value) {
    if (!this.queues.has(key)) {
      this.queues.set(key, new FixedQueue(this.windowSize));
    }
    const q = this.queues.get(key);
    q.push(value);
    return { avg: q.average(), count: q.size() };
  }
}

module.exports = {
  RollingAverage
};

