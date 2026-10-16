#!/usr/bin/env bash
# Usage: tools/play_turn.sh <session> '<adopted json array>' ['<ops json array>']
# Drafts, confirms and ends one season via MCP; prints the receipt summary and the turn report.
set -euo pipefail
cd "$(dirname "$0")/.."
P=".venv/Scripts/python tools/mcp_call.py"
S="$1"; A="${2:-[]}"; O="${3:-[]}"
R=$($P draft_edict "{\"session_id\":\"$S\",\"adopted\":$A,\"ops\":$O}")
echo "$R" | grep -E "rejected|delayed|错误" || true
E=$(echo "$R" | grep -oE "edict-[0-9a-f]+" | head -1)
$P confirm_edict "{\"session_id\":\"$S\",\"edict_id\":\"$E\"}" | grep -E "错误|changed" || true
$P end_turn "{\"session_id\":\"$S\"}"
