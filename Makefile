PROJECT_DIR := $(CURDIR)
KAKU_CONFIG := $(HOME)/.config/kaku/kaku.lua
TMUX_CONFIG := $(HOME)/.tmux.conf
ZSHRC := $(HOME)/.zshrc
REMOTE_LUA := $(CURDIR)/config/remotty.lua
REMOTE_TMUX := $(CURDIR)/config/tmux-remote.conf
LAUNCHD_PLIST := $(HOME)/Library/LaunchAgents/com.remotty.server.plist
SERVER_INSTALL_DIR := $(HOME)/.local/share/remotty
SERVER_LAUNCHER := $(HOME)/.local/bin/remotty-server
TERMINAL ?= auto

.PHONY: serve stop status setup install uninstall sync

serve:
	@launchctl list | grep -q com.remotty.server && echo "Already running (launchd)" || \
		{ launchctl load "$(LAUNCHD_PLIST)" 2>/dev/null && echo "Started via launchd"; }

stop:
	@launchctl unload "$(LAUNCHD_PLIST)" 2>/dev/null && echo "Stopped." || echo "Not running."
	@pkill -f "ttyd.*tmux attach" 2>/dev/null || true

install:
	@echo "=== Installing remotty ==="
	@# Copy server files outside Documents (macOS sandbox restriction)
	@mkdir -p "$(SERVER_INSTALL_DIR)" "$(HOME)/.local/bin"
	@cp "$(PROJECT_DIR)/server.py" "$(SERVER_INSTALL_DIR)/server.py"
	@rm -rf "$(SERVER_INSTALL_DIR)/web" && cp -r "$(PROJECT_DIR)/web" "$(SERVER_INSTALL_DIR)/web"
	@echo "  Copied server to $(SERVER_INSTALL_DIR)"
	@# Create launcher script
	@echo '#!/bin/bash' > "$(SERVER_LAUNCHER)"
	@echo 'cd ~/.local/share/remotty' >> "$(SERVER_LAUNCHER)"
	@echo 'exec /usr/bin/python3 server.py --https' >> "$(SERVER_LAUNCHER)"
	@chmod +x "$(SERVER_LAUNCHER)"
	@echo "  Created launcher at $(SERVER_LAUNCHER)"
	@# Install launchd plist
	@cp "$(PROJECT_DIR)/config/com.remotty.server.plist" "$(LAUNCHD_PLIST)"
	@launchctl load "$(LAUNCHD_PLIST)" 2>/dev/null || true
	@echo "  Installed launchd service (auto-start on login)"
	@# Add tmux-remote.conf to ~/.tmux.conf
	@if ! grep -q 'remotty' "$(TMUX_CONFIG)" 2>/dev/null; then \
		echo 'source-file $(REMOTE_TMUX) # remotty' >> "$(TMUX_CONFIG)"; \
		echo "  Added tmux-remote.conf to ~/.tmux.conf"; \
	else \
		echo "  tmux-remote.conf already in ~/.tmux.conf"; \
	fi
	@# Terminal-specific setup
	@if [ "$(TERMINAL)" = "iterm" ] || [ "$(TERMINAL)" = "zsh" ]; then \
		if ! grep -q 'remotty' "$(ZSHRC)" 2>/dev/null; then \
			printf '\n# remotty: auto-attach tmux session\nif [ -z "$$TMUX" ]; then\n  tmux new-session -A -s remotty\nfi\n' >> "$(ZSHRC)"; \
			echo "  Added tmux auto-attach to ~/.zshrc"; \
		else \
			echo "  tmux auto-attach already in ~/.zshrc"; \
		fi; \
	elif [ "$(TERMINAL)" = "kaku" ] || [ "$(TERMINAL)" = "auto" ]; then \
		if [ -f "$(KAKU_CONFIG)" ]; then \
			if ! grep -q 'remotty' "$(KAKU_CONFIG)" 2>/dev/null; then \
				python3 -c "\
f = open('$(KAKU_CONFIG)', 'r'); lines = f.read(); f.close(); \
loader = \"\n-- remotty\nlocal _ok, _remote = pcall(dofile, '$(REMOTE_LUA)')\nif _ok and _remote and _remote.apply then _remote.apply(config) end\n\"; \
lines = lines.replace('return config', loader + 'return config'); \
f = open('$(KAKU_CONFIG)', 'w'); f.write(lines); f.close()"; \
				echo "  Added remotty loader to kaku.lua"; \
			else \
				echo "  remotty loader already in kaku.lua"; \
			fi; \
		elif [ "$(TERMINAL)" = "auto" ]; then \
			echo "  No known terminal config found. Use TERMINAL=iterm for iTerm/zsh setup."; \
		fi; \
	fi
	@echo "  Done. Restart terminal to apply."

uninstall:
	@echo "=== Uninstalling remotty ==="
	@$(MAKE) stop
	@rm -rf "$(SERVER_INSTALL_DIR)" "$(SERVER_LAUNCHER)" "$(LAUNCHD_PLIST)"
	@echo "  Removed server, launcher, and launchd service"
	@if grep -q 'remotty' "$(TMUX_CONFIG)" 2>/dev/null; then \
		sed -i '' '/remotty/d' "$(TMUX_CONFIG)"; \
		echo "  Removed from ~/.tmux.conf"; \
	fi
	@if grep -q 'remotty' "$(KAKU_CONFIG)" 2>/dev/null; then \
		sed -i '' '/remotty/d' "$(KAKU_CONFIG)"; \
		echo "  Removed from kaku.lua"; \
	fi
	@if grep -q 'remotty' "$(ZSHRC)" 2>/dev/null; then \
		sed -i '' '/remotty/,/^fi$$/d' "$(ZSHRC)"; \
		echo "  Removed from ~/.zshrc"; \
	fi
	@echo "  Done. Restart terminal to apply."

sync:
	@cp "$(PROJECT_DIR)/server.py" "$(SERVER_INSTALL_DIR)/server.py"
	@rm -rf "$(SERVER_INSTALL_DIR)/web" && cp -r "$(PROJECT_DIR)/web" "$(SERVER_INSTALL_DIR)/web"
	@$(MAKE) stop
	@$(MAKE) serve
	@echo "Synced and restarted."

status:
	@bash scripts/status.sh

setup:
	@bash scripts/setup.sh
