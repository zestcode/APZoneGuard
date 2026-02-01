/**
 * Ultra-light logger
 *
 * Goals:
 * - Add consistent prefix/timestamps to simplify debugging for TCP/positioning/push pipeline
 * - Keep it dependency-free (avoid install/build complexity)
 */

/**
 * Get an ISO timestamp (ms precision).
 * @returns {string}
 */
function ts() {
  return new Date().toISOString();
}

/**
 * Print an info log line.
 * @param {...any} args
 */
function info(...args) {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [INFO]`, ...args);
}

/**
 * Print a warn log line.
 * @param {...any} args
 */
function warn(...args) {
  // eslint-disable-next-line no-console
  console.warn(`[${ts()}] [WARN]`, ...args);
}

/**
 * Print an error log line.
 * @param {...any} args
 */
function error(...args) {
  // eslint-disable-next-line no-console
  console.error(`[${ts()}] [ERROR]`, ...args);
}

module.exports = { info, warn, error };

