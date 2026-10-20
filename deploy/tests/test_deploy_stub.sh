#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
if [ ! -f "$DEPLOY_SCRIPT" ] && [ -f "/deploy/deploy.sh" ]; then
  DEPLOY_SCRIPT="/deploy/deploy.sh"
fi

if [ ! -f "$DEPLOY_SCRIPT" ]; then
  echo "ERROR: deploy.sh not found at $DEPLOY_SCRIPT"
  exit 1
fi

mkdir -p /tmp/bin
cat << 'EOF' > /tmp/bin/gcloud
#!/usr/bin/env bash
# Build redacted argument array and record with printf '%q '
REDACTED_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > /tmp/last_sql_pass
      REDACTED_ARGS+=("--password=<REDACTED>")
      ;;
    *)
      REDACTED_ARGS+=("$arg")
      ;;
  esac
done

{
  printf '%q ' gcloud "${REDACTED_ARGS[@]}"
  printf '\n'
} >> "$GCLOUD_LOG"

if [ "${1:-}" = "config" ] && [ "${2:-}" = "get-value" ]; then
  echo "stub-gcp-project"
  exit 0
fi

if [ "${1:-}" = "run" ] && [ "${2:-}" = "services" ] && [ "${3:-}" = "describe" ]; then
  echo "https://toktickit-stub-as.a.run.app"
  exit 0
fi

if [ "${1:-}" = "run" ] && [ "${2:-}" = "jobs" ] && [ "${3:-}" = "execute" ]; then
  if [ "$STUB_MODE" = "job-fail" ]; then
    exit 1
  fi
  exit 0
fi

# Handle describe commands per scenario
for word in "$@"; do
  if [ "$word" = "describe" ]; then
    case "$STUB_MODE" in
      first_run)
        exit 1
        ;;
      rerun|job-fail)
        exit 0
        ;;
      partial)
        if [ "${1:-}" = "secrets" ] && [ "${3:-}" = "toktickit-database-url" ]; then
          exit 1
        fi
        exit 0
        ;;
    esac
  fi
done

if [ "${1:-}" = "sql" ] && [ "${2:-}" = "users" ] && [ "${3:-}" = "list" ]; then
  case "$STUB_MODE" in
    first_run)
      echo "postgres"
      ;;
    rerun|partial|job-fail)
      printf "postgres\ntoktickit\n"
      ;;
  esac
  exit 0
fi

if [ "${1:-}" = "secrets" ] && [ "${2:-}" = "versions" ] && [ "${3:-}" = "add" ]; then
  PAYLOAD="$(cat)"
  if [ "${4:-}" = "toktickit-database-url" ] && [ -f /tmp/last_sql_pass ]; then
    SQL_PASS="$(cat /tmp/last_sql_pass)"
    URL_PASS="$(echo "$PAYLOAD" | sed -E 's|^postgresql://[^:]+:([^@]+)@.*|\1|')"
    if [ "$SQL_PASS" = "$URL_PASS" ] && [ -n "$SQL_PASS" ]; then
      MATCH_STR="true"
    else
      MATCH_STR="false"
    fi
    REDACTED_PAYLOAD="$(echo "$PAYLOAD" | sed -E 's/:([^@]+)@/:<REDACTED>@/g')"
    printf '  # stdin -> %s (sql_password_matches_secret=%s)\n' "$REDACTED_PAYLOAD" "$MATCH_STR" >> "$GCLOUD_LOG"
  else
    REDACTED_PAYLOAD="$(echo "$PAYLOAD" | sed -E 's/:([^@]+)@/:<REDACTED>@/g; s/^[A-Za-z0-9!]+$/<REDACTED_PASS>/g')"
    printf '  # stdin -> %s\n' "$REDACTED_PAYLOAD" >> "$GCLOUD_LOG"
  fi
  exit 0
fi

exit 0
EOF

if ! command -v openssl >/dev/null 2>&1; then
  cat << 'EOF' > /tmp/bin/openssl
#!/usr/bin/env bash
echo "stubbed-secret-token-32chars-long!"
EOF
fi

chmod +x /tmp/bin/gcloud
if [ -f /tmp/bin/openssl ]; then
  chmod +x /tmp/bin/openssl
fi
export PATH="/tmp/bin:$PATH"

for MODE in first_run rerun partial job-fail; do
  echo "=================================================================="
  echo "SCENARIO: ${MODE}"
  echo "=================================================================="
  export STUB_MODE="$MODE"
  export GCLOUD_LOG="/tmp/gcloud_${MODE}.log"
  rm -f "$GCLOUD_LOG" /tmp/last_sql_pass
  set +e
  bash "$DEPLOY_SCRIPT" >"/tmp/deploy_out_${MODE}.txt" 2>&1
  EXIT_CODE=$?
  set -e
  echo "[exit_code=${EXIT_CODE}]"
  echo "--- Recorded gcloud commands (printf '%q ') ---"
  cat "$GCLOUD_LOG"
  if [ "$MODE" = "first_run" ]; then
    if grep -q -- "--edition=enterprise" "$GCLOUD_LOG"; then
      echo "[PASS] Verified --edition=enterprise in gcloud sql instances create"
    else
      echo "[FAIL] Expected --edition=enterprise in gcloud sql instances create"
      exit 1
    fi
    if grep -q -- "--edition=ENTERPRISE" "$GCLOUD_LOG"; then
      echo "[FAIL] Found uppercase --edition=ENTERPRISE in gcloud sql instances create"
      exit 1
    fi
  fi
  echo "--- Script output tail ---"
  tail -n 10 "/tmp/deploy_out_${MODE}.txt" | sed -E 's/Admin Password : [^ (]+/Admin Password : <GENERATED_ADMIN_PASSWORD>/g; s/--password=[^ ]+/--password=<REDACTED>/g'
  echo ""
done
