#!/bin/bash
# Each Kaku tab creates a new tmux window in session "main".
# First tab creates the session, subsequent tabs add windows.

SESSION="main"

# Ensure kaku-remote server is running (silently, don't block)
SERVER_PID="/tmp/kaku-remote.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if ! { [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; }; then
  nohup python3 "$SCRIPT_DIR/server.py" >/dev/null 2>&1 &
  echo $! > "$SERVER_PID"
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  # Session exists — create new window and attach to it
  WINDOW=$(tmux new-window -t "$SESSION" -P -F '#{window_index}')
  exec tmux attach -t "${SESSION}:${WINDOW}"
else
  # First tab — create session
  exec tmux new-session -s "$SESSION"
fi
