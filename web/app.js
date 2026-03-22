const sessionsEl = document.getElementById("sessions");
const statusEl = document.getElementById("status");

async function fetchSessions() {
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) throw new Error(res.statusText);
    const sessions = await res.json();
    statusEl.textContent = `${sessions.length} tab${sessions.length !== 1 ? "s" : ""}`;
    statusEl.classList.remove("offline");
    render(sessions);
  } catch (e) {
    statusEl.textContent = "offline";
    statusEl.classList.add("offline");
    sessionsEl.innerHTML = `
      <div class="empty-state">
        <p>:(</p>
        <p>Kaku not running</p>
      </div>`;
  }
}

function render(sessions) {
  if (sessions.length === 0) {
    sessionsEl.innerHTML = `
      <div class="empty-state">
        <p>-</p>
        <p>No open tabs</p>
      </div>`;
    return;
  }

  sessionsEl.innerHTML = sessions.map(s => `
    <div class="session-card${s.is_active ? " active" : ""}" data-pane="${s.pane_id}">
      <div class="card-header">
        <span class="window-name">${esc(s.title)}</span>
        <span class="window-index">${s.is_active ? "●" : ""}</span>
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
      const paneId = card.dataset.pane;
      window.open(`/api/terminal/${paneId}`, "_blank");
    });
  });
}

function esc(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// Initial load + poll every 3 seconds
fetchSessions();
setInterval(fetchSessions, 3000);
