#!/usr/bin/env bash
set -euo pipefail

# Push basic Mac + OpenClaw status into Supabase.agent_status
# Requires: ~/.openclaw/secrets/supabase.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_FILE="$HOME/.openclaw/secrets/supabase.env"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "[push-status] Supabase secrets file not found: $SECRETS_FILE" >&2
  exit 1
fi

# Load Supabase env (without echoing)
set -a
# shellcheck source=/dev/null
. "$SECRETS_FILE"
set +a

: "${SUPABASE_URL:?SUPABASE_URL must be set in supabase.env}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set in supabase.env}"

HOSTNAME=$(hostname)
TS=$(date -Iseconds)

# Mac health metrics (best-effort, simple approximations)
# CPU: use 1-minute load average as a rough proxy
CPU_LOAD_1M=$(uptime | awk -F'load averages?: ' '{print $2}' | awk '{print $1}' | tr -d ',')

# Disk: percentage used on root, convert to free pct
DISK_USED_PCT=$(df -H / | awk 'NR==2 {gsub("%","",$5); print $5}')
DISK_FREE_PCT=$((100 - DISK_USED_PCT))

# RAM: use vm_stat to estimate used fraction
# This is approximate but good enough for a dashboard gauge.
PAGE_SIZE=$(vm_stat | awk '/page size of/ {gsub(".","",$8); print $8}')
if [ -z "$PAGE_SIZE" ]; then
  PAGE_SIZE=4096
fi
FREE_PAGES=$(vm_stat | awk '/free/ {gsub(".","",$3); print $3}')
ACTIVE_PAGES=$(vm_stat | awk '/active/ {gsub(".","",$3); print $3}')
INACTIVE_PAGES=$(vm_stat | awk '/inactive/ {gsub(".","",$3); print $3}')
SPECULATIVE_PAGES=$(vm_stat | awk '/speculative/ {gsub(".","",$3); print $3}')
WIRED_PAGES=$(vm_stat | awk '/wired down/ {gsub(".","",$4); print $4}')
COMPRESSED_PAGES=$(vm_stat | awk '/compressor/ {gsub(".","",$3); print $3}')

TOTAL_PAGES=$((FREE_PAGES + ACTIVE_PAGES + INACTIVE_PAGES + SPECULATIVE_PAGES + WIRED_PAGES + COMPRESSED_PAGES))
USED_PAGES=$((ACTIVE_PAGES + INACTIVE_PAGES + SPECULATIVE_PAGES + WIRED_PAGES + COMPRESSED_PAGES))

if [ "$TOTAL_PAGES" -gt 0 ]; then
  MAC_RAM_PCT=$((100 * USED_PAGES / TOTAL_PAGES))
else
  MAC_RAM_PCT=0
fi

# Gateway status via openclaw status (best-effort; if it fails, we mark unknown)
GATEWAY_RUNNING=null
if command -v openclaw >/dev/null 2>&1; then
  if openclaw status 2>/dev/null | grep -qi "gateway.*running"; then
    GATEWAY_RUNNING=true
  else
    GATEWAY_RUNNING=false
  fi
fi

CURRENT_TASK="dashboard: push-status.sh"
LAST_MESSAGE="push-status from $HOSTNAME at $TS (cpu_load_1m=$CPU_LOAD_1M, ram_pct=$MAC_RAM_PCT, disk_free_pct=$DISK_FREE_PCT)"

JSON_PAYLOAD=$(cat <<EOF
{
  "current_task": "$CURRENT_TASK",
  "mac_ram_pct": $MAC_RAM_PCT,
  "mac_cpu_pct": "$CPU_LOAD_1M",
  "mac_disk_pct": $DISK_FREE_PCT,
  "gateway_running": $GATEWAY_RUNNING,
  "last_message": "$LAST_MESSAGE"
}
EOF
)

RESPONSE=$(curl -s -o /tmp/push-status-resp.json -w "%{http_code}" \
  "$SUPABASE_URL/rest/v1/agent_status" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$JSON_PAYLOAD")

if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 300 ]; then
  echo "[push-status] OK ($RESPONSE)" >&2
else
  echo "[push-status] FAILED ($RESPONSE)" >&2
  cat /tmp/push-status-resp.json >&2 || true
  exit 1
fi
