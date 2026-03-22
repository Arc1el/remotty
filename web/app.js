const sessionsEl = document.getElementById("sessions");
const statusEl = document.getElementById("status");

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
    <div class="session-card${s.is_active ? " active" : ""}" data-index="${s.index}">
      <div class="card-header">
        <span class="window-name">${esc(s.name)}</span>
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
    card.addEventListener("click", () => {
      const idx = card.dataset.index;
      window.location.href = `/terminal.html?window=${idx}`;
    });
  });
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
