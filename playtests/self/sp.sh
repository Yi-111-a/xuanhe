#!/usr/bin/env bash
# self-play wrapper: frozen round snapshot + per-game home
set -o pipefail
ROOT="C:/Users/yiyin/Desktop/新建文件夹/xuanhe"
export XUANHE_ENGINE_DIR="$ROOT/playtests/engine-${SP_ROUND:-r1}" XUANHE_SCENARIOS_DIR="$ROOT/playtests/engine-${SP_ROUND:-r1}/scenarios_snapshot" LLM_SIM_HOME="$ROOT/playtests/self/$SP_GAME/home"
cd "$ROOT" && .venv/Scripts/python tools/selfplay.py "$@"
