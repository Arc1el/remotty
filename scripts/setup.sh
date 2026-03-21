#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }

echo "=== Kaku Remote Setup ==="
echo ""

errors=0

# 1. tmux
echo "[1/3] tmux"
if command -v tmux &>/dev/null; then
  ok "tmux $(tmux -V | awk '{print $2}') installed"
else
  fail "tmux not found"
  echo "      brew install tmux"
  errors=$((errors + 1))
fi

# 2. Tailscale
echo "[2/3] Tailscale"
if command -v tailscale &>/dev/null; then
  ok "tailscale installed"
  ts_status=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  if [ "$ts_status" = "Running" ]; then
    ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
    ok "Tailscale running — IP: $ts_ip"
  else
    warn "Tailscale not running (state: $ts_status)"
    echo "      Open Tailscale app and connect"
  fi
elif [ -d "/Applications/Tailscale.app" ]; then
  warn "Tailscale app exists but CLI not in PATH"
  echo "      Open Tailscale app, or add to PATH"
else
  fail "Tailscale not found"
  echo "      brew install --cask tailscale"
  errors=$((errors + 1))
fi

# 3. SSH (Remote Login)
echo "[3/3] SSH (Remote Login)"
if nc -z localhost 22 &>/dev/null; then
  ok "SSH listening on port 22"
else
  ssh_status=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -i "on" || true)
  if [ -n "$ssh_status" ]; then
    warn "Remote Login enabled but port 22 not responding"
  else
    fail "Remote Login disabled"
    echo "      System Settings > General > Sharing > Remote Login"
    echo "      or: sudo systemsetup -setremotelogin on"
    errors=$((errors + 1))
  fi
fi

echo ""
if [ "$errors" -eq 0 ]; then
  echo -e "${GREEN}All checks passed. Ready to use kaku-remote.${NC}"
else
  echo -e "${RED}${errors} issue(s) found. Fix them and re-run.${NC}"
  exit 1
fi
