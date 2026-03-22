PROJECT_DIR := $(CURDIR)
KAKU_CONFIG := $(HOME)/.config/kaku/kaku.lua
TMUX_CONFIG := $(HOME)/.tmux.conf
REMOTE_LUA := $(CURDIR)/config/kaku-remote.lua
REMOTE_TMUX := $(CURDIR)/config/tmux-remote.conf
LAUNCHD_PLIST := $(HOME)/Library/LaunchAgents/com.kaku-remote.server.plist
SERVER_INSTALL_DIR := $(HOME)/.local/share/kaku-remote
SERVER_LAUNCHER := $(HOME)/.local/bin/kaku-remote-server

.PHONY: serve stop status setup install uninstall

serve:
	@launchctl list | grep -q com.kaku-remote.server && echo "Already running (launchd)" || \
		{ launchctl load "$(LAUNCHD_PLIST)" 2>/dev/null && echo "Started via launchd"; }

stop:
	@launchctl unload "$(LAUNCHD_PLIST)" 2>/dev/null && echo "Stopped." || echo "Not running."
	@pkill -f "ttyd.*tmux attach" 2>/dev/null || true

install:
	@echo "=== Installing kaku-remote ==="
	@# Copy server files outside Documents (macOS sandbox restriction)
	@mkdir -p "$(SERVER_INSTALL_DIR)" "$(HOME)/.local/bin"
	@cp "$(PROJECT_DIR)/server.py" "$(SERVER_INSTALL_DIR)/server.py"
	@cp -r "$(PROJECT_DIR)/web" "$(SERVER_INSTALL_DIR)/web"
	@echo "  Copied server to $(SERVER_INSTALL_DIR)"
	@# Create launcher script
	@echo '#!/bin/bash' > "$(SERVER_LAUNCHER)"
	@echo 'cd ~/.local/share/kaku-remote' >> "$(SERVER_LAUNCHER)"
	@echo 'exec /usr/bin/python3 server.py' >> "$(SERVER_LAUNCHER)"
	@chmod +x "$(SERVER_LAUNCHER)"
	@echo "  Created launcher at $(SERVER_LAUNCHER)"
	@# Install launchd plist
	@cp "$(PROJECT_DIR)/config/com.kaku-remote.server.plist" "$(LAUNCHD_PLIST)"
	@launchctl load "$(LAUNCHD_PLIST)" 2>/dev/null || true
	@echo "  Installed launchd service (auto-start on login)"
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
	@rm -rf "$(SERVER_INSTALL_DIR)" "$(SERVER_LAUNCHER)" "$(LAUNCHD_PLIST)"
	@echo "  Removed server, launcher, and launchd service"
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
