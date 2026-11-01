#!/usr/bin/env bash
# PocketBase against a throwaway database in .dev/, hooks reload on change.
#   ./scripts/dev.sh serve               API on http://127.0.0.1:8090, serves web/dist
#   ./scripts/dev.sh invite admin Alex   print a first sign-up link
#   npm --prefix web run dev             Vite with hot reload, proxies /api to :8090
set -euo pipefail
cd "$(dirname "$0")/.."
export TZ="${TZ:-Europe/Prague}" BAUBLE_URL="${BAUBLE_URL:-http://127.0.0.1:8090}"
exec pocketbase --dir=.dev/pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations --publicDir=web/dist --automigrate=false "$@"
