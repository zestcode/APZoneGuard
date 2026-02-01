/**
 * TCP(Socket) 数据接入层
 *
 * 功能：
 * - 监听固定端口（默认 3000），接收局域网内设备上报的 RSSI JSON
 * - 使用“换行分隔 JSON（NDJSON）”做消息分帧
 * - 做最基础的格式校验与（可选）device_id 白名单鉴权
 * - 将解析后的数据包交给上层回调处理（例如：滤波、定位、推送）
 *
 * 重要说明：TCP 是字节流协议，没有消息边界。
 * - 如果设备端一次发送一个 JSON，不代表服务端一次就能完整读到一个 JSON
 * - 也可能一次读到多个 JSON（粘包）
 * 因此这里采用：以 '\n' 作为包结束符，按行切分。
 */

const net = require("net");
const { info, warn, error } = require("./logger");

/**
 * Dump a TCP raw chunk for debugging.
 * NOTE: TCP is a stream; "data" events are arbitrary segments, not message frames.
 *
 * @param {Buffer|string} chunk
 * @returns {{ len: number, hex: string, utf8: string }}
 */
function dumpTcpChunk(chunk) {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
  return {
    len: buf.length,
    // Full raw bytes (hex). This can be large but is the closest to "原始报文全部输出".
    hex: buf.toString("hex"),
    // Best-effort UTF-8 view (may include replacement chars if payload isn't UTF-8).
    utf8: buf.toString("utf8")
  };
}

/**
 * @typedef {Object} Measurement
 * @property {string} ap_id
 * @property {number} rssi
 */

/**
 * @typedef {Object} DevicePacket
 * @property {string} tag_id
 * @property {string=} device_id
 * @property {Measurement[]} measurements
 */

/**
 * 校验并规范化 device 上报数据。
 *
 * 设计目标：
 * - 尽量“严进”：字段不对就丢弃，避免坏数据污染滤波窗口和定位结果。
 *
 * @param {any} obj
 * @returns {DevicePacket|null}
 */
function normalizeDevicePacket(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.tag_id !== "string" || obj.tag_id.trim() === "") return null;

  const tag_id = obj.tag_id.trim();
  const device_id =
    typeof obj.device_id === "string" && obj.device_id.trim() !== ""
      ? obj.device_id.trim()
      : undefined;

  if (!Array.isArray(obj.measurements)) return null;

  /** @type {Measurement[]} */
  const measurements = [];
  for (const m of obj.measurements) {
    if (!m || typeof m !== "object") continue;
    if (typeof m.ap_id !== "string" || m.ap_id.trim() === "") continue;
    const ap_id = m.ap_id.trim();
    const rssi = Number(m.rssi);
    if (!Number.isFinite(rssi)) continue;
    measurements.push({ ap_id, rssi });
  }

  if (measurements.length === 0) return null;
  return { tag_id, device_id, measurements };
}

/**
 * 判断 device_id 是否允许。
 *
 * @param {string|undefined} deviceId
 * @param {string[]} allowedList
 * @returns {boolean}
 */
function isDeviceAllowed(deviceId, allowedList) {
  // 未配置白名单 => 不做鉴权
  if (!allowedList || allowedList.length === 0) return true;
  // 配置了白名单 => 必须提供 device_id 且在列表中
  if (!deviceId) return false;
  return allowedList.includes(deviceId);
}

/**
 * 创建并启动 TCP 服务器。
 *
 * @param {{
 *   port: number,
 *   allowedDeviceIds: string[],
 *   onPacket: (packet: DevicePacket, meta: { remoteAddress?: string, remotePort?: number }) => void
 * }} opts
 * @returns {net.Server}
 */
function startTcpServer(opts) {
  const { port, allowedDeviceIds, onPacket } = opts;

  const server = net.createServer((socket) => {
    // remoteAddress 可能形如 ::ffff:192.168.1.10
    const remoteAddress = socket.remoteAddress;
    const remotePort = socket.remotePort;

    info("TCP client connected:", { remoteAddress, remotePort });

    // 连接级别缓冲区：保存“尚未遇到换行符”的残余片段
    let buffer = "";

    socket.on("data", (chunk) => {
      // 1) Always print the raw TCP chunk as received (bytes)
      info("TCP raw chunk received:", {
        remoteAddress,
        remotePort,
        ...dumpTcpChunk(chunk)
      });

      // 2) Parsing layer: treat payload as UTF-8 NDJSON text
      buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);

      // 按 '\n' 切分；最后一段可能是不完整的 JSON，先留在 buffer 里
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const lineRaw of parts) {
        const line = lineRaw.trim();
        if (!line) continue;

        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch (e) {
          warn("Invalid JSON line, dropped:", { remoteAddress, remotePort, line });
          continue;
        }

        const packet = normalizeDevicePacket(parsed);
        if (!packet) {
          warn("Invalid packet schema, dropped:", { remoteAddress, remotePort, parsed });
          continue;
        }

        if (!isDeviceAllowed(packet.device_id, allowedDeviceIds)) {
          warn("Device not allowed, dropped:", {
            remoteAddress,
            remotePort,
            device_id: packet.device_id
          });
          continue;
        }

        // 将干净数据交给上层（定位/推送）
        onPacket(packet, { remoteAddress, remotePort });
      }
    });

    socket.on("close", () => {
      info("TCP client disconnected:", { remoteAddress, remotePort });
    });

    socket.on("error", (err) => {
      error("TCP socket error:", { remoteAddress, remotePort, err: err.message });
    });
  });

  server.on("error", (err) => {
    error("TCP server error:", err.message);
  });

  server.listen(port, () => {
    info(`TCP server listening on port ${port}`);
  });

  return server;
}

module.exports = {
  startTcpServer
};

