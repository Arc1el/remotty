#!/bin/bash
# Quick status check for kaku-remote
# Used by Lua status bar and manual checks

tailscale_up=false
ssh_up=false
tmux_session=""

# Tailscale
if command -v tailscale &>/dev/null; then
  ts_state=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [ "$ts_state" = "Running" ]; then
    tailscale_up=true
  fi
fi

# SSH
if nc -z localhost 22 &>/dev/null; then
  ssh_up=true
fi

# tmux session
if tmux has-session -t main 2>/dev/null; then
  tmux_session="main"
fi

# Output for Lua parsing (single line)
echo "tailscale=$tailscale_up ssh=$ssh_up tmux=$tmux_session"
