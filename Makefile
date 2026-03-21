KAKU_CONFIG := $(HOME)/.config/kaku/kaku.lua
TMUX_CONFIG := $(HOME)/.tmux.conf
REMOTE_LUA := $(CURDIR)/config/kaku-remote.lua
REMOTE_TMUX := $(CURDIR)/config/tmux-remote.conf

.PHONY: install uninstall status setup

install:
	@echo "=== Installing kaku-remote ==="
	@# Add tmux-remote.conf to ~/.tmux.conf
	@if ! grep -q 'kaku-remote' "$(TMUX_CONFIG)" 2>/dev/null; then \
		echo 'source-file $(REMOTE_TMUX) # kaku-remote' >> "$(TMUX_CONFIG)"; \
		echo "  Added tmux-remote.conf to ~/.tmux.conf"; \
	else \
		echo "  tmux-remote.conf already in ~/.tmux.conf"; \
	fi
	@# Add loader to kaku.lua (before 'return config')
	@if ! grep -q 'kaku-remote' "$(KAKU_CONFIG)" 2>/dev/null; then \
		python3 -c "\
import sys; \
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
	@# Remove from ~/.tmux.conf
	@if grep -q 'kaku-remote' "$(TMUX_CONFIG)" 2>/dev/null; then \
		sed -i '' '/kaku-remote/d' "$(TMUX_CONFIG)"; \
		echo "  Removed from ~/.tmux.conf"; \
	fi
	@# Remove from kaku.lua
	@if grep -q 'kaku-remote' "$(KAKU_CONFIG)" 2>/dev/null; then \
		sed -i '' '/kaku-remote/d' "$(KAKU_CONFIG)"; \
		echo "  Removed from kaku.lua"; \
	fi
	@echo "  Done. Restart Kaku to apply."

status:
	@bash scripts/status.sh

setup:
	@bash scripts/setup.sh
