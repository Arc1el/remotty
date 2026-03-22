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

// Send key via API
function sendKey(key) {
  fetch(`/api/send-keys/${windowIndex}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

// Button clicks
document.querySelectorAll(".key-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    sendKey(btn.dataset.key);
  });
});

// Gesture area: swipe + long press
const gesture = document.getElementById("gesture-area");
let touchStartX, touchStartY, touchStartTime, longPressTimer, gestureHandled;

gesture.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
  gestureHandled = false;
  gesture.classList.add("active");

  longPressTimer = setTimeout(() => {
    if (!gestureHandled) {
      gestureHandled = true;
      sendKey("Enter");
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }, 400);
});

gesture.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (gestureHandled) return;

  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const threshold = 30;

  if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
    clearTimeout(longPressTimer);
    gestureHandled = true;

    if (Math.abs(dx) > Math.abs(dy)) {
      sendKey(dx > 0 ? "Right" : "Left");
    } else {
      sendKey(dy > 0 ? "Down" : "Up");
    }

    // Reset for continuous swipes
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    gestureHandled = false;
  }
});

gesture.addEventListener("touchend", (e) => {
  e.preventDefault();
  clearTimeout(longPressTimer);
  gesture.classList.remove("active");
});

// Mouse fallback for gesture area
let mouseDown = false;
gesture.addEventListener("mousedown", (e) => {
  mouseDown = true;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  gestureHandled = false;
  gesture.classList.add("active");

  longPressTimer = setTimeout(() => {
    if (!gestureHandled) {
      gestureHandled = true;
      sendKey("Enter");
    }
  }, 400);
});

document.addEventListener("mousemove", (e) => {
  if (!mouseDown || gestureHandled) return;

  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  const threshold = 30;

  if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
    clearTimeout(longPressTimer);
    gestureHandled = true;

    if (Math.abs(dx) > Math.abs(dy)) {
      sendKey(dx > 0 ? "Right" : "Left");
    } else {
      sendKey(dy > 0 ? "Down" : "Up");
    }

    touchStartX = e.clientX;
    touchStartY = e.clientY;
    gestureHandled = false;
  }
});

document.addEventListener("mouseup", () => {
  mouseDown = false;
  clearTimeout(longPressTimer);
  gesture.classList.remove("active");
});

loadTerminal();
