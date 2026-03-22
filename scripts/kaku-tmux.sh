#!/bin/bash
# Each Kaku tab creates a new tmux window in session "main".
# First tab creates the session, subsequent tabs add windows.

SESSION="main"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  # Session exists — create new window and attach to it
  WINDOW=$(tmux new-window -t "$SESSION" -P -F '#{window_index}')
  exec tmux attach -t "${SESSION}:${WINDOW}"
else
  # First tab — create session
  exec tmux new-session -s "$SESSION"
fi
