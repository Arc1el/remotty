const sessionsEl = document.getElementById("sessions");
const statusEl = document.getElementById("status");

// Theme toggle
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

async function fetchSessions() {
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) throw new Error(res.statusText);
    const sessions = await res.json();
    statusEl.textContent = `${sessions.length} window${sessions.length !== 1 ? "s" : ""}`;
    statusEl.classList.remove("offline");
    render(sessions);
  } catch (e) {
    statusEl.textContent = "offline";
    statusEl.classList.add("offline");
    sessionsEl.innerHTML = `
      <div class="empty-state">
        <p>:(</p>
        <p>tmux session not found</p>
      </div>`;
  }
}

function render(sessions) {
  if (sessions.length === 0) {
    sessionsEl.innerHTML = `
      <div class="empty-state">
        <p>-</p>
        <p>No active windows</p>
      </div>`;
    return;
  }

  sessionsEl.innerHTML = sessions.map(s => `
    <div class="session-card${s.is_active ? " active" : ""}" data-index="${s.index}" data-name="${esc(s.name)}">
      <div class="card-header">
        <span class="window-name">${esc(s.name)}</span>
        <button class="rename-btn" data-index="${s.index}">&#9998;</button>
        <span class="window-index">#${s.index}${s.is_active ? " ●" : ""}</span>
      </div>
      <div class="card-body">
        <div class="info-row">
          <span class="icon">&#128193;</span>
          <span class="value">${esc(s.path)}</span>
        </div>
        <div class="info-row">
          <span class="icon">&#9654;</span>
          <span class="value command">${esc(s.command)}</span>
        </div>
        ${s.branch ? `
        <div class="info-row">
          <span class="icon">&#9737;</span>
          <span class="value branch">${esc(s.branch)}</span>
        </div>` : ""}
      </div>
    </div>
  `).join("");

  sessionsEl.querySelectorAll(".session-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".rename-btn")) return;
      window.location.href = `/terminal.html?window=${card.dataset.index}`;
    });
  });

  sessionsEl.querySelectorAll(".rename-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".session-card");
      renameWindow(card.dataset.index, card.dataset.name);
    });
  });
}

async function renameWindow(idx, currentName) {
  const name = prompt("세션 이름 변경", currentName || "");
  if (name === null || name.trim() === "") return;
  await fetch(`/api/rename-window/${idx}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  fetchSessions();
}

function esc(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

function showNewDialog() {
  const overlay = document.getElementById("dialog-overlay");
  const input = document.getElementById("dialog-input");
  overlay.classList.add("show");
  input.value = "";
  input.focus();
}

function hideNewDialog() {
  document.getElementById("dialog-overlay").classList.remove("show");
}

document.getElementById("dialog-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") createWindow();
  if (e.key === "Escape") hideNewDialog();
});

async function createWindow() {
  const name = document.getElementById("dialog-input").value.trim();
  hideNewDialog();

  const res = await fetch("/api/new-window", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) return;

  const data = await res.json();
  window.location.href = `/terminal.html?window=${data.index}`;
}

fetchSessions();
setInterval(fetchSessions, 3000);
