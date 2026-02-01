## Bio-WMS Real-Time Indoor Positioning Backend (TCP -> compute -> Socket.io push)

This project is designed for a LAN setup:

- **Device -> Server**: ingest RSSI JSON from devices (tag/gateway) over **TCP (Socket)** (low latency).
- **Server -> Frontend**: push real-time positions to the dashboard over **WebSocket (Socket.io)** (no refresh).

---

## 1. How to run (you execute the commands)

Run as needed:

```bash
npm i
npm run start
```

Dev mode (Node 18+ supports `--watch`):

```bash
npm run dev
```

---

## 2. Ports and protocols

### 2.1 TCP ingress (device -> backend)

- **Default port**: `TCP_PORT=3000`
- **Protocol**: **newline-delimited JSON (NDJSON)**
  - Every message **must end with `\n`** so the backend can frame messages correctly
  - Reason: TCP is a byte stream and has no built-in message boundaries

#### Ingress JSON format (example)

```json
{
  "tag_id": "locker_01",
  "device_id": "nrf7002_001",
  "measurements": [
    {"ap_id": "AP_A", "rssi": -45},
    {"ap_id": "AP_B", "rssi": -62},
    {"ap_id": "AP_C", "rssi": -58}
  ]
}
```

Field definitions:

- `tag_id`: mobile tag identifier (a tag reports continuously)
- `device_id`: optional, used for simple auth/whitelist (recommended to keep stable)
- `measurements`: array containing RSSI from 3 APs
  - `ap_id`: AP identifier, must exist in backend AP coordinate config
  - `rssi`: integer (dBm, typically negative)

---

### 2.2 WebSocket egress (backend -> frontend)

- **Default port**: `HTTP_PORT=8080`
- Socket.io URL (frontend example): `http://<server-ip>:8080`

The backend broadcasts:

- **Event**: `position`
- **payload**：

```json
{
  "tag_id": "locker_01",
  "timestamp": 1730000000000,
  "x": 2.13,
  "y": 1.07,
  "raw": {
    "distances": {
      "AP_A": 1.2,
      "AP_B": 3.9,
      "AP_C": 2.7
    }
  }
}
```

---

## 3. Core algorithms (brief)

1. **RSSI -> distance**: log-distance path loss model

\[
d = 10^{\frac{(A - RSSI)}{10n}}
\]

- `A`: RSSI at 1 meter (aka `txPower`), e.g. `-45`
- `n`: path-loss exponent (often 2.0~3.5 in warehouses/indoors; calibrate on-site)

2. **Trilateration**: solve 2D position from 3 AP coordinates + distances
   - This implementation uses a common linearized method (subtract equations to remove quadratic terms)
   - Degenerate cases (collinearity / singular matrix) are rejected

3. **Rolling average smoothing**:
   - Maintain a fixed window (default: 8) of recent RSSI for each `(tag_id, ap_id)`
   - Convert the averaged RSSI to distance to reduce jumping

---

## 4. Configuration

All configuration lives in:

- `src/config.js`

You should at least set:

- 3 AP coordinates: `APS`
- RSSI model params: `TX_POWER_AT_1M`, `PATH_LOSS_N`
- Window size: `FILTER_WINDOW_SIZE`

---

## 5. Local simulation (optional)

There is a TCP simulator client that keeps sending NDJSON to the TCP port:

```bash
npm run simulate:tcp
```

Edit AP RSSI and tag_id in `scripts/simulate-tcp-client.js`.



