PROJECT_DIR := $(CURDIR)
KAKU_CONFIG := $(HOME)/.config/kaku/kaku.lua
TMUX_CONFIG := $(HOME)/.tmux.conf
REMOTE_LUA := $(CURDIR)/config/kaku-remote.lua
REMOTE_TMUX := $(CURDIR)/config/tmux-remote.conf
PID_FILE := /tmp/kaku-remote.pid

.PHONY: serve stop status setup install uninstall

serve:
	@if [ -f "$(PID_FILE)" ] && kill -0 $$(cat "$(PID_FILE)") 2>/dev/null; then \
		echo "Already running (PID $$(cat $(PID_FILE)))"; \
	else \
		python3 "$(PROJECT_DIR)/server.py" & \
		echo $$! > "$(PID_FILE)"; \
		echo "Started (PID $$!)"; \
	fi

stop:
	@if [ -f "$(PID_FILE)" ]; then \
		kill $$(cat "$(PID_FILE)") 2>/dev/null || true; \
		rm -f "$(PID_FILE)"; \
		echo "Stopped."; \
	else \
		echo "Not running."; \
	fi
	@pkill -f "ttyd.*tmux attach" 2>/dev/null || true

install:
	@echo "=== Installing kaku-remote ==="
	@# Add tmux-remote.conf to ~/.tmux.conf
	@if ! grep -q 'kaku-remote' "$(TMUX_CONFIG)" 2>/dev/null; then \
		echo 'source-file $(REMOTE_TMUX) # kaku-remote' >> "$(TMUX_CONFIG)"; \
		echo "  Added tmux-remote.conf to ~/.tmux.conf"; \
	else \
		echo "  tmux-remote.conf already in ~/.tmux.conf"; \
	fi
	@# Add loader to kaku.lua
	@if ! grep -q 'kaku-remote' "$(KAKU_CONFIG)" 2>/dev/null; then \
		python3 -c "\
f = open('$(KAKU_CONFIG)', 'r'); lines = f.read(); f.close(); \
loader = \"\n-- kaku-remote\nlocal _ok, _remote = pcall(dofile, '$(REMOTE_LUA)')\nif _ok and _remote and _remote.apply then _remote.apply(config) end\n\"; \
lines = lines.replace('return config', loader + 'return config'); \
f = open('$(KAKU_CONFIG)', 'w'); f.write(lines); f.close()"; \
		echo "  Added kaku-remote loader to kaku.lua"; \
	else \
		echo "  kaku-remote loader already in kaku.lua"; \
	fi
	@echo "  Done. Restart Kaku to apply."

uninstall:
	@echo "=== Uninstalling kaku-remote ==="
	@$(MAKE) stop
	@if grep -q 'kaku-remote' "$(TMUX_CONFIG)" 2>/dev/null; then \
		sed -i '' '/kaku-remote/d' "$(TMUX_CONFIG)"; \
		echo "  Removed from ~/.tmux.conf"; \
	fi
	@if grep -q 'kaku-remote' "$(KAKU_CONFIG)" 2>/dev/null; then \
		sed -i '' '/kaku-remote/d' "$(KAKU_CONFIG)"; \
		echo "  Removed from kaku.lua"; \
	fi
	@echo "  Done. Restart Kaku to apply."

status:
	@bash scripts/status.sh

setup:
	@bash scripts/setup.sh
