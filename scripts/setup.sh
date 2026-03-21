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

# 2. Tailscale + SSH
echo "[2/3] ttyd"
if command -v ttyd &>/dev/null; then
  ok "ttyd installed"
else
  fail "ttyd not found"
  echo "      brew install ttyd"
  errors=$((errors + 1))
fi

# 3. Tailscale + SSH
echo "[3/3] Tailscale SSH"
if command -v tailscale &>/dev/null; then
  ok "tailscale installed (brew)"
  ts_json=$(tailscale status --json 2>/dev/null || echo "{}")
  ts_status=$(echo "$ts_json" | grep -o '"BackendState"[^,]*' | grep -o '[^"]*"$' | tr -d '"' || echo "unknown")
  if [ "$ts_status" = "Running" ]; then
    ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
    ok "Tailscale running — IP: $ts_ip"
    # Check Tailscale SSH (RunSSH is in debug prefs, not status)
    ts_ssh=$(tailscale debug prefs 2>/dev/null | grep '"RunSSH"' | grep 'true' || true)
    if [ -n "$ts_ssh" ]; then
      ok "Tailscale SSH enabled"
    else
      fail "Tailscale SSH not enabled"
      echo "      tailscale set --ssh"
      errors=$((errors + 1))
    fi
  else
    fail "Tailscale not running (state: $ts_status)"
    echo "      brew services start tailscale && tailscale login"
    errors=$((errors + 1))
  fi
else
  fail "Tailscale not found"
  echo "      brew install tailscale"
  echo "      brew services start tailscale"
  echo "      tailscale login"
  echo "      tailscale set --ssh"
  errors=$((errors + 1))
fi

echo ""
if [ "$errors" -eq 0 ]; then
  echo -e "${GREEN}All checks passed. Ready to use kaku-remote.${NC}"
else
  echo -e "${RED}${errors} issue(s) found. Fix them and re-run.${NC}"
  exit 1
fi
