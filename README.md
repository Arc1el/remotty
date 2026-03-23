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
Terminal → tmux → ttyd → Browser
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

Open `http://localhost:7777` — or with HTTPS:

```bash
./server.py --https        # voice input requires HTTPS
```

## Features

- **Session sharing** — web and terminal share the same session. Type in one, see it in the other
- **Multiple windows** — run Claude Code in one window, your shell in another. Switch from the dashboard
- **Create from web** — tap `+` to spawn a new terminal window from your browser
- **Touch controls** — arrow keys, Enter, Ctrl+C, all the keys you need on mobile
- **Voice input** — tap the mic button and speak. Uses Web Speech API (requires HTTPS)
- **Scroll mode** — swipe to scroll through terminal history via tmux copy-mode
- **HTTPS support** — `./server.py --https` with auto-generated certs (mkcert or self-signed)
- **Auto-cleanup** — close the terminal, sessions clean up automatically
- **Auto-start** — server starts on login, restarts on crash (launchd)
- **Tailscale ready** — access from anywhere via `https://<tailscale-ip>:7777`

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

## Remote access via Tailscale

```bash
tailscale set --ssh
tailscale ip -4            # get your IP
# → https://100.x.x.x:7777 from any device
```

Perfect for checking on long-running agent sessions from your couch. Voice input works over Tailscale too — just use `--https`.

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
server.py .... Python stdlib (HTTP server + ttyd reverse proxy)
index.html ... session list
terminal.html  web terminal + touch/voice controls
style.css .... dashboard styles
terminal.css . terminal styles
app.js ....... dashboard logic
terminal.js .. terminal + voice recognition logic
```

No React. No Next.js. No Docker. No node_modules.

Just Python and a browser.

## License

MIT
