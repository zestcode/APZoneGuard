/**
 * RSSI utilities: RSSI -> distance (meters)
 *
 * Background:
 * - RSSI (Received Signal Strength Indicator) is a coarse received signal strength metric, usually in dBm.
 * - Indoors, multipath/obstacles cause large RSSI fluctuations; use smoothing and calibration.
 */

/**
 * Convert RSSI (dBm) to distance (meters) using the log-distance path loss model.
 *
 * Formula:
 *   d = 10^((A - rssi) / (10 * n))
 *
 * Parameters:
 * - A: RSSI at 1 meter (aka txPower / RSSI@1m), e.g. -45
 * - n: path-loss exponent (environment-dependent), e.g. 2.0~3.5
 *
 * Notes:
 * - This model only provides an approximate distance; error can be large.
 * - Returns null if inputs are invalid or n<=0.
 *
 * @param {number} rssi 例如 -45
 * @param {{ txPowerAt1m: number, pathLossN: number }} model
 * @returns {number|null} 距离（米）
 */
function rssiToDistanceMeters(rssi, model) {
  const { txPowerAt1m, pathLossN } = model;

  // Validate inputs: avoid NaN/Infinity propagating downstream
  if (!Number.isFinite(rssi)) return null;
  if (!Number.isFinite(txPowerAt1m)) return null;
  if (!Number.isFinite(pathLossN) || pathLossN <= 0) return null;

  // Exponent term
  const exponent = (txPowerAt1m - rssi) / (10 * pathLossN);
  const d = Math.pow(10, exponent);

  // Guard against extreme values
  if (!Number.isFinite(d) || d <= 0) return null;
  return d;
}

module.exports = {
  rssiToDistanceMeters
};

