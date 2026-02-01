# APZoneGuard
# Wi-Fi Station Scanner (nRF70 / Zephyr)

This project is a Zephyr/Nordic NCS Wi-Fi station application. It connects to a
configured access point, scans for a small set of known SSIDs, formats scan
results into JSON, and sends the payload to a TCP server.

## Features
- Wi-Fi STA connection using stored credentials
- DHCP IPv4
- Periodic scan for known SSIDs (`AP_0`, `AP_1`, `AP_3`)
- JSON payload containing AP RSSI values
- TCP push to server (`192.168.43.66:3000`)
- LED blink when connected
- Optional Wi-Fi ready library
- Optional QSPI encryption on supported boards

## Payload format
```json
{
  "tag_id": "tag_01",
  "device_id": "nrf7002_001",
  "measurements": [
    { "ap_id": "AP_0", "rssi": -42 },
    { "ap_id": "AP_1", "rssi": -57 }
  ]
}
```

## Requirements
- Nordic NCS/Zephyr toolchain (west, Zephyr SDK)
- nRF7002 DK (nRF5340 CPUAPP) or compatible board
- Wi-Fi network credentials

## Configuration
Edit `prj.conf` for Wi-Fi credentials:
```
CONFIG_WIFI_CREDENTIALS_STATIC_SSID="AP_0"
CONFIG_WIFI_CREDENTIALS_STATIC_PASSWORD="Mypassword"
```

TCP target (hardcoded in `src/main.c`):
```
#define TCP_SERVER_IP    "192.168.43.66"
#define TCP_SERVER_PORT  3000
```

Static IP fallback (overridden by DHCP):
```
CONFIG_NET_CONFIG_MY_IPV4_ADDR="192.168.1.99"
CONFIG_NET_CONFIG_MY_IPV4_NETMASK="255.255.255.0"
CONFIG_NET_CONFIG_MY_IPV4_GW="192.168.1.1"
```

## Build & Flash (example)
```
west build -b nrf7002dk/nrf5340/cpuapp
west flash
```

## Runtime behavior
- Connects to the configured AP
- When connected, scans every 5 seconds
- Builds JSON from seen APs and sends it via TCP
- LED blinks while connected

## Notes
- Scan results are only sent when connected.
- Only SSIDs listed in the local table are included in payloads.

## License
See Nordic NCS licensing and sample notices in this repository.
