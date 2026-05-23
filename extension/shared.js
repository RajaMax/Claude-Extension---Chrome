// Shared usage-fetching + badge logic, used by both the popup and the
// background service worker so the endpoint and label mapping live in one place.

export const CLAUDE_BASE = "https://claude.ai/api";

export const DEFAULT_INTERVAL_SEC = 30;

export async function getIntervalSec() {
  const { intervalSec } = await new Promise((resolve) =>
    chrome.storage.local.get(["intervalSec"], resolve)
  );
  return Number(intervalSec) || DEFAULT_INTERVAL_SEC;
}

// Internal usage keys mapped to friendly labels, in display order.
export const LIMITS = [
  { key: "five_hour", label: "Current session" },
  { key: "seven_day", label: "Weekly · all models" },
  { key: "seven_day_opus", label: "Weekly · Opus" },
  { key: "seven_day_sonnet", label: "Weekly · Sonnet" },
  { key: "seven_day_cowork", label: "Weekly · Claude Code" },
  { key: "seven_day_omelette", label: "Weekly · Claude Design" },
  { key: "seven_day_oauth_apps", label: "Weekly · connected apps" },
];

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

export async function resolveOrgId() {
  const { orgId } = await storageGet(["orgId"]);
  if (orgId) return orgId;

  const res = await fetch(`${CLAUDE_BASE}/organizations`, { credentials: "include" });
  if (!res.ok) throw new Error(`orgs_${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.organizations || [];
  const id = list[0]?.uuid || list[0]?.id;
  if (!id) throw new Error("no_org");
  chrome.storage.local.set({ orgId: id });
  return id;
}

export async function fetchUsage() {
  const orgId = await resolveOrgId();
  const res = await fetch(`${CLAUDE_BASE}/organizations/${orgId}/usage`, {
    credentials: "include",
  });
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (!res.ok) throw new Error(`usage_${res.status}`);
  return res.json();
}

export function activeLimits(usage) {
  return LIMITS.map(({ key, label }) => ({ key, label, ...(usage?.[key] || {}) })).filter(
    (x) => typeof x.utilization === "number"
  );
}

// The limit closest to its cap — the most useful single number for the badge.
export function peakLimit(usage) {
  const items = activeLimits(usage);
  if (items.length === 0) return null;
  return items.reduce((max, x) => (x.utilization > max.utilization ? x : max), items[0]);
}

export function badgeColor(pct) {
  if (pct >= 90) return "#d96b5b"; // red
  if (pct >= 75) return "#e0a458"; // amber
  return "#6b8f5e"; // green
}

async function setBadge(text, color, title) {
  await chrome.action.setBadgeText({ text });
  if (color) await chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }
  await chrome.action.setTitle({ title });
}

// Write the badge from an already-fetched usage object (no extra request).
export async function applyBadge(usage) {
  const peak = peakLimit(usage);
  if (!peak) {
    await setBadge("", "", "Claude Usage — no data");
    return;
  }
  const pct = Math.round(peak.utilization);
  const breakdown = activeLimits(usage)
    .map((x) => `${x.label}: ${Math.round(x.utilization)}%`)
    .join("\n");
  await setBadge(String(pct), badgeColor(pct), `Claude Usage\n${breakdown}`);
}

// Fetch fresh usage and update the badge; used by the background poller.
export async function refreshBadge() {
  try {
    await applyBadge(await fetchUsage());
  } catch (err) {
    const msg = String(err.message || err);
    if (msg === "auth" || msg.startsWith("orgs_4")) {
      await setBadge("!", "#888888", "Claude Usage — sign in to claude.ai");
    } else {
      await setBadge("?", "#888888", `Claude Usage — error: ${msg}`);
    }
  }
}
