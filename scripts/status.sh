#!/bin/bash
# Quick status check for kaku-remote
# Used by Lua status bar and manual checks

tailscale_up=false
tailscale_ssh=false
tmux_session=""

# Tailscale + SSH
if command -v tailscale &>/dev/null; then
  ts_json=$(tailscale status --json 2>/dev/null || echo "")
  if echo "$ts_json" | grep -q '"BackendState".*"Running"'; then
    tailscale_up=true
    if tailscale debug prefs 2>/dev/null | grep -q '"RunSSH".*true'; then
      tailscale_ssh=true
    fi
  fi
fi

# tmux session
if tmux has-session -t main 2>/dev/null; then
  tmux_session="main"
fi

# Output for Lua parsing (single line)
echo "tailscale=$tailscale_up ssh=$tailscale_ssh tmux=$tmux_session"
