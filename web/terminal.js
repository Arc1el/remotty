// Apply saved theme
document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "light");

const params = new URLSearchParams(location.search);
let windowIndex = params.get("window");

if (!windowIndex) {
  location.href = "/";
}

// Preview state
let previewPorts = JSON.parse(localStorage.getItem("preview-ports") || "[]");
let activePreviewPort = null;

function savePreviewPorts() {
  localStorage.setItem("preview-ports", JSON.stringify(previewPorts));
}

// Session bar
const sessionBar = document.getElementById("session-bar");

async function loadSessions() {
  try {
    const res = await fetch("/api/sessions");
    const sessions = await res.json();
    sessionBar.innerHTML = "";
    sessions.forEach(s => {
      const tab = document.createElement("button");
      tab.className = "session-tab" + (s.index == windowIndex ? " active" : "");
      tab.textContent = s.name || `window ${s.index}`;
      tab.title = "길게 눌러서 이름 변경";

      // Tap = switch, long press = rename
      let lpTimer = null;
      let didLP = false;
      tab.addEventListener("touchstart", (e) => {
        e.preventDefault();
        didLP = false;
        lpTimer = setTimeout(() => { didLP = true; renameSession(s.index, s.name); }, 500);
      });
      tab.addEventListener("touchend", (e) => {
        e.preventDefault();
        clearTimeout(lpTimer);
        if (!didLP) switchSession(s.index);
      });
      tab.addEventListener("touchmove", () => clearTimeout(lpTimer));
      tab.addEventListener("mousedown", () => {
        didLP = false;
        lpTimer = setTimeout(() => { didLP = true; renameSession(s.index, s.name); }, 500);
      });
      tab.addEventListener("mouseup", () => {
        clearTimeout(lpTimer);
        if (!didLP) switchSession(s.index);
      });

      sessionBar.appendChild(tab);
    });

    // Preview tabs
    previewPorts.forEach(port => {
      const tab = document.createElement("button");
      tab.className = "session-tab preview-tab" + (activePreviewPort === port ? " active" : "");
      tab.innerHTML = `:${port} <span class="preview-close" data-port="${port}">&times;</span>`;

      tab.addEventListener("click", (e) => {
        if (e.target.classList.contains("preview-close")) {
          removePreview(parseInt(e.target.dataset.port));
          return;
        }
        showPreview(port);
      });
      tab.addEventListener("touchend", (e) => {
        if (e.target.classList.contains("preview-close")) {
          e.preventDefault();
          removePreview(parseInt(e.target.dataset.port));
          return;
        }
      });

      sessionBar.appendChild(tab);
    });

    // File viewer tabs
    viewerFiles.forEach(filePath => {
      const tab = document.createElement("button");
      const fileName = filePath.split("/").pop();
      tab.className = "session-tab file-tab" + (activeViewerFile === filePath ? " active" : "");
      tab.innerHTML = `${fileName} <span class="preview-close file-close" data-file="${filePath}">&times;</span>`;
      tab.title = filePath;

      tab.addEventListener("click", (e) => {
        if (e.target.classList.contains("file-close")) {
          removeFileView(e.target.dataset.file);
          return;
        }
        showFileView(filePath);
      });
      tab.addEventListener("touchend", (e) => {
        if (e.target.classList.contains("file-close")) {
          e.preventDefault();
          removeFileView(e.target.dataset.file);
          return;
        }
      });

      sessionBar.appendChild(tab);
    });

    // Add preview button
    const addBtn = document.createElement("button");
    addBtn.id = "add-preview-btn";
    addBtn.textContent = "+Preview";
    addBtn.addEventListener("click", addPreview);
    sessionBar.appendChild(addBtn);

    // Add file viewer button
    const fileBtn = document.createElement("button");
    fileBtn.id = "add-file-btn";
    fileBtn.textContent = "+File";
    fileBtn.addEventListener("click", addFileView);
    sessionBar.appendChild(fileBtn);

    // Hint
    const hint = document.createElement("span");
    hint.id = "session-bar-hint";
    hint.textContent = "길게 눌러 이름 변경";
    sessionBar.appendChild(hint);
  } catch (e) {}
}

async function renameSession(idx, currentName) {
  const name = prompt("세션 이름 변경", currentName || "");
  if (name === null || name.trim() === "") return;
  await fetch(`/api/rename-window/${idx}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  loadSessions();
}

function switchSession(idx) {
  activePreviewPort = null;
  activeViewerFile = null;
  document.body.classList.remove("preview-mode");
  if (idx == windowIndex) { loadSessions(); return; }
  windowIndex = idx;
  history.replaceState(null, "", `?window=${idx}`);
  loadTerminal();
  loadSessions();
}

// Intercept localhost/127.0.0.1 URLs and open as preview
function interceptLocalhost(url) {
  try {
    const u = new URL(url, location.href);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      const port = parseInt(u.port) || (u.protocol === "https:" ? 443 : 80);
      if (port >= 1024 && port <= 65535) {
        if (!previewPorts.includes(port)) {
          previewPorts.push(port);
          savePreviewPorts();
        }
        showPreview(port, u.pathname + u.search);
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// Install link interceptor in ttyd iframe
const LOCALHOST_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)(\/\S*)?/g;
const FILE_RE = /(?:~\/|\.\/|\.\.\/|\/)?[^\s:*?"<>|]*[^\s:*?"<>|/]\.(?:md|markdown|txt|rst|org|adoc)\b/g;

function installLinkInterceptor(frame) {
  try {
    const w = frame.contentWindow;
    if (!w || w._remottyHooked) return;

    const nativeOpen = w.open;

    // Fake window object for xterm's open() → location.href pattern
    function makeFakePopup() {
      return {
        get opener() { return null; },
        set opener(v) {},
        close() {},
        get location() {
          return {
            get href() { return ""; },
            set href(url) {
              if (typeof url === "string" && interceptLocalhost(url)) return;
              // Not localhost — actually open it
              const real = nativeOpen.call(w, url);
              if (real) { try { real.opener = null; } catch(e) {} }
            }
          };
        },
        set location(url) {
          if (typeof url === "string" && interceptLocalhost(url)) return;
          nativeOpen.call(w, url);
        }
      };
    }

    function proxyOpen(url, target, features) {
      // Direct URL open
      if (url && url !== "" && url !== "about:blank") {
        if (interceptLocalhost(String(url))) return null;
        return nativeOpen.call(w, url, target, features);
      }
      // Blank open (xterm pattern) → return fake to intercept location.href
      return makeFakePopup();
    }

    // Use defineProperty so ttyd/xterm can't overwrite our override
    Object.defineProperty(w, "open", {
      configurable: true,
      enumerable: true,
      get() { return proxyOpen; },
      set() {} // block overwrites
    });

    // Register custom link provider for click-without-modifier
    function tryRegisterLinkProvider() {
      // Find xterm terminal instance - try multiple locations
      let term = w.term || w.terminal;

      // Search window properties
      if (!term) {
        for (const key of Object.getOwnPropertyNames(w)) {
          try {
            const val = w[key];
            if (val && typeof val === "object" && typeof val.registerLinkProvider === "function") {
              term = val; break;
            }
            // Check nested .terminal property (ttyd stores it in a wrapper)
            if (val && typeof val === "object" && val.terminal && typeof val.terminal.registerLinkProvider === "function") {
              term = val.terminal; break;
            }
          } catch(e) {}
        }
      }

      // Search via DOM element
      if (!term) {
        const xtermEl = w.document.querySelector(".xterm");
        if (xtermEl) {
          for (const key of Object.getOwnPropertyNames(xtermEl)) {
            try {
              const val = xtermEl[key];
              if (val && typeof val === "object" && typeof val.registerLinkProvider === "function") {
                term = val; break;
              }
            } catch(e) {}
          }
        }
      }

      console.log("[remotty] terminal instance search:", term ? "FOUND" : "NOT FOUND");
      if (term && term.registerLinkProvider && !term._remottyProvider) {
        term._remottyProvider = true;

        // Keep built-in WebLinksAddon (it has correct underline rendering).
        // URL clicks are intercepted via window.open proxy above.
        // Only add a custom provider for file paths (.md, .txt, etc.)
        term.registerLinkProvider({
          provideLinks(y, callback) {
            try {
              const line = term.buffer.active.getLine(y);
              if (!line) { callback([]); return; }
              let text = "";
              for (let i = 0; i < line.length; i++) {
                text += line.getCell(i)?.getChars() || " ";
              }
              const links = [];
              let m;
              FILE_RE.lastIndex = 0;
              while ((m = FILE_RE.exec(text)) !== null) {
                const matchPath = m[0];
                links.push({
                  range: { start: { x: m.index + 1, y }, end: { x: m.index + matchPath.length, y } },
                  text: matchPath,
                  activate() {
                    console.log("[remotty] file link clicked:", matchPath);
                    window.parent.postMessage({ type: "remotty-file", path: matchPath }, "*");
                  }
                });
              }
              if (links.length) console.log("[remotty] file links found:", links.map(l => l.text));
              callback(links);
            } catch(e) { callback([]); }
          }
        });
        return true;
      }
      return false;
    }

    // Retry link provider registration (xterm loads async)
    if (!tryRegisterLinkProvider()) {
      let attempts = 0;
      const timer = setInterval(() => {
        if (tryRegisterLinkProvider() || ++attempts > 20) clearInterval(timer);
      }, 500);
    }

    // Hide overview ruler decorations
    try {
      const style = w.document.createElement("style");
      style.textContent = `.xterm-decoration-overview-ruler { display: none !important; }`;
      w.document.head.appendChild(style);
    } catch(e) {}

    w._remottyHooked = true;
  } catch(e) {}
}

// Listen for postMessage from iframe link provider
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "remotty-preview" && e.data.url) {
    interceptLocalhost(e.data.url);
  }
  if (e.data && e.data.type === "remotty-file" && e.data.path) {
    const filePath = e.data.path;
    if (!viewerFiles.includes(filePath)) {
      viewerFiles.push(filePath);
      saveViewerFiles();
    }
    showFileView(filePath);
  }
});

// File viewer functions
let viewerFiles = JSON.parse(localStorage.getItem("viewer-files") || "[]");
let activeViewerFile = null;

function saveViewerFiles() {
  localStorage.setItem("viewer-files", JSON.stringify(viewerFiles));
}

function addFileView() {
  const input = prompt("File path (e.g. ~/project/README.md)");
  if (!input) return;
  const filePath = input.trim();
  if (!filePath) return;
  if (!viewerFiles.includes(filePath)) {
    viewerFiles.push(filePath);
    saveViewerFiles();
  }
  showFileView(filePath);
}

function removeFileView(filePath) {
  viewerFiles = viewerFiles.filter(f => f !== filePath);
  saveViewerFiles();
  if (activeViewerFile === filePath) {
    activeViewerFile = null;
    document.body.classList.remove("preview-mode");
  }
  loadSessions();
}

function showFileView(filePath) {
  activeViewerFile = filePath;
  activePreviewPort = null;
  document.body.classList.add("preview-mode");
  const frame = document.getElementById("preview-frame");
  frame.src = `/viewer.html?path=${encodeURIComponent(filePath)}`;
  const pathInput = document.getElementById("preview-path");
  const extLink = document.getElementById("preview-open-external");
  pathInput.value = filePath;
  extLink.href = `/viewer.html?path=${encodeURIComponent(filePath)}`;
  loadSessions();
}

// Preview functions
function addPreview() {
  const input = prompt("Dev server port number (e.g. 3000, 5173)");
  if (!input) return;
  const port = parseInt(input.trim());
  if (isNaN(port) || port < 1024 || port > 65535) {
    alert("Port must be between 1024 and 65535");
    return;
  }
  if (!previewPorts.includes(port)) {
    previewPorts.push(port);
    savePreviewPorts();
  }
  showPreview(port);
}

function removePreview(port) {
  previewPorts = previewPorts.filter(p => p !== port);
  savePreviewPorts();
  if (activePreviewPort === port) {
    activePreviewPort = null;
    document.body.classList.remove("preview-mode");
  }
  loadSessions();
}

let previewPath = "/";

function showPreview(port, path) {
  activePreviewPort = port;
  previewPath = path || "/";
  document.body.classList.add("preview-mode");
  navigatePreview();
  loadSessions();
}

function navigatePreview() {
  const frame = document.getElementById("preview-frame");
  const pathInput = document.getElementById("preview-path");
  const extLink = document.getElementById("preview-open-external");

  // Ensure path starts with /
  if (!previewPath.startsWith("/")) previewPath = "/" + previewPath;

  const proxyUrl = `/preview/${activePreviewPort}${previewPath}`;
  frame.src = proxyUrl;
  pathInput.value = `localhost:${activePreviewPort}${previewPath}`;
  const directUrl = `${location.protocol}//${location.hostname}:${activePreviewPort}${previewPath}`;
  extLink.href = directUrl;
}

function goToPreviewPath() {
  const pathInput = document.getElementById("preview-path");
  let val = pathInput.value.trim();
  // Strip "localhost:PORT" prefix if present
  val = val.replace(/^(https?:\/\/)?[^/]*/, "");
  previewPath = val || "/";
  navigatePreview();
}

// Preview toolbar: go button
document.getElementById("preview-go").addEventListener("click", goToPreviewPath);

// Enter key in path input
document.getElementById("preview-path").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    goToPreviewPath();
  }
});

// Preview toolbar: refresh
document.getElementById("preview-refresh").addEventListener("click", () => {
  if (activePreviewPort) {
    navigatePreview();
  }
});

// Load terminal iframe
async function loadTerminal() {
  const res = await fetch(`/api/terminal/${windowIndex}`);
  if (!res.ok) {
    alert("Failed to start terminal");
    location.href = "/";
    return;
  }
  const data = await res.json();
  const frame = document.getElementById("term-frame");
  frame.src = data.url;
  // Hook window.open ASAP — poll before load event fires
  const earlyHook = setInterval(() => {
    try { if (frame.contentWindow) installLinkInterceptor(frame); } catch(e) {}
  }, 100);
  setTimeout(() => clearInterval(earlyHook), 10000);
  frame.addEventListener("load", () => {
    clearInterval(earlyHook);
    try {
      const w = frame.contentWindow;
      // Suppress "leave site?" dialog
      w.onbeforeunload = null;
      w.addEventListener("beforeunload", (e) => {
        e.stopImmediatePropagation();
      }, true);
      setTimeout(() => { w.onbeforeunload = null; }, 2000);
      // Prevent mobile keyboard from auto-appearing
      w.document.activeElement?.blur();
      setTimeout(() => { w.document.activeElement?.blur(); }, 500);
    } catch (e) {}
    installLinkInterceptor(frame);
  });
}

// Shift state
let shiftActive = false;
const shiftBtn = document.getElementById("shift-btn");

function sendKey(key) {
  fetch(`/api/send-keys/${windowIndex}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

// Quick commands
function addTouchClick(id, fn) {
  const el = document.getElementById(id);
  let touched = false;
  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touched = true;
    fn();
  });
  el.addEventListener("click", (e) => {
    e.preventDefault();
    if (!touched) fn();
    touched = false;
  });
}

addTouchClick("btn-claude", () => sendText("claude"));
addTouchClick("btn-exit", () => sendText("exit"));
addTouchClick("btn-back", () => { location.href = "/"; });

function sendText(text) {
  fetch(`/api/send-text/${windowIndex}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

// Button handler
function handleKey(btn, e) {
  e.preventDefault();
  e.stopPropagation();
  const key = btn.dataset.key;
  if (!key) return;

  if (key === "Shift") {
    shiftActive = !shiftActive;
    shiftBtn.classList.toggle("active", shiftActive);
    return;
  }

  if (shiftActive) {
    sendKey("S-" + key);
    shiftActive = false;
    shiftBtn.classList.remove("active");
  } else {
    sendKey(key);
  }
}

// Use both touchstart and click for reliability
document.querySelectorAll(".key-btn").forEach(btn => {
  let touched = false;
  btn.addEventListener("touchstart", (e) => {
    touched = true;
    handleKey(btn, e);
  });
  btn.addEventListener("click", (e) => {
    if (!touched) handleKey(btn, e);
    touched = false;
  });
});

// Scroll mode
const scrollToggle = document.getElementById("scroll-toggle");
const scrollOverlay = document.getElementById("scroll-overlay");
let scrollMode = false;

let scrollTouched = false;
scrollToggle.addEventListener("touchstart", (e) => {
  e.preventDefault();
  scrollTouched = true;
  toggleScrollMode();
});
scrollToggle.addEventListener("click", (e) => {
  e.preventDefault();
  if (!scrollTouched) toggleScrollMode();
  scrollTouched = false;
});

function toggleScrollMode() {
  scrollMode = !scrollMode;
  scrollToggle.classList.toggle("active", scrollMode);
  scrollOverlay.classList.toggle("active", scrollMode);
  // Exit tmux copy mode when turning off scroll
  if (!scrollMode) {
    sendKey("Escape");
  }
}

// Scroll overlay: swipe to scroll tmux
let scrollY = 0;
scrollOverlay.addEventListener("touchstart", (e) => {
  e.preventDefault();
  scrollY = e.touches[0].clientY;
});

function sendScroll(direction) {
  fetch(`/api/scroll/${windowIndex}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
}

scrollOverlay.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const dy = scrollY - e.touches[0].clientY;
  const threshold = 30;
  if (Math.abs(dy) > threshold) {
    sendScroll(dy > 0 ? "up" : "down");
    scrollY = e.touches[0].clientY;
  }
});

// Mouse scroll on overlay
scrollOverlay.addEventListener("wheel", (e) => {
  e.preventDefault();
  sendScroll(e.deltaY < 0 ? "up" : "down");
});


// ─── Full Voice Mode ───
// Unified mode: short utterances (1-2 words) → keyword command, longer → auto-send as text
const voicecmdToggle = document.getElementById("voicecmd-toggle");
const voicecmdOverlay = document.getElementById("voicecmd-overlay");
let voicecmdMode = false;
let voicecmdRecognition = null;
let voicecmdDebounce = null;
let voicecmdCountdown = null;
let voicecmdAccum = ""; // accumulated transcript for current utterance
const VOICECMD_SEND_DELAY = 3000; // ms before auto-send

// Keyword maps
const ENTER_KEYWORDS = [
  // Korean
  "다음", "확인", "오케이", "알겠어", "네", "응", "좋아", "진행", "계속", "고", "ㅇㅋ",
  "실행", "엔터", "맞아", "그래", "넘어가", "됐어",
  // English
  "next", "ok", "okay", "yes", "confirm", "continue", "go", "enter",
  "proceed", "sure", "yeah", "yep", "right", "done",
];
const CANCEL_KEYWORDS = [
  // Korean
  "취소", "안돼", "중지", "멈춰", "아니", "아니야", "그만", "스톱", "빠져나가", "정지",
  // English
  "cancel", "stop", "no", "abort", "quit", "exit", "nope", "don't", "halt",
];

function normalizeText(text) {
  return text.toLowerCase().replace(/[.,!?;:'"]/g, "").trim();
}

function matchKeyword(text) {
  const normalized = normalizeText(text);
  for (const kw of ENTER_KEYWORDS) {
    if (normalized === kw || normalized.endsWith(kw)) return "enter";
  }
  for (const kw of CANCEL_KEYWORDS) {
    if (normalized === kw || normalized.endsWith(kw)) return "cancel";
  }
  return null;
}

function wordCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Korean: count characters as ~1 word per 2 chars, English: split by space
  const spaceWords = trimmed.split(/\s+/).length;
  return spaceWords;
}

// Voice command toast
const voicecmdToast = document.getElementById("voicecmd-toast");
let voicecmdToastTimer = null;

function showVoiceCmdToast(spoken, keyLabel) {
  clearTimeout(voicecmdToastTimer);
  voicecmdToast.classList.remove("show");
  voicecmdToast.innerHTML = `<span class="toast-label">${spoken}</span><span class="toast-key">${keyLabel}</span>`;
  void voicecmdToast.offsetWidth;
  voicecmdToast.classList.add("show");
  voicecmdToastTimer = setTimeout(() => {
    voicecmdToast.classList.remove("show");
  }, 1200);
}

let voicecmdTouched = false;
voicecmdToggle.addEventListener("touchstart", (e) => {
  e.preventDefault();
  voicecmdTouched = true;
  toggleVoiceCmd();
});
voicecmdToggle.addEventListener("click", (e) => {
  e.preventDefault();
  if (!voicecmdTouched) toggleVoiceCmd();
  voicecmdTouched = false;
});

function toggleVoiceCmd() {
  voicecmdMode = !voicecmdMode;
  voicecmdToggle.classList.toggle("active", voicecmdMode);
  voicecmdOverlay.classList.toggle("active", voicecmdMode);
  voiceBar.classList.add("voice-hidden");

  if (voicecmdMode) {
    startVoiceCmd();
  } else {
    stopVoiceCmd();
  }
}

function startVoiceCmd() {
  if (!SpeechRecognition) {
    alert("This browser does not support speech recognition.");
    voicecmdMode = false;
    voicecmdToggle.classList.remove("active");
    voicecmdOverlay.classList.remove("active");
    return;
  }

  voicecmdRecognition = new SpeechRecognition();
  voicecmdRecognition.lang = langs[langIndex].code;
  voicecmdRecognition.interimResults = true;
  voicecmdRecognition.continuous = true;

  voicecmdAccum = "";

  voicecmdRecognition.onresult = (event) => {
    // Build full transcript from all results
    let fullText = "";
    for (let i = 0; i < event.results.length; i++) {
      fullText += event.results[i][0].transcript;
    }
    voicecmdAccum = fullText.trim();

    // Show voice bar when it looks like a longer input (3+ words)
    if (wordCount(voicecmdAccum) >= 3) {
      voiceBar.classList.remove("voice-hidden");
      voiceText.textContent = voicecmdAccum;
      voiceText.style.color = "";
    }

    // Reset debounce + countdown on every result
    clearTimeout(voicecmdDebounce);
    clearInterval(voicecmdCountdown);
    hideVoiceCmdTimer();

    voicecmdDebounce = setTimeout(() => {
      processVoiceCmdResult();
    }, VOICECMD_SEND_DELAY);

    // Start countdown indicator if long enough to send
    if (wordCount(voicecmdAccum) >= 3) {
      startVoiceCmdTimer(VOICECMD_SEND_DELAY);
    }
  };

  voicecmdRecognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      voicecmdMode = false;
      voicecmdToggle.classList.remove("active");
      voicecmdOverlay.classList.remove("active");
    }
  };

  voicecmdRecognition.onend = () => {
    // Process any pending text before restart
    if (voicecmdAccum.trim()) {
      clearTimeout(voicecmdDebounce);
      processVoiceCmdResult();
    }
    // Auto-restart if still in voice command mode
    if (voicecmdMode) {
      try {
        voicecmdRecognition = new SpeechRecognition();
        voicecmdRecognition.lang = langs[langIndex].code;
        voicecmdRecognition.interimResults = true;
        voicecmdRecognition.continuous = true;
        voicecmdRecognition.onresult = arguments.callee.caller?.arguments?.[0]?.target?.onresult;
        // Re-bind handlers
        startVoiceCmd();
      } catch(e) {}
    }
  };

  voicecmdRecognition.start();
}

// Voice timer indicator
const voiceTimerEl = document.getElementById("voice-timer");
const voiceTimerText = document.getElementById("voice-timer-text");
const voiceTimerBar = document.getElementById("voice-timer-bar");

function startVoiceCmdTimer(duration) {
  voiceTimerEl.classList.remove("voice-timer-hidden");
  const start = Date.now();
  const totalSec = Math.ceil(duration / 1000);
  voiceTimerText.textContent = totalSec;
  voiceTimerBar.style.setProperty("--timer-progress", "100%");

  voicecmdCountdown = setInterval(() => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, duration - elapsed);
    const sec = Math.ceil(remaining / 1000);
    voiceTimerText.textContent = sec;
    voiceTimerBar.style.setProperty("--timer-progress", (remaining / duration * 100) + "%");
    if (remaining <= 0) {
      clearInterval(voicecmdCountdown);
    }
  }, 100);
}

function hideVoiceCmdTimer() {
  clearInterval(voicecmdCountdown);
  voiceTimerEl.classList.add("voice-timer-hidden");
}

function processVoiceCmdResult() {
  hideVoiceCmdTimer();
  const text = voicecmdAccum.trim();
  voicecmdAccum = "";
  if (!text) return;

  const wc = wordCount(text);

  if (wc <= 2) {
    // Short utterance → try keyword match
    const action = matchKeyword(text);
    if (action === "enter") {
      showVoiceCmdToast(text, "Enter ↵");
      sendKey("Enter");
    } else if (action === "cancel") {
      showVoiceCmdToast(text, "Ctrl+C ✕");
      sendKey("C-c");
    } else {
      // Short but not a keyword → ignore
      showVoiceCmdToast(text, "—");
    }
  } else {
    // Long utterance → send as text
    showVoiceCmdToast(text, "Send ↵");
    sendText(text);
  }

  // Hide voice bar and restart recognition
  voiceBar.classList.add("voice-hidden");
  voiceText.textContent = "";

  // Restart recognition for next utterance
  if (voicecmdMode && voicecmdRecognition) {
    try {
      voicecmdRecognition.abort();
    } catch(e) {}
    voicecmdRecognition = null;
    startVoiceCmd();
  }
}

function stopVoiceCmd() {
  clearTimeout(voicecmdDebounce);
  hideVoiceCmdTimer();
  voicecmdAccum = "";
  voicecmdMode = false;
  voiceBar.classList.add("voice-hidden");
  voiceText.textContent = "";
  if (voicecmdRecognition) {
    voicecmdRecognition.onend = null;
    voicecmdRecognition.abort();
    voicecmdRecognition = null;
  }
}

// Voice recognition (STT text input)
const micBtn = document.getElementById("mic-btn");
const voiceLang = document.getElementById("voice-lang");
const voiceBar = document.getElementById("voice-bar");
const voiceText = document.getElementById("voice-text");
const voiceSendBtn = document.getElementById("voice-send");
const voiceCancelBtn = document.getElementById("voice-cancel");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

const langs = [
  { code: "en-US", label: "EN" },
  { code: "ko-KR", label: "한" },
];
let langIndex = parseInt(localStorage.getItem("voice-lang") || "0");
voiceLang.textContent = langs[langIndex].label;

function toggleLang() {
  langIndex = (langIndex + 1) % langs.length;
  voiceLang.textContent = langs[langIndex].label;
  localStorage.setItem("voice-lang", langIndex);
}

function positionVoiceBar() {
  const controlsEl = document.getElementById("controls");
  if (controlsEl) {
    voiceBar.style.bottom = controlsEl.offsetHeight + "px";
  }
}

// Mic button: tap = record
addTouchClick("mic-btn", () => {
  if (isRecording) stopVoice();
  else startVoice();
});

// Lang button in voice bar: tap = toggle language
addTouchClick("voice-lang", toggleLang);

function startVoice() {
  if (!SpeechRecognition) {
    alert("This browser does not support speech recognition.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = langs[langIndex].code;
  recognition.interimResults = true;
  recognition.continuous = false;

  isRecording = true;
  micBtn.classList.add("recording");
  voiceBar.classList.remove("voice-hidden");
  positionVoiceBar();
  voiceText.textContent = "";
  voiceText.style.color = "";

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    voiceText.textContent = result[0].transcript;
  };

  recognition.onerror = (event) => {
    if (event.error !== "aborted") {
      voiceText.textContent = `Error: ${event.error}`;
      voiceText.style.color = "var(--red)";
      console.error("Speech recognition error:", event.error);
    } else {
      stopVoice();
    }
  };

  recognition.onend = () => {
    // If no result was captured, show hint
    if (isRecording && !voiceText.textContent) {
      voiceText.textContent = "No speech detected. Try again.";
      voiceText.style.color = "var(--text-dim)";
    }
    isRecording = false;
    micBtn.classList.remove("recording");
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) {
    recognition.abort();
    recognition = null;
  }
  isRecording = false;
  micBtn.classList.remove("recording");
}

function sendVoiceText() {
  const text = voiceText.textContent.trim();
  stopVoice();
  voiceBar.classList.add("voice-hidden");
  if (text) sendText(text);
}

function cancelVoice() {
  stopVoice();
  voiceBar.classList.add("voice-hidden");
  voiceText.textContent = "";
}

addTouchClick("voice-send", sendVoiceText);
addTouchClick("voice-cancel", cancelVoice);

// Resize handle for wide layout
const handle = document.getElementById("resize-handle");
const controls = document.getElementById("controls");

if (handle && controls) {
  let dragging = false;

  function onDragStart(e) {
    dragging = true;
    document.body.classList.add("resizing");
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const isLeft = document.body.classList.contains("controls-left");
    const newWidth = isLeft
      ? clientX - handle.offsetWidth
      : window.innerWidth - clientX - handle.offsetWidth;
    const clamped = Math.max(80, Math.min(newWidth, window.innerWidth * 0.4));
    controls.style.width = clamped + "px";
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("resizing");
  }

  handle.addEventListener("mousedown", onDragStart);
  handle.addEventListener("touchstart", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("touchmove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
  document.addEventListener("touchend", onDragEnd);
}

// Side toggle with animation
function toggleSide() {
  const goingLeft = !document.body.classList.contains("controls-left");
  document.body.classList.remove("slide-to-left", "slide-to-right");
  document.body.classList.toggle("controls-left");
  // Force reflow so animation restarts
  void document.body.offsetWidth;
  document.body.classList.add(goingLeft ? "slide-to-left" : "slide-to-right");
  localStorage.setItem("controls-side", goingLeft ? "left" : "right");
}

// Restore saved side preference
if (localStorage.getItem("controls-side") === "left") {
  document.body.classList.add("controls-left");
}

// Suppress "leave site?" dialogs from ttyd iframe
window.addEventListener("beforeunload", (e) => {
  e.stopImmediatePropagation();
}, true);


// Place mic-wrap in correct slot based on screen width
function placeMic() {
  const mic = document.getElementById("mic-btn");
  if (!mic) return;
  const wide = window.matchMedia("(min-width: 580px)").matches;
  const target = document.getElementById(wide ? "mic-wide" : "mic-narrow");
  if (target && mic.parentElement !== target) {
    target.appendChild(mic);
  }
}
placeMic();
window.addEventListener("resize", placeMic);

loadTerminal();
loadSessions();
