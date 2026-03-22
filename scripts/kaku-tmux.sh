#!/bin/bash
# Each Kaku tab opens in tmux session "main".

SESSION="main"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach -t "$SESSION"
else
  tmux new-session -s "$SESSION"
fi
