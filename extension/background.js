import { refreshBadge, getIntervalSec } from "./shared.js";

const ALARM = "refresh-usage";

async function ensureAlarm() {
  const sec = await getIntervalSec();
  // chrome.alarms measures in minutes and clamps to a 30-second minimum.
  const periodInMinutes = Math.max(0.5, sec / 60);
  chrome.alarms.create(ALARM, { periodInMinutes });
}

async function init() {
  await ensureAlarm();
  refreshBadge();
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) refreshBadge();
});

// The popup asks for an immediate refresh after it loads fresh data.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "refresh-badge") refreshBadge();
});

// When the interval is changed in the popup, rebuild the alarm right away.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.intervalSec) {
    ensureAlarm();
    refreshBadge();
  }
});
