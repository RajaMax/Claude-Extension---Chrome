const orgInput = document.getElementById("orgId");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const savedMsg = document.getElementById("saved");

chrome.storage.local.get(["orgId"], (cfg) => {
  if (cfg.orgId) orgInput.value = cfg.orgId;
});

function flash(text) {
  savedMsg.textContent = text;
  setTimeout(() => (savedMsg.textContent = ""), 1500);
}

saveBtn.addEventListener("click", () => {
  const orgId = orgInput.value.trim();
  chrome.storage.local.set({ orgId }, () => flash("Saved."));
});

clearBtn.addEventListener("click", () => {
  chrome.storage.local.remove("orgId", () => {
    orgInput.value = "";
    flash("Cleared — will auto-detect.");
  });
});
