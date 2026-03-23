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

## Open in browser

```
https://localhost:7777
```

**`https://`**, not `http://`. `make install` runs the server with HTTPS enabled.
On first visit, your browser will show a security warning — tap "Advanced" → "Proceed" once.

## Features

- **Session sharing** — web and terminal share the same session. Type in one, see it in the other
- **Multiple windows** — run Claude Code in one window, your shell in another. Switch from the dashboard
- **Session switcher** — tab bar at the top of terminal view. Switch sessions without going back to the dashboard
- **Session rename** — long-press a tab (terminal) or tap the edit icon (dashboard) to rename
- **Create from web** — tap `+` to spawn a new terminal window from your browser
- **Touch controls** — arrow keys, Enter, Ctrl+C, all the keys you need on mobile
- **Voice input (STT)** — tap the STT button to dictate commands via Web Speech API. Switch between EN/한국어 in the listening bar. Requires HTTPS and microphone permission
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

## Remote access via Tailscale (recommended)

**We strongly recommend setting up [Tailscale](https://tailscale.com/docs/how-to/quickstart).** It gives your MacBook a fixed IP and DNS name (`your-machine.tailnet-name.ts.net`) that works everywhere — same Wi-Fi, phone hotspot, coffee shop, or across the globe. No port forwarding, no VPN config, just install and it works.

```bash
brew install tailscale     # install
tailscale login            # authenticate (opens browser)
tailscale ip -4            # get your stable IP
# → https://100.x.x.x:7777 from any device on your tailnet
```

Install Tailscale on your phone too ([iOS](https://apps.apple.com/app/tailscale/id1470499037) / [Android](https://play.google.com/store/apps/details?id=com.tailscale.ipn)) and log in with the same account.

With Tailscale, you can bookmark `https://100.x.x.x:7777` on your phone and it always connects — whether you're on the same network or not.

### Without Tailscale

If your phone and MacBook are on the same network (Wi-Fi or phone hotspot), you can connect via your Mac's local IP. Note that this IP changes across networks.

**Phone hotspot trick:** Connect your MacBook to your phone's hotspot, close the lid, put it in your bag — open `https://localhost:7777` on your phone's browser. Terminal on the go.

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
