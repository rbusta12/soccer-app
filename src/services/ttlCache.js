/**
 * A minimal in-memory TTL (time-to-live) cache.
 *
 * Backed by a Map for O(1) get/set/delete. Each entry stores the value
 * alongside its expiry timestamp; expired entries are lazily evicted on
 * read rather than swept on a timer, which keeps this simple and avoids
 * holding a setInterval handle open (important for clean shutdown in tests
 * and in containers).
 */
class TtlCache {
  /**
   * @param {number} ttlMs - how long an entry stays valid, in milliseconds
   */
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  /**
   * @param {string} key
   * @returns {*} the cached value, or undefined if missing/expired
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * @returns {number} count of entries currently stored (including any not
   * yet lazily evicted)
   */
  size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }
}

module.exports = TtlCache;
