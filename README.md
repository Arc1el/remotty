<p align="center">
  <h1 align="center">remotty</h1>
  <p align="center">
    <strong>Share your terminal sessions to the web. Instantly.</strong>
  </p>
  <p align="center">
    One Python file. Zero dependencies. No build step.
  </p>
</p>

---

> **remotty** = remote + tty

Your terminal, accessible from any browser. Type on your phone, see it on your Mac. Or the other way around.

## Why remotty?

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

## Quick start

```bash
brew install tmux ttyd    # one-time
make install              # done
```

Open `http://localhost:7777`

## Features

- **Session sharing** — web and terminal share the same session. Type in one, see it in the other
- **Create from web** — tap `+` to spawn a new terminal window from your browser
- **Touch controls** — arrow keys, Enter, Ctrl shortcuts, all from your phone
- **Auto-cleanup** — close the terminal, sessions clean up automatically
- **Auto-start** — server starts on login, restarts on crash (launchd)
- **Tailscale ready** — access from anywhere via `http://<tailscale-ip>:7777`

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
if [ -z "$TMUX" ]; then
  tmux new-session -A -s remotty
fi
```

## Remote access via Tailscale

```bash
tailscale set --ssh
tailscale ip -4            # get your IP
# → http://100.x.x.x:7777 from any device
```

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
server.py .... 300 lines, Python stdlib
index.html ... session list
terminal.html  web terminal + touch controls
style.css .... dashboard styles
terminal.css . terminal styles
app.js ....... dashboard logic
terminal.js .. terminal logic
```

No React. No Next.js. No Docker. No node_modules.

Just Python and a browser.

## License

MIT
