/**
 * 2D trilateration
 *
 * Given 3 known anchor (AP) coordinates (xi, yi) and distances di to the target,
 * solve for the target position (x, y).
 *
 * One common approach: subtract circle equations pairwise to eliminate quadratic terms,
 * resulting in a linear 2x2 system:
 *
 * (x - x1)^2 + (y - y1)^2 = d1^2
 * (x - x2)^2 + (y - y2)^2 = d2^2
 * (x - x3)^2 + (y - y3)^2 = d3^2
 *
 * Subtract equation #1 from #2 and #3:
 * 2(x2-x1)x + 2(y2-y1)y = d1^2 - d2^2 + x2^2 - x1^2 + y2^2 - y1^2
 * 2(x3-x1)x + 2(y3-y1)y = d1^2 - d3^2 + x3^2 - x1^2 + y3^2 - y1^2
 *
 * This is a 2x2 linear system and can be solved directly.
 *
 * Notes:
 * - If points are collinear or nearly collinear, the matrix becomes singular (det ~ 0) and the solution is unstable.
 * - With large distance noise, the estimate can drift; use smoothing/constraints as needed.
 */

/**
 * Solve a 2x2 linear system:
 *   a11*x + a12*y = b1
 *   a21*x + a22*y = b2
 *
 * @param {number} a11
 * @param {number} a12
 * @param {number} a21
 * @param {number} a22
 * @param {number} b1
 * @param {number} b2
 * @returns {{x:number,y:number}|null}
 */
function solve2x2(a11, a12, a21, a22, b1, b2) {
  // Determinant det = a11*a22 - a12*a21
  const det = a11 * a22 - a12 * a21;

  // The closer det is to 0, the more singular the system is (threshold can be tuned).
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;

  const x = (b1 * a22 - b2 * a12) / det;
  const y = (a11 * b2 - a21 * b1) / det;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Compute target position given 3 APs' coordinates and distances.
 *
 * @param {{x:number,y:number,d:number}} p1
 * @param {{x:number,y:number,d:number}} p2
 * @param {{x:number,y:number,d:number}} p3
 * @returns {{x:number,y:number}|null}
 */
function trilaterate3(p1, p2, p3) {
  // Validate inputs: finite coordinates and d > 0
  for (const p of [p1, p2, p3]) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    if (!Number.isFinite(p.d) || p.d <= 0) return null;
  }

  const { x: x1, y: y1, d: d1 } = p1;
  const { x: x2, y: y2, d: d2 } = p2;
  const { x: x3, y: y3, d: d3 } = p3;

  // Build the linear system A*[x,y]^T = b
  const a11 = 2 * (x2 - x1);
  const a12 = 2 * (y2 - y1);
  const a21 = 2 * (x3 - x1);
  const a22 = 2 * (y3 - y1);

  const b1 = d1 * d1 - d2 * d2 + x2 * x2 - x1 * x1 + y2 * y2 - y1 * y1;
  const b2 = d1 * d1 - d3 * d3 + x3 * x3 - x1 * x1 + y3 * y3 - y1 * y1;

  return solve2x2(a11, a12, a21, a22, b1, b2);
}

module.exports = {
  trilaterate3,
  solve2x2
};

