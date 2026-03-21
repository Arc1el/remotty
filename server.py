#!/usr/bin/env python3
"""kaku-remote: web dashboard + ttyd manager for tmux sessions.
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
from urllib.parse import urlparse

PORT = 7777
TTYD_BASE_PORT = 7781
TTYD_BIN = "ttyd"
TMUX_SESSION = "main"
WEB_DIR = Path(__file__).parent / "web"

# Track ttyd processes: {window_index: {"proc": Popen, "port": int, "last_access": float}}
ttyd_procs = {}
ttyd_lock = threading.Lock()


def get_sessions():
    """Get tmux window list with context info."""
    try:
        fmt = "#{window_index}\t#{window_name}\t#{pane_current_path}\t#{pane_current_command}"
        result = subprocess.run(
            ["tmux", "list-windows", "-t", TMUX_SESSION, "-F", fmt],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return []

        sessions = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            idx, name, path, cmd = parts[0], parts[1], parts[2], parts[3]

            # Get git branch
            branch = ""
            try:
                git_result = subprocess.run(
                    ["git", "-C", path, "branch", "--show-current"],
                    capture_output=True, text=True, timeout=3,
                )
                if git_result.returncode == 0:
                    branch = git_result.stdout.strip()
            except Exception:
                pass

            # Shorten path
            home = os.path.expanduser("~")
            display_path = path.replace(home, "~") if path.startswith(home) else path

            sessions.append({
                "index": int(idx),
                "name": name,
                "path": display_path,
                "command": cmd,
                "branch": branch,
            })
        return sessions
    except Exception as e:
        print(f"Error getting sessions: {e}", file=sys.stderr)
        return []


def start_ttyd(window_index):
    """Start a ttyd process for a specific tmux window. Returns port number."""
    with ttyd_lock:
        if window_index in ttyd_procs:
            proc_info = ttyd_procs[window_index]
            if proc_info["proc"].poll() is None:
                proc_info["last_access"] = time.time()
                return proc_info["port"]
            # Dead process, clean up
            del ttyd_procs[window_index]

        port = TTYD_BASE_PORT + window_index
        try:
            proc = subprocess.Popen(
                [
                    TTYD_BIN,
                    "-p", str(port),
                    "-W",  # writable
                    "-t", "fontSize=14",
                    "-t", "fontFamily=monospace",
                    "tmux", "attach", "-t", f"{TMUX_SESSION}:{window_index}",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            ttyd_procs[window_index] = {
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
        self.write(content)

    def _json_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.write(body)

    def _handle_terminal(self, path):
        try:
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        port = start_ttyd(window_index)
        if port is None:
            self.send_error(500, "Failed to start terminal")
            return

        # Redirect to ttyd on its port
        host = self.headers.get("Host", "localhost").split(":")[0]
        self.send_response(302)
        self.send_header("Location", f"http://{host}:{port}")
        self.end_headers()

    def write(self, data):
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            pass

    def log_message(self, format, *args):
        # Quiet logging
        pass


def main():
    # Start reaper thread
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
