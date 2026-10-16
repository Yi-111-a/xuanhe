#!/usr/bin/env bash
# Freeze the engine (tracked files) and scenarios for one playtest round: tools/snapshot_round.sh r2
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/playtests/engine-$1"
rm -rf "$DEST" && mkdir -p "$DEST"
(cd "$ROOT/engine" && git ls-files -z | xargs -0 -I{} cp --parents {} "$DEST/")
cp -r "$ROOT/scenarios" "$DEST/scenarios_snapshot"
want=$(cd "$ROOT/engine" && git ls-files | wc -l)
got=$(cd "$DEST" && find . -type f -not -path "./scenarios_snapshot/*" | wc -l)
[ "$want" -eq "$got" ] || { echo "snapshot incomplete: $got of $want files" >&2; exit 1; }
echo "snapshot $1: engine $(cd "$ROOT/engine" && git rev-parse --short HEAD), $got files"
