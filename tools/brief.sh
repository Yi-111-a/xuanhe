#!/usr/bin/env bash
# Condensed briefing for self-play: resources, crisis, memorial options, pending choices.
cd "$(dirname "$0")/.." && .venv/Scripts/python tools/mcp_call.py briefing "{\"session_id\":\"$1\"}" | grep -E "^# |^### |^- 选项|^- 国库|^- 太仓|^- 君威|^- 民心|^- 朝堂|^- 外重|渔阳鼙鼓 约|禄山异志 约|^- \[choice|待决|终局|告警|警示|scenario_changed" | cut -c1-230
