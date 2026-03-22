#!/usr/bin/env python3
"""remotty: web dashboard for terminal sessions.
Lists tmux windows and provides shared web terminal access via ttyd.
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
TTYD_BIN = "/opt/homebrew/bin/ttyd"
TMUX_BIN = "/opt/homebrew/bin/tmux"
TMUX_SESSION = "remotty"
WEB_DIR = Path(__file__).parent / "web"

# Track ttyd processes: {window_index: {"proc": Popen, "port": int, "last_access": float}}
ttyd_procs = {}
ttyd_lock = threading.Lock()


def get_sessions():
    """Get tmux window list."""
    try:
        fmt = "#{window_index}\t#{window_name}\t#{pane_current_path}\t#{pane_current_command}\t#{window_active}"
        result = subprocess.run(
            [TMUX_BIN, "list-windows", "-t", TMUX_SESSION, "-F", fmt],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return []

        home = os.path.expanduser("~")
        sessions = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 5:
                continue
            idx, name, path, cmd, active = parts[0], parts[1], parts[2], parts[3], parts[4]

            display_path = path.replace(home, "~") if path.startswith(home) else path

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

            sessions.append({
                "index": int(idx),
                "name": name,
                "path": display_path,
                "command": cmd,
                "branch": branch,
                "is_active": active == "1",
            })
        return sessions
    except Exception as e:
        print(f"Error getting sessions: {e}", file=sys.stderr)
        return []


def start_ttyd(window_index):
    """Start a ttyd process attached to a tmux window. Returns port number."""
    with ttyd_lock:
        if window_index in ttyd_procs:
            proc_info = ttyd_procs[window_index]
            if proc_info["proc"].poll() is None:
                proc_info["last_access"] = time.time()
                return proc_info["port"]
            del ttyd_procs[window_index]

        port = TTYD_BASE_PORT + window_index
        try:
            proc = subprocess.Popen(
                [
                    TTYD_BIN,
                    "-p", str(port),
                    "-W",
                    "-t", "fontSize=14",
                    "-t", "fontFamily=monospace",
                    TMUX_BIN, "attach", "-t", f"{TMUX_SESSION}:{window_index}",
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


def create_tmux_window(name=None):
    """Create a new tmux window. Creates session if needed. Returns window index or None."""
    try:
        # Check if session exists, create if not
        check = subprocess.run(
            [TMUX_BIN, "has-session", "-t", TMUX_SESSION],
            capture_output=True, timeout=3,
        )
        if check.returncode != 0:
            # Create detached session
            cmd = [TMUX_BIN, "new-session", "-d", "-s", TMUX_SESSION, "-P", "-F", "#{window_index}"]
            if name:
                cmd.extend(["-n", name])
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return int(result.stdout.strip())
            return None

        # Session exists, add window
        cmd = [TMUX_BIN, "new-window", "-t", TMUX_SESSION, "-P", "-F", "#{window_index}"]
        if name:
            cmd.extend(["-n", name])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return int(result.stdout.strip())
        return None
    except Exception:
        return None


def send_tmux_key(window_index, key):
    """Send a key to a tmux window via send-keys."""
    key_map = {
        "Up": "Up", "Down": "Down", "Left": "Left", "Right": "Right",
        "Enter": "Enter", "Tab": "Tab", "Escape": "Escape",
        "Backspace": "BSpace", "Space": "Space",
        "C-c": "C-c", "C-d": "C-d", "C-z": "C-z", "C-l": "C-l",
        "S-Up": "S-Up", "S-Down": "S-Down", "S-Left": "S-Left", "S-Right": "S-Right",
        "S-Enter": "S-Enter", "S-Tab": "S-BTab", "S-Escape": "S-Escape",
        "S-Backspace": "S-BSpace", "S-Space": "S-Space",
    }
    tmux_key = key_map.get(key, key)
    try:
        subprocess.run(
            [TMUX_BIN, "send-keys", "-t", f"{TMUX_SESSION}:{window_index}", tmux_key],
            capture_output=True, timeout=3,
        )
        return True
    except Exception:
        return False


def send_tmux_text(window_index, text):
    """Send literal text + Enter to a tmux window."""
    try:
        subprocess.run(
            [TMUX_BIN, "send-keys", "-t", f"{TMUX_SESSION}:{window_index}", "-l", text],
            capture_output=True, timeout=3,
        )
        subprocess.run(
            [TMUX_BIN, "send-keys", "-t", f"{TMUX_SESSION}:{window_index}", "Enter"],
            capture_output=True, timeout=3,
        )
        return True
    except Exception:
        return False


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
        elif path == "/terminal.html":
            self._serve_file("terminal.html", "text/html")
        elif path == "/terminal.js":
            self._serve_file("terminal.js", "application/javascript")
        elif path == "/terminal.css":
            self._serve_file("terminal.css", "text/css")
        elif path == "/api/sessions":
            self._json_response(get_sessions())
        elif path.startswith("/api/terminal/"):
            self._handle_terminal(path)
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/new-window":
            self._handle_new_window()
        elif path.startswith("/api/send-keys/"):
            self._handle_send_keys(path)
        elif path.startswith("/api/send-text/"):
            self._handle_send_text(path)
        else:
            self.send_error(404)

    def _handle_new_window(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        name = body.get("name", "").strip() or None

        window_index = create_tmux_window(name)
        if window_index is None:
            self.send_error(500, "Failed to create window")
            return

        self._json_response({"ok": True, "index": window_index, "name": name})

    def _handle_send_keys(self, path):
        try:
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        key = body.get("key", "")

        if not key:
            self.send_error(400, "Missing key")
            return

        ok = send_tmux_key(window_index, key)
        self._json_response({"ok": ok})

    def _handle_send_text(self, path):
        try:
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        text = body.get("text", "")

        if not text:
            self.send_error(400, "Missing text")
            return

        ok = send_tmux_text(window_index, text)
        self._json_response({"ok": ok})

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
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        port = start_ttyd(window_index)
        if port is None:
            self.send_error(500, "Failed to start terminal")
            return

        host = self.headers.get("Host", "localhost").split(":")[0]
        self._json_response({"port": port, "url": f"http://{host}:{port}", "window": window_index})

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
    print(f"remotty running on http://0.0.0.0:{PORT}")

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
