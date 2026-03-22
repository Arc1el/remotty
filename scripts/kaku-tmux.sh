#!/bin/bash
# Each tab opens in tmux session "remotty".

SESSION="remotty"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach -t "$SESSION"
else
  tmux new-session -s "$SESSION"
fi
