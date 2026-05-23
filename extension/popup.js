import { fetchUsage, activeLimits, applyBadge, getIntervalSec } from "./shared.js";

const els = {
  refresh: document.getElementById("refresh"),
  settings: document.getElementById("settings"),
  status: document.getElementById("status"),
  limits: document.getElementById("limits"),
  updated: document.getElementById("updated"),
  interval: document.getElementById("interval"),
};

els.settings.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.refresh.addEventListener("click", load);

getIntervalSec().then((sec) => {
  els.interval.value = String(sec);
});
els.interval.addEventListener("change", () => {
  chrome.storage.local.set({ intervalSec: Number(els.interval.value) });
});
els.status.addEventListener("click", (e) => {
  if (e.target.id === "setOrg") {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
});

function showStatus(html) {
  els.status.innerHTML = html;
  els.status.classList.remove("hidden");
}

function clearStatus() {
  els.status.classList.add("hidden");
  els.status.innerHTML = "";
}

function fmtReset(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Resetting now";
  if (diff < 24 * 60 * 60 * 1000) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Resets in ${h}h ${m}m`;
  }
  return (
    "Resets " +
    d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
  );
}

async function load() {
  clearStatus();
  try {
    const usage = await fetchUsage();
    render(usage);
    applyBadge(usage); // keep the toolbar badge in sync on demand
  } catch (err) {
    const msg = String(err.message || err);
    if (msg === "auth" || msg.startsWith("orgs_4")) return notLoggedIn();
    if (msg === "no_org") {
      return showStatus(
        'Couldn\'t find your organization. Open <a href="#" id="setOrg">Settings</a> to set it manually.'
      );
    }
    showStatus(`Request failed: ${msg}. Are you online and signed into claude.ai?`);
  }
}

function notLoggedIn() {
  els.limits.innerHTML = "";
  els.updated.textContent = "";
  showStatus(
    'Not signed in. Open <a href="https://claude.ai" target="_blank">claude.ai</a>, log in, then reopen this popup.'
  );
}

function render(usage) {
  els.limits.innerHTML = "";
  const items = activeLimits(usage);

  if (items.length === 0) {
    showStatus("No usage data returned. The endpoint may have changed.");
    return;
  }

  for (const item of items) {
    els.limits.appendChild(buildRow(item.label, item.utilization, item.resets_at));
  }
  els.updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function buildRow(label, pct, resetsAt) {
  const clamped = Math.max(0, Math.min(100, pct));

  const row = document.createElement("div");
  row.className = "limit-row";

  const head = document.createElement("div");
  head.className = "limit-head";
  const name = document.createElement("span");
  name.className = "limit-name";
  name.textContent = label;
  const pctEl = document.createElement("span");
  pctEl.className = "limit-pct";
  pctEl.textContent = `${Math.round(clamped)}% used`;
  head.append(name, pctEl);

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  if (clamped >= 90) fill.classList.add("danger");
  else if (clamped >= 75) fill.classList.add("warn");
  fill.style.width = `${clamped}%`;
  bar.appendChild(fill);

  row.append(head, bar);

  const reset = fmtReset(resetsAt);
  if (reset) {
    const r = document.createElement("div");
    r.className = "limit-reset";
    r.textContent = reset;
    row.appendChild(r);
  }

  return row;
}

load();
