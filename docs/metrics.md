# Reserti — Dokumentacja metryk Prometheus

## Architektura

```
NestJS Backend (port 3000)          Raspberry Pi Gateway (port 9100)
  GET /metrics                        GET /metrics
       │                                   │
       └──────────── Prometheus ───────────┘
                          │
                     Grafana Dashboards
```

## Backend — NestJS `/metrics`

### Konfiguracja

Endpoint chroniony IP whitelist. Ustaw w `.env`:
```
METRICS_ALLOWED_IPS=127.0.0.1,<ip-prometheus-serwera>
```

Endpoint poza prefixem `/api/v1` — dostępny jako `https://api.domena.pl/metrics`.

### Grupy metryk

#### HTTP
| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `reserti_http_requests_total` | Counter | `method`, `route`, `status_code` |
| `reserti_http_errors_total` | Counter | `route`, `status_code` |

#### Baza danych (Prisma)
| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_db_query_duration_seconds` | Histogram | `model`, `operation` |
| `reserti_db_errors_total` | Counter | `model`, `operation` |

#### MQTT
| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_mqtt_messages_received_total` | Counter | `topic_type` |
| `reserti_mqtt_messages_published_total` | Counter | `topic_type` |
| `reserti_mqtt_errors_total` | Counter | `direction` |

#### Owner — agregaty globalne (cron 30s)
| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_organizations_total` | Gauge | `status` (active/inactive) |
| `reserti_gateways_total` | Gauge | `status` (online/offline) |
| `reserti_beacons_total` | Gauge | `status` (online/offline) |
| `reserti_beacons_firmware_outdated_total` | Gauge | `org_id` |
| `reserti_provisioning_errors_24h_total` | Gauge | `org_id` |

#### Client — per org/location (cron 60s)
| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_desks_total` | Gauge | `org_id`, `location_id`, `status` |
| `reserti_desks_occupied_now` | Gauge | `org_id`, `location_id` |
| `reserti_reservations_today_total` | Gauge | `org_id`, `location_id`, `status` |
| `reserti_checkins_total` | Counter | `org_id`, `location_id`, `method` |
| `reserti_checkouts_total` | Counter | `org_id`, `location_id` |
| `reserti_unauthorized_scans_total` | Counter | `org_id`, `gateway_id` |
| `reserti_beacon_rssi_dbm` | Gauge | `org_id`, `location_id`, `device_id` |
| `reserti_beacon_last_seen_seconds` | Gauge | `org_id`, `location_id`, `device_id` |
| `reserti_gateway_last_seen_seconds` | Gauge | `org_id`, `gateway_id` |
| `reserti_gateway_version_info` | Gauge | `org_id`, `gateway_id`, `version` |

#### Node.js process (automatyczne)
`process_cpu_seconds_total`, `process_heap_bytes`, `nodejs_eventloop_lag_seconds` i inne z `collectDefaultMetrics()`.

---

## Gateway Python `/metrics` (port 9100)

### Konfiguracja

Uruchamiany automatycznie przy starcie gateway. Port konfigurowalny:
```
GATEWAY_METRICS_PORT=9100  # default
```

Brak autentykacji — zakładamy sieć wewnętrzną lub VPN.

### Metryki

#### MQTT
| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_mqtt_messages_total` | Counter | `type` (nfc_checkin/qr_scan/status/led_command) |
| `gateway_mqtt_connect_total` | Counter | `result` (success/failure) |
| `gateway_mqtt_disconnect_total` | Counter | — |

#### Sync z backendem
| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_sync_total` | Counter | `result` (success/failure) |
| `gateway_sync_duration_seconds` | Histogram | — |
| `gateway_sync_reservations_count` | Gauge | — |
| `gateway_offline_queue_size` | Gauge | — |
| `gateway_forward_errors_total` | Counter | `type` (nfc/qr) |

#### Beacony
| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_beacon_last_seen_seconds` | Gauge | `hardware_id`, `desk_id` |
| `gateway_beacon_rssi_dbm` | Gauge | `hardware_id`, `desk_id` |
| `gateway_beacon_online` | Gauge (0/1) | `hardware_id`, `desk_id` |
| `gateway_beacons_total` | Gauge | `status` (online/offline) |

#### HTTP API
| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_api_requests_total` | Counter | `path`, `result` (ok/error) |
| `gateway_api_duration_seconds` | Histogram | `path` |

#### Info
| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_info` | Gauge (1) | `gateway_id`, `version` |

---

## Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'reserti-backend'
    static_configs:
      - targets: ['api.domena.pl:443']
    scheme: https
    metrics_path: /metrics

  - job_name: 'reserti-gateway'
    static_configs:
      - targets:
          - '<pi-office-1-ip>:9100'
          - '<pi-office-2-ip>:9100'
    # Dodaj label per gateway dla filtrowania w Grafanie
    relabel_configs:
      - source_labels: [__address__]
        target_label: gateway_ip
```

---

## Dashboardy Grafana (do wdrożenia)

| Dashboard | Grupa | Kluczowe panele |
|-----------|-------|-----------------|
| **System Health** | Owner | API p99 latency, error rate, DB query time, MQTT throughput |
| **Fleet Overview** | Owner | Gateway online/offline, beacon status per org, FW outdated |
| **Desk Analytics** | Client | Occupancy % w ciągu dnia, check-in metody, rezerwacje today |
| **IoT Health** | Client | RSSI trend, beacon uptime, sync lag, offline queue size |

---

## Separacja dostępu Owner / Client w Grafanie

Metryki zawierają label `org_id`. W Grafanie:
- **Owner dashboardy** — brak filtra `org_id`, widzą wszystko
- **Client dashboardy** — zmienna `$org_id` ustawiona na organizację klienta, wszystkie panele filtrują po tym labelu

Przy wdrażaniu Grafany: utwórz dwie organizacje Grafana (`Reserti Internal` i per klient) lub użyj jednej z folderami i row-level security.
