#!/usr/bin/env python3
"""remotty: web dashboard for terminal sessions.
Lists tmux windows and provides shared web terminal access via ttyd.
Zero dependencies — stdlib only.
"""

import argparse
import http.client
import http.server
import json
import os
import signal
import socket
import ssl
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

PORT = 7777
TTYD_BASE_PORT = 7781
def _find_bin(name):
    """Find binary path, checking common Homebrew locations when PATH is minimal (e.g. launchd)."""
    for d in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]:
        p = f"{d}/{name}"
        if os.path.isfile(p):
            return p
    return name

TTYD_BIN = _find_bin("ttyd")
TMUX_BIN = _find_bin("tmux")
TMUX_SESSION = "remotty"
WEB_DIR = Path(__file__).parent / "web"
CERT_DIR = Path(__file__).parent / ".certs"

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
                    "-i", "127.0.0.1",
                    "-b", f"/ttyd/{window_index}/",
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


def scroll_tmux(window_index, direction):
    """Scroll tmux pane using copy mode. direction: 'up' or 'down'."""
    target = f"{TMUX_SESSION}:{window_index}"
    try:
        # Enter copy mode (no-op if already in copy mode)
        subprocess.run(
            [TMUX_BIN, "copy-mode", "-t", target],
            capture_output=True, timeout=3,
        )
        # Scroll 5 lines at a time
        cmd = "scroll-up" if direction == "up" else "scroll-down"
        for _ in range(5):
            subprocess.run(
                [TMUX_BIN, "send-keys", "-t", target, "-X", cmd],
                capture_output=True, timeout=3,
            )
        return True
    except Exception:
        return False


class Handler(http.server.BaseHTTPRequestHandler):
    def _get_preview_port_from_referer(self):
        """Check if request originates from a preview iframe via Referer header."""
        import re
        referer = self.headers.get("Referer", "")
        m = re.search(r"/preview/(\d+)/", referer)
        if m:
            return int(m.group(1))
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Direct preview proxy
        if parsed.path.startswith("/preview/"):
            self._proxy_preview()
            return

        # Assets requested from within a preview iframe (Referer-based routing)
        if not path.startswith("/api") and not path.startswith("/ttyd"):
            preview_port = self._get_preview_port_from_referer()
            if preview_port:
                self._proxy_preview_asset(preview_port)
                return

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
        elif path == "/remotty.svg":
            self._serve_file("remotty.svg", "image/svg+xml")
        elif path == "/remotty_icon.ico":
            self._serve_file("remotty_icon.ico", "image/x-icon")
        elif path == "/viewer.html" or path == "/viewer":
            self._serve_file("viewer.html", "text/html")
        elif path == "/api/file":
            self._handle_file_read(parsed)
        elif path == "/api/sessions":
            self._json_response(get_sessions())
        elif path.startswith("/api/terminal/"):
            self._handle_terminal(path)
        elif parsed.path.startswith("/ttyd/"):
            self._proxy_ttyd()
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if parsed.path.startswith("/preview/"):
            self._proxy_preview()
            return

        # Referer-based routing for preview assets
        if not path.startswith("/api"):
            preview_port = self._get_preview_port_from_referer()
            if preview_port:
                self._proxy_preview_asset(preview_port)
                return

        if path == "/api/new-window":
            self._handle_new_window()
        elif path.startswith("/api/send-keys/"):
            self._handle_send_keys(path)
        elif path.startswith("/api/send-text/"):
            self._handle_send_text(path)
        elif path.startswith("/api/scroll/"):
            self._handle_scroll(path)
        elif path.startswith("/api/rename-window/"):
            self._handle_rename_window(path)
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

    def _handle_scroll(self, path):
        try:
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        direction = body.get("direction", "up")

        ok = scroll_tmux(window_index, direction)
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

    def _handle_rename_window(self, path):
        try:
            window_index = int(path.split("/")[-1])
        except ValueError:
            self.send_error(400, "Invalid window index")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        name = body.get("name", "").strip()

        if not name:
            self.send_error(400, "Missing name")
            return

        try:
            subprocess.run(
                [TMUX_BIN, "rename-window", "-t", f"{TMUX_SESSION}:{window_index}", name],
                capture_output=True, timeout=3,
            )
            self._json_response({"ok": True})
        except Exception:
            self._json_response({"ok": False})

    def _handle_file_read(self, parsed):
        """Read a local file and return its content. Restricted to text files."""
        from urllib.parse import parse_qs
        params = parse_qs(parsed.query)
        file_path = params.get("path", [None])[0]
        if not file_path:
            self.send_error(400, "Missing path parameter")
            return

        # Expand ~ and resolve
        file_path = os.path.expanduser(file_path)
        file_path = os.path.realpath(file_path)

        # Only allow readable text files
        ALLOWED_EXT = {".md", ".markdown", ".txt", ".rst", ".org", ".adoc"}
        _, ext = os.path.splitext(file_path)
        if ext.lower() not in ALLOWED_EXT:
            self.send_error(403, f"File type not allowed: {ext}")
            return

        if not os.path.isfile(file_path):
            self.send_error(404, "File not found")
            return

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            self._json_response({"content": content, "path": file_path})
        except Exception as e:
            self.send_error(500, str(e))

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

        # Wait until ttyd is ready
        for _ in range(20):
            try:
                s = socket.create_connection(("127.0.0.1", port), timeout=0.5)
                s.close()
                break
            except OSError:
                time.sleep(0.15)

        self._json_response({"port": port, "url": f"/ttyd/{window_index}/", "window": window_index})

    def _proxy_ttyd(self):
        """Reverse-proxy HTTP and WebSocket requests to local ttyd."""
        parsed = urlparse(self.path)
        path = parsed.path
        parts = path.split("/")
        try:
            window_index = int(parts[2])
        except (IndexError, ValueError):
            self.send_error(400)
            return

        port = start_ttyd(window_index)
        if port is None:
            self.send_error(502)
            return

        # Keep ttyd alive while being accessed via proxy
        with ttyd_lock:
            if window_index in ttyd_procs:
                ttyd_procs[window_index]["last_access"] = time.time()

        target = path
        if parsed.query:
            target += "?" + parsed.query

        if self.headers.get("Upgrade", "").lower() == "websocket":
            self._proxy_websocket(port, target, window_index)
            return

        # HTTP proxy with retry
        for attempt in range(2):
            try:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                conn.request("GET", target)
                resp = conn.getresponse()
                body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(key, val)
                self.send_header("Content-Length", len(body))
                self.end_headers()
                self._write(body)
                conn.close()
                return
            except ConnectionRefusedError:
                if attempt == 0:
                    time.sleep(0.5)
            except Exception:
                break
        self.send_error(502)

    def _proxy_websocket(self, port, path, window_index=None):
        """Proxy WebSocket connection to local ttyd."""
        for attempt in range(3):
            try:
                backend = socket.create_connection(("127.0.0.1", port), timeout=5)
                break
            except ConnectionRefusedError:
                if attempt < 2:
                    time.sleep(0.5)
                else:
                    self.send_error(502)
                    return

        lines = [f"GET {path} HTTP/1.1", f"Host: 127.0.0.1:{port}"]
        for key, val in self.headers.items():
            if key.lower() != "host":
                lines.append(f"{key}: {val}")
        lines.extend(["", ""])
        backend.sendall("\r\n".join(lines).encode())

        response = b""
        while b"\r\n\r\n" not in response:
            chunk = backend.recv(4096)
            if not chunk:
                backend.close()
                self.send_error(502)
                return
            response += chunk

        try:
            self.request.sendall(response)
        except Exception:
            backend.close()
            return

        header_end = response.index(b"\r\n\r\n") + 4
        extra = response[header_end:]
        if extra:
            try:
                self.request.sendall(extra)
            except Exception:
                backend.close()
                return

        # Ensure no timeouts on relay sockets
        backend.settimeout(None)
        try:
            self.request.settimeout(None)
        except Exception:
            pass

        closed = threading.Event()
        last_keepalive = [time.time()]

        def relay(src, dst):
            try:
                while not closed.is_set():
                    try:
                        data = src.recv(65536)
                    except (ssl.SSLWantReadError, ssl.SSLWantWriteError):
                        continue
                    except (ssl.SSLEOFError, ssl.SSLZeroReturnError):
                        break
                    if not data:
                        break
                    try:
                        dst.sendall(data)
                    except (ssl.SSLWantWriteError,):
                        continue
                    # Periodic keepalive update (not every packet)
                    now = time.time()
                    if window_index is not None and now - last_keepalive[0] > 30:
                        last_keepalive[0] = now
                        with ttyd_lock:
                            if window_index in ttyd_procs:
                                ttyd_procs[window_index]["last_access"] = now
            except (ConnectionResetError, BrokenPipeError, OSError):
                pass
            except Exception:
                pass
            finally:
                closed.set()

        t1 = threading.Thread(target=relay, args=(self.request, backend), daemon=True)
        t2 = threading.Thread(target=relay, args=(backend, self.request), daemon=True)
        t1.start()
        t2.start()
        closed.wait()
        try:
            backend.close()
        except Exception:
            pass

    def _proxy_preview(self):
        """Reverse-proxy HTTP and WebSocket requests to a local dev server."""
        parsed = urlparse(self.path)
        path = parsed.path
        # /preview/{port}/...
        parts = path.split("/", 3)
        try:
            port = int(parts[2])
        except (IndexError, ValueError):
            self.send_error(400, "Invalid preview port")
            return

        if port < 1024 or port > 65535:
            self.send_error(400, "Port out of range (1024-65535)")
            return

        # Rewrite path: strip /preview/{port} prefix
        remainder = "/" + parts[3] if len(parts) > 3 else "/"
        target = remainder
        if parsed.query:
            target += "?" + parsed.query

        if self.headers.get("Upgrade", "").lower() == "websocket":
            self._proxy_websocket(port, target)
            return

        # HTTP proxy
        try:
            method = self.command
            body = None
            length = int(self.headers.get("Content-Length", 0))
            if length > 0:
                body = self.rfile.read(length)

            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
            headers = {}
            for key, val in self.headers.items():
                if key.lower() not in ("host", "connection"):
                    headers[key] = val
            headers["Host"] = f"127.0.0.1:{port}"
            conn.request(method, target, body=body, headers=headers)
            resp = conn.getresponse()
            resp_body = resp.read()

            self.send_response(resp.status)
            for key, val in resp.getheaders():
                if key.lower() not in ("transfer-encoding", "connection", "x-frame-options",
                                       "content-security-policy"):
                    self.send_header(key, val)
            self.send_header("Content-Length", len(resp_body))
            self.end_headers()
            self._write(resp_body)
            conn.close()
        except ConnectionRefusedError:
            self.send_error(502, f"Cannot connect to localhost:{port}")
        except Exception as e:
            self.send_error(502, str(e))

    def _proxy_preview_asset(self, port):
        """Proxy an asset request to a local dev server (Referer-based routing)."""
        parsed = urlparse(self.path)
        target = parsed.path
        if parsed.query:
            target += "?" + parsed.query

        if self.headers.get("Upgrade", "").lower() == "websocket":
            self._proxy_websocket(port, target)
            return

        try:
            method = self.command
            body = None
            length = int(self.headers.get("Content-Length", 0))
            if length > 0:
                body = self.rfile.read(length)

            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
            headers = {}
            for key, val in self.headers.items():
                if key.lower() not in ("host", "connection"):
                    headers[key] = val
            headers["Host"] = f"127.0.0.1:{port}"
            conn.request(method, target, body=body, headers=headers)
            resp = conn.getresponse()
            resp_body = resp.read()

            self.send_response(resp.status)
            for key, val in resp.getheaders():
                if key.lower() not in ("transfer-encoding", "connection", "x-frame-options",
                                       "content-security-policy"):
                    self.send_header(key, val)
            self.send_header("Content-Length", len(resp_body))
            self.end_headers()
            self._write(resp_body)
            conn.close()
        except ConnectionRefusedError:
            self.send_error(502, f"Cannot connect to localhost:{port}")
        except Exception:
            self.send_error(502)

    def _write(self, data):
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            pass

    def _handle_other_method(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/preview/"):
            self._proxy_preview()
        else:
            preview_port = self._get_preview_port_from_referer()
            if preview_port:
                self._proxy_preview_asset(preview_port)
            else:
                self.send_error(404)

    do_PUT = _handle_other_method
    do_DELETE = _handle_other_method
    do_PATCH = _handle_other_method
    do_OPTIONS = _handle_other_method

    def log_message(self, format, *args):
        pass


def ensure_certs():
    """Generate self-signed certificate if not present."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file = CERT_DIR / "cert.pem"
    key_file = CERT_DIR / "key.pem"
    if cert_file.exists() and key_file.exists():
        return str(cert_file), str(key_file)
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048",
         "-keyout", str(key_file), "-out", str(cert_file),
         "-days", "365", "-nodes", "-subj", "/CN=remotty"],
        capture_output=True, check=True,
    )
    return str(cert_file), str(key_file)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--https", action="store_true")
    args = parser.parse_args()

    reaper = threading.Thread(target=ttyd_reaper, daemon=True)
    reaper.start()

    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    if args.https:
        cert, key = ensure_certs()
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)

    scheme = "https" if args.https else "http"
    print(f"remotty running on {scheme}://0.0.0.0:{PORT}")

    try:
        ts_ip = subprocess.run(
            ["tailscale", "ip", "-4"], capture_output=True, text=True
        ).stdout.strip()
        if ts_ip:
            print(f"Mobile access: {scheme}://{ts_ip}:{PORT}")
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
