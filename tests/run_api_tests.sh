#!/usr/bin/env bash
# Runs tests/api_test.py against PocketBase on a throwaway database.
set -euo pipefail
cd "$(dirname "$0")/.."
PB="${PB:-pocketbase}"
PORT="${PORT:-8097}"
tmp=$(mktemp -d)
export TZ=Europe/Prague BAUBLE_URL="http://127.0.0.1:$PORT" BAUBLE_PREVIEW_BLOCK=".blocked.example"
flags=(--dir="$tmp/pb_data" --hooksDir=pb_hooks --migrationsDir=pb_migrations --publicDir="$tmp/public" --automigrate=false --hooksWatch=false)
mkdir "$tmp/public"
"$PB" "${flags[@]}" superuser upsert su@example.com su-password-123 >/dev/null
"$PB" "${flags[@]}" serve --http="127.0.0.1:$PORT" >"$tmp/pb.log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null; rm -rf "$tmp"' EXIT
for _ in $(seq 50); do curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 0.2; done
link=$("$PB" "${flags[@]}" invite admin Test | grep -o 'http[^ ]*/i/[a-z0-9]*')
python3 -I tests/api_test.py "http://127.0.0.1:$PORT" "$link" su@example.com su-password-123 || { cat "$tmp/pb.log"; exit 1; }
