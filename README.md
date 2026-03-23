<p align="center">
  <img src="web/remotty.svg" alt="Remotty" width="120" height="120">
  <h1 align="center">Remotty</h1>
  <p align="center">
    <strong>Your terminal, from anywhere. Even from your phone.</strong>
  </p>
  <p align="center">
    One Python file. Zero dependencies. No build step.
  </p>
</p>

---

> **Remotty** = remote + tty

Running Claude Code overnight? Kicked off a long build? Left Codex working on a refactor?

Check in from your phone. Scroll through the output. Type a command. All from a browser — no SSH app, no extra setup.

**Pack your MacBook in your bag, connect your phone's hotspot, and keep working from the bus.** As long as your phone and MacBook share a network, your terminal is in your pocket.

## Why remotty?

Claude Code, Codex, and other AI agents run long tasks in your terminal. You shouldn't have to sit in front of your Mac waiting. Remotty lets you walk away and check back from any device.

|  | remotty | others |
|---|---|---|
| Install | `make install` | Docker, Node.js, config files... |
| Server | 1 file (`server.py`) | frameworks, packages, builds |
| Dependencies | Python stdlib only | npm, pip, cargo... |
| Web UI | 3 files (HTML+CSS+JS) | React, webpack, 200MB node_modules |
| Auto-start | built-in (launchd) | manual setup |

## How it works

```
Terminal → tmux → ttyd → reverse proxy → Browser
```

1. Your terminal runs inside a tmux session called `remotty`
2. The server watches tmux and lists active windows
3. Click a session in the web dashboard — you're in. Same session, same I/O

Claude Code running in window 2? Tap it. You see exactly what it sees. You can type exactly as if you were there.

## Quick start

```bash
brew install tmux ttyd    # one-time
make install              # done
```

Open `https://localhost:7777` (HTTPS by default via `make install`)

## Features

- **Session sharing** — web and terminal share the same session. Type in one, see it in the other
- **Multiple windows** — run Claude Code in one window, your shell in another. Switch from the dashboard
- **Session switcher** — tab bar at the top of terminal view. Switch sessions without going back to the dashboard
- **Session rename** — long-press a tab (terminal) or tap the edit icon (dashboard) to rename
- **Create from web** — tap `+` to spawn a new terminal window from your browser
- **Touch controls** — arrow keys, Enter, Ctrl+C, all the keys you need on mobile
- **Voice input** — tap the mic button to dictate commands. Long-press to switch between EN/한국어
- **Scroll mode** — swipe to scroll through terminal history via tmux copy-mode
- **HTTPS** — self-signed cert auto-generated on first run. Secure context for modern browser APIs
- **Reverse proxy** — ttyd served through the main server. Single port, single cert, no mixed content
- **Auto-cleanup** — idle terminal backends are reaped automatically
- **Auto-start** — server starts on login, restarts on crash (launchd)
- **Tailscale ready** — access from anywhere on your tailnet
- **Hotspot ready** — MacBook in your bag + phone hotspot = terminal on the go

## Terminal setup

### Kaku

Automatic. `make install` handles everything.

### Any other terminal

Connect to the `remotty` tmux session:

```bash
tmux new-session -A -s remotty
```

Auto-attach on terminal start (`~/.zshrc`):

```bash
# remotty: auto-attach tmux session
if [ -z "$TMUX" ]; then
  tmux new-session -A -s remotty
fi
```

## HTTPS

`make install` sets up the server with HTTPS by default (`--https` flag). A self-signed certificate is auto-generated on first run in `.certs/`.

Your browser will show a security warning on first visit — tap "Advanced" → "Proceed" once, and it won't ask again for that device.

**Why the warning is fine:** The certificate is self-signed (not verified by a CA), but the connection is still fully encrypted. Since you own both the server and the client, there's no real security concern — this is standard for local/private servers.

## Remote access

### Via Tailscale

```bash
tailscale ip -4            # get your IP
# → https://100.x.x.x:7777 from any device on your tailnet
```

### Via phone hotspot

Connect your MacBook to your phone's hotspot (Wi-Fi or USB). Both devices are on the same local network — open `https://localhost:7777` on your phone's browser. Your MacBook can stay closed in your bag while you monitor and control your terminal sessions on the move.

## Commands

| Command | What it does |
|---|---|
| `make install` | Full setup |
| `make uninstall` | Clean removal |
| `make serve` | Start server |
| `make stop` | Stop server |
| `make sync` | Deploy code changes |
| `make status` | Check Tailscale + tmux |

## Stack

```
server.py ........ Python stdlib (HTTPS, reverse proxy, WebSocket relay)
index.html ....... session dashboard
terminal.html .... web terminal + touch/voice controls
style.css ........ dashboard styles (Catppuccin Mocha)
terminal.css ..... terminal styles
app.js ........... dashboard logic
terminal.js ...... terminal + voice recognition logic
```

No React. No Next.js. No Docker. No node_modules.

Just Python and a browser.

## License

MIT
