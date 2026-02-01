/**
 * Central configuration
 *
 * Notes:
 * - Centralizes ports, AP coordinates, RSSI->distance model parameters, filter window size, etc.
 * - All parameters have defaults; for real deployments, you should calibrate (especially the RSSI model).
 */

/**
 * Read an integer from env. If missing/invalid, return the default.
 * @param {string} key 环境变量名
 * @param {number} defaultValue 默认值
 * @returns {number}
 */
function envInt(key, defaultValue) {
  const raw = process.env[key];
  if (raw == null || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Read a float from env. If missing/invalid, return the default.
 * @param {string} key 环境变量名
 * @param {number} defaultValue 默认值
 * @returns {number}
 */
function envFloat(key, defaultValue) {
  const raw = process.env[key];
  if (raw == null || raw === "") return defaultValue;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * AP coordinates (unit: meters)
 * Notes:
 * - These are the "known variables" for trilateration and must be correct.
 * - Coordinate system is up to you (commonly: warehouse bottom-left is (0,0), x to the right, y up).
 * - The 3 APs should form a triangle with a reasonable area (avoid collinearity), otherwise positioning becomes unstable.
 */
const APS = {
  AP_A: { x: 0, y: 0 },
  AP_B: { x: 6, y: 0 },
  AP_C: { x: 0, y: 4 }
};

/**
 * RSSI->distance model parameters (Log-distance path loss model)
 *
 * Distance estimation formula:
 *   d = 10^((A - RSSI) / (10 * n))
 *
 * - A: RSSI at 1 meter (also known as txPower / RSSI@1m), needs on-site calibration
 * - n: path-loss exponent, often ~2.0 to 3.5 indoors/warehouse (also needs calibration)
 */
const TX_POWER_AT_1M = envFloat("TX_POWER_AT_1M", -45); // A
const PATH_LOSS_N = envFloat("PATH_LOSS_N", 2.4); // n

/**
 * Filter window size
 *
 * - Rolling average over the latest N RSSI samples (grouped by tag_id + ap_id).
 * - Larger N => smoother but more latency; smaller N => more responsive but more jitter.
 */
const FILTER_WINDOW_SIZE = envInt("FILTER_WINDOW_SIZE", 8);

/**
 * TCP listening port (device ingress)
 */
const TCP_PORT = envInt("TCP_PORT", 3000);

/**
 * HTTP + Socket.io listening port (frontend entry)
 */
const HTTP_PORT = envInt("HTTP_PORT", 8080);

/**
 * TCP debug echo mode
 *
 * - true: immediately ACK on any received content and optionally echo raw lines (useful to validate the link)
 * - false: strictly validate NDJSON + schema; only valid packets enter the positioning pipeline
 *
 * Notes:
 * - This is not part of the positioning algorithm; it's purely a bring-up/debug tool.
 * - Enabled by default for quick testing; disable once device reporting is stable.
 */
const TCP_ECHO_MODE = (process.env.TCP_ECHO_MODE || "true").toLowerCase() === "true";

/**
 * Simple auth: allowed device_id whitelist (comma-separated)
 *
 * - If empty: auth disabled (accept any device / any device_id)
 * - If set: incoming JSON must include device_id and it must be in the whitelist, otherwise the packet is dropped
 *
 * Example:
 *   ALLOWED_DEVICE_IDS=nrf7002_001,nrf7002_002
 */
const ALLOWED_DEVICE_IDS = (process.env.ALLOWED_DEVICE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Minimum number of AP distances required for a position fix
 *
 * - Trilateration requires at least 3 APs
 * - If you later extend to multi-AP least squares, this can be relaxed
 */
const MIN_AP_COUNT = 3;

module.exports = {
  APS,
  TX_POWER_AT_1M,
  PATH_LOSS_N,
  FILTER_WINDOW_SIZE,
  TCP_PORT,
  HTTP_PORT,
  TCP_ECHO_MODE,
  ALLOWED_DEVICE_IDS,
  MIN_AP_COUNT
};

