/**
 * HTTP + Socket.io server
 *
 * Goals:
 * - Provide a stable real-time data channel for the frontend (WebSocket via Socket.io)
 * - Provide a minimal HTTP health check endpoint (/health)
 *
 * Notes:
 * - Socket.io is a higher-level wrapper over WebSocket with great browser compatibility.
 * - This implementation broadcasts all tags by default; you can later evolve it to rooms/subscriptions.
 */

const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const { info, warn } = require("./logger");

/**
 * Start the HTTP + Socket.io server.
 *
 * @param {{ port: number }} opts
 * @returns {{ httpServer: import("http").Server, io: import("socket.io").Server }}
 */
function startWebServer(opts) {
  const { port } = opts;

  const app = express();

  // Static files:
  // - Serve html/js/css from public/
  // - Example: public/warehouse_sim_live_logs.html
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // Convenience:
  // - If React SPA build exists (public/index.html), serve it at /
  // - Otherwise, redirect root to the demo page
  app.get("/", (req, res) => {
    const indexHtml = path.join(publicDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    return res.redirect("/warehouse_sim_live_logs.html");
  });

  // SPA fallback (only when index.html exists):
  // If the frontend uses client-side routing, refresh on /xxx should still load index.html.
  app.get("*", (req, res, next) => {
    // Only handle GET requests that accept html
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();

    const indexHtml = path.join(publicDir, "index.html");
    if (!fs.existsSync(indexHtml)) return next();

    return res.sendFile(indexHtml);
  });

  // Minimal health check
  app.get("/health", (req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    // CORS: open by default for LAN debugging; restrict origin in production.
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    info("Socket.io client connected:", { id: socket.id });

    // Optional: let clients subscribe to a specific tag_id (future extension)
    // socket.on("subscribe", ({ tag_id }) => { ... join room ... })
    socket.on("disconnect", (reason) => {
      warn("Socket.io client disconnected:", { id: socket.id, reason });
    });
  });

  httpServer.listen(port, () => {
    info(`HTTP/Socket.io server listening on port ${port}`);
  });

  return { httpServer, io };
}

module.exports = {
  startWebServer
};

