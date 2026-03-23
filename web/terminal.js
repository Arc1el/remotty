const params = new URLSearchParams(location.search);
const windowIndex = params.get("window");

if (!windowIndex) {
  location.href = "/";
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
  document.getElementById("term-frame").src = data.url;
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
const micBtn = document.getElementById("btn-mic");
const voiceStatus = document.getElementById("voice-status");
const voiceText = document.getElementById("voice-text");
const voiceSend = document.getElementById("voice-send");
const voiceCancel = document.getElementById("voice-cancel");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

function startVoice() {
  if (!SpeechRecognition) {
    alert("This browser does not support speech recognition.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  isRecording = true;
  micBtn.classList.add("recording");
  voiceStatus.classList.remove("voice-hidden");
  voiceText.textContent = "";

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    voiceText.textContent = final || interim;
  };

  recognition.onerror = (event) => {
    if (event.error !== "aborted") {
      console.error("Speech recognition error:", event.error);
    }
    stopVoice();
  };

  recognition.onend = () => {
    if (isRecording) {
      // Auto-stopped by browser, keep UI state
      isRecording = false;
      micBtn.classList.remove("recording");
    }
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
  voiceStatus.classList.add("voice-hidden");
  if (text) {
    sendText(text);
  }
}

function cancelVoice() {
  stopVoice();
  voiceStatus.classList.add("voice-hidden");
  voiceText.textContent = "";
}

addTouchClick("btn-mic", () => {
  if (isRecording) {
    stopVoice();
  } else {
    startVoice();
  }
});

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

loadTerminal();
