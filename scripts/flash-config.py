#!/usr/bin/env python3
"""
flash-config.py — Write desk beacon config to ESP32 NVS via serial.

The ESP32 must be running firmware with serial provisioning mode active
(i.e. not yet provisioned — state = PROVISIONING).

Usage:
  python3 scripts/flash-config.py \
    --port /dev/ttyUSB0 \
    --device-id d-abc123 \
    --desk-id   clxxxxxxxxxxxxxxxx \
    --wifi-ssid MyOfficeWifi \
    --wifi-pass WifiPassword \
    --mqtt-host 192.168.1.100 \
    --mqtt-port 1883 \
    --mqtt-user beacon-d-abc123 \
    --mqtt-pass generatedPassword
"""

import argparse
import json
import time
import sys

try:
    import serial
except ImportError:
    print("Install pyserial: pip install pyserial")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Flash Desk Beacon config via serial')
    parser.add_argument('--port',       required=True,  help='Serial port (e.g. /dev/ttyUSB0 or COM3)')
    parser.add_argument('--baud',       default=115200,  type=int)
    parser.add_argument('--device-id',  required=True)
    parser.add_argument('--desk-id',    required=True)
    parser.add_argument('--gateway-id', default='')
    parser.add_argument('--wifi-ssid',  required=True)
    parser.add_argument('--wifi-pass',  required=True)
    parser.add_argument('--mqtt-host',  required=True)
    parser.add_argument('--mqtt-port',  default=1883, type=int)
    parser.add_argument('--mqtt-user',  required=True)
    parser.add_argument('--mqtt-pass',  required=True)
    args = parser.parse_args()

    config = {
        'device_id':  args.device_id,
        'desk_id':    args.desk_id,
        'gateway_id': args.gateway_id,
        'wifi_ssid':  args.wifi_ssid,
        'wifi_pass':  args.wifi_pass,
        'mqtt_host':  args.mqtt_host,
        'mqtt_port':  args.mqtt_port,
        'mqtt_user':  args.mqtt_user,
        'mqtt_pass':  args.mqtt_pass,
    }

    payload = 'PROVISION:' + json.dumps(config) + '\n'

    print(f'Connecting to {args.port} @ {args.baud} baud...')
    with serial.Serial(args.port, args.baud, timeout=10) as ser:
        time.sleep(2)  # wait for ESP32 boot
        ser.write(payload.encode('utf-8'))
        print('Config sent. Waiting for acknowledgement...')

        deadline = time.time() + 10
        while time.time() < deadline:
            line = ser.readline().decode('utf-8', errors='replace').strip()
            if line:
                print(f'  ESP32: {line}')
            if 'PROVISION_OK' in line:
                print('\n✅ Beacon provisioned successfully! It will reboot now.')
                return
            if 'PROVISION_ERR' in line:
                print('\n❌ Provisioning failed. Check the serial output above.')
                sys.exit(1)

    print('\n⚠ Timeout — no acknowledgement received.')
    sys.exit(1)


if __name__ == '__main__':
    main()
