/**
 * Project entry point (backend bootstrap)
 *
 * Responsibilities:
 * - Start HTTP + Socket.io (push real-time updates to the frontend)
 * - Start the TCP server (ingest packets from devices)
 * - Pipeline for valid RSSI packets: rolling average -> RSSI->distance -> trilateration -> emit "position"
 *
 * Note:
 * - The earlier error `Cannot find module .../src/index.js` happened because this file went missing.
 *   This file restores the main entry so `npm run start` works again.
 */

const {
  TCP_PORT,
  HTTP_PORT,
  ALLOWED_DEVICE_IDS,
  TCP_ECHO_MODE,
  APS,
  TX_POWER_AT_1M,
  PATH_LOSS_N,
  FILTER_WINDOW_SIZE,
  MIN_AP_COUNT
} = require("./config");

const { startTcpServer } = require("./tcpServer");
const { startWebServer } = require("./webServer");
const { info } = require("./logger");
const { RollingAverage } = require("./filter");
const { rssiToDistanceMeters } = require("./rssi");
const { trilaterate3 } = require("./trilateration");

function main() {
  // 1) Start Web (HTTP + Socket.io)
  const { io } = startWebServer({ port: HTTP_PORT });

  // 2) Maintain an RSSI rolling window per (tag_id, ap_id) (reduce jitter)
  const rssiAverager = new RollingAverage({ windowSize: FILTER_WINDOW_SIZE });

  // 3) Start TCP (device ingress)
  startTcpServer({
    port: TCP_PORT,
    allowedDeviceIds: ALLOWED_DEVICE_IDS,
    echoMode: TCP_ECHO_MODE,
    echoBackRawLine: true,
    onPacket: (packet, meta) => {
      // Broadcast the structured packet first (useful for debugging / frontend display)
      io.emit("raw_packet", { ts: Date.now(), meta, packet });

      // ---- Positioning pipeline: smoothing -> distance -> trilateration ----
      /** @type {Record<string, number>} */
      const avgRssiByAp = {};
      for (const m of packet.measurements) {
        const key = `${packet.tag_id}|${m.ap_id}`;
        const { avg } = rssiAverager.pushAndGetAverage(key, m.rssi);
        if (avg == null) continue;
        avgRssiByAp[m.ap_id] = avg;
      }

      /** @type {Array<{ ap_id: string, x: number, y: number, d: number }>} */
      const usable = [];
      for (const [ap_id, avgRssi] of Object.entries(avgRssiByAp)) {
        const ap = APS[ap_id];
        if (!ap) continue; // AP not configured => cannot participate

        const d = rssiToDistanceMeters(avgRssi, {
          txPowerAt1m: TX_POWER_AT_1M,
          pathLossN: PATH_LOSS_N
        });
        if (d == null) continue;
        usable.push({ ap_id, x: ap.x, y: ap.y, d });
      }

      if (usable.length < MIN_AP_COUNT) return;

      // Simplification: take the first 3 APs (can be extended to multi-AP least squares)
      const p1 = usable[0];
      const p2 = usable[1];
      const p3 = usable[2];

      const pos = trilaterate3(p1, p2, p3);
      if (!pos) return;

      // Emit to frontend: "position" (units: meters)
      io.emit("position", {
        tag_id: packet.tag_id,
        timestamp: Date.now(),
        x: pos.x,
        y: pos.y,
        raw: {
          distances: {
            [p1.ap_id]: p1.d,
            [p2.ap_id]: p2.d,
            [p3.ap_id]: p3.d
          }
        }
      });

      // Print one key line (avoid flooding logs)
      info("Position:", { tag_id: packet.tag_id, x: pos.x, y: pos.y });
    }
  });
}

main();

