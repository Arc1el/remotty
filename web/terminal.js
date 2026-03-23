// Apply saved theme
document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");

const params = new URLSearchParams(location.search);
let windowIndex = params.get("window");

if (!windowIndex) {
  location.href = "/";
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
  if (idx == windowIndex) return;
  windowIndex = idx;
  history.replaceState(null, "", `?window=${idx}`);
  loadTerminal();
  loadSessions();
}

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
  frame.addEventListener("load", () => {
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


// Voice recognition
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
  voiceText.textContent = "";

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    voiceText.textContent = result[0].transcript;
  };

  recognition.onerror = (event) => {
    if (event.error !== "aborted") {
      console.error("Speech recognition error:", event.error);
    }
    stopVoice();
  };

  recognition.onend = () => {
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
