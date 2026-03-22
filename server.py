#!/usr/bin/env python3
"""kaku-remote: web dashboard for Kaku terminal tabs.
Lists open Kaku tabs and provides web terminal access via ttyd.
Zero dependencies — stdlib only.
"""

import http.server
import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse, unquote, urlsplit

PORT = 7777
TTYD_BASE_PORT = 7781
TTYD_BIN = "ttyd"
KAKU_CLI = "/Applications/Kaku.app/Contents/MacOS/kaku"
WEB_DIR = Path(__file__).parent / "web"

# Track ttyd processes: {pane_id: {"proc": Popen, "port": int, "last_access": float}}
ttyd_procs = {}
ttyd_lock = threading.Lock()


def get_sessions():
    """Get open Kaku tabs via CLI."""
    try:
        result = subprocess.run(
            [KAKU_CLI, "cli", "list", "--format", "json"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return []

        panes = json.loads(result.stdout)
        home = os.path.expanduser("~")
        sessions = []

        for pane in panes:
            # Parse cwd from file://hostname/path URL
            cwd_raw = pane.get("cwd", "")
            if cwd_raw.startswith("file://"):
                parsed_cwd = urlsplit(cwd_raw)
                cwd = unquote(parsed_cwd.path)
            else:
                cwd = cwd_raw
            cwd = cwd.rstrip("/")

            # Shorten path
            display_path = cwd.replace(home, "~") if cwd.startswith(home) else cwd

            # Get git branch
            branch = ""
            if cwd:
                try:
                    git_result = subprocess.run(
                        ["git", "-C", cwd, "branch", "--show-current"],
                        capture_output=True, text=True, timeout=3,
                    )
                    if git_result.returncode == 0:
                        branch = git_result.stdout.strip()
                except Exception:
                    pass

            title = pane.get("tab_title") or pane.get("title") or "shell"

            sessions.append({
                "pane_id": pane["pane_id"],
                "tab_id": pane["tab_id"],
                "window_id": pane["window_id"],
                "title": title,
                "path": display_path,
                "command": pane.get("title", ""),
                "branch": branch,
                "is_active": pane.get("is_active", False),
                "tty": pane.get("tty_name", ""),
            })
        return sessions
    except Exception as e:
        print(f"Error getting sessions: {e}", file=sys.stderr)
        return []


def start_ttyd(pane_id):
    """Start a ttyd process that connects to a Kaku pane. Returns port number."""
    with ttyd_lock:
        if pane_id in ttyd_procs:
            proc_info = ttyd_procs[pane_id]
            if proc_info["proc"].poll() is None:
                proc_info["last_access"] = time.time()
                return proc_info["port"]
            del ttyd_procs[pane_id]

        port = TTYD_BASE_PORT + pane_id
        try:
            # Use wezterm cli proxy to connect to the pane
            proc = subprocess.Popen(
                [
                    TTYD_BIN,
                    "-p", str(port),
                    "-W",  # writable
                    "-t", "fontSize=14",
                    "-t", "fontFamily=monospace",
                    KAKU_CLI, "cli", "proxy",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            ttyd_procs[pane_id] = {
                "proc": proc,
                "port": port,
                "last_access": time.time(),
            }
            return port
        except Exception as e:
            print(f"Error starting ttyd: {e}", file=sys.stderr)
            return None


def cleanup_ttyd():
    """Stop all ttyd processes."""
    with ttyd_lock:
        for idx, info in ttyd_procs.items():
            try:
                info["proc"].terminate()
                info["proc"].wait(timeout=3)
            except Exception:
                info["proc"].kill()
        ttyd_procs.clear()


def ttyd_reaper():
    """Background thread: kill ttyd instances idle for >5 minutes."""
    while True:
        time.sleep(60)
        now = time.time()
        with ttyd_lock:
            expired = [
                idx for idx, info in ttyd_procs.items()
                if now - info["last_access"] > 300 and info["proc"].poll() is None
            ]
            for idx in expired:
                try:
                    ttyd_procs[idx]["proc"].terminate()
                except Exception:
                    pass
                del ttyd_procs[idx]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "" or path == "/index.html":
            self._serve_file("index.html", "text/html")
        elif path == "/style.css":
            self._serve_file("style.css", "text/css")
        elif path == "/app.js":
            self._serve_file("app.js", "application/javascript")
        elif path == "/api/sessions":
            self._json_response(get_sessions())
        elif path.startswith("/api/terminal/"):
            self._handle_terminal(path)
        else:
            self.send_error(404)

    def _serve_file(self, filename, content_type):
        filepath = WEB_DIR / filename
        if not filepath.exists():
            self.send_error(404)
            return
        content = filepath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", len(content))
        self.end_headers()
        self._write(content)

    def _json_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self._write(body)

    def _handle_terminal(self, path):
        try:
            pane_id = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid pane id")
            return

        port = start_ttyd(pane_id)
        if port is None:
            self.send_error(500, "Failed to start terminal")
            return

        host = self.headers.get("Host", "localhost").split(":")[0]
        self.send_response(302)
        self.send_header("Location", f"http://{host}:{port}")
        self.end_headers()

    def _write(self, data):
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            pass

    def log_message(self, format, *args):
        pass


def main():
    reaper = threading.Thread(target=ttyd_reaper, daemon=True)
    reaper.start()

    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"kaku-remote running on http://0.0.0.0:{PORT}")

    try:
        ts_ip = subprocess.run(
            ["tailscale", "ip", "-4"], capture_output=True, text=True
        ).stdout.strip()
        if ts_ip:
            print(f"Mobile access: http://{ts_ip}:{PORT}")
    except Exception:
        pass

    def shutdown(sig, frame):
        print("\nShutting down...")
        cleanup_ttyd()
        server.shutdown()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        cleanup_ttyd()


if __name__ == "__main__":
    main()
