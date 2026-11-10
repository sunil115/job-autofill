// Shared by the popup and the background worker: injects the filler into
// every frame of the active tab and runs it with the saved profile.
/* global chrome */
async function fillActiveTab(opts = {}) {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile || !profile.firstName) {
    return { ok: false, error: 'No profile saved yet. Open Settings and fill in your details first.' };
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { ok: false, error: 'No active tab.' };

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/filler.js']
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (p, o) => (window.__jobAutofill ? window.__jobAutofill.run(p, o) : null),
      args: [profile, { overwrite: !!opts.overwrite }]
    });
    const total = { filled: 0, review: 0, frames: 0 };
    for (const r of results) {
      if (r && r.result) {
        total.filled += r.result.filled;
        total.review += r.result.review;
        total.frames += 1;
      }
    }
    return { ok: true, ...total };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// Collect questions you answered by hand on this page that the profile doesn't cover yet.
async function learnActiveTab() {
  const { profile = {} } = await chrome.storage.local.get('profile');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { ok: false, error: 'No active tab.' };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['src/filler.js'] });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (p) => (window.__jobAutofill && window.__jobAutofill.learn ? window.__jobAutofill.learn(p) : []),
      args: [profile]
    });
    const items = results.flatMap((r) => (r && r.result) || []);
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function saveLearned(items) {
  const { profile = {} } = await chrome.storage.local.get('profile');
  profile.customAnswers = profile.customAnswers || [];
  const existing = new Set(profile.customAnswers.map((c) => (c.match || '').toLowerCase().trim()));
  let added = 0;
  for (const it of items) {
    const key = it.keywords.toLowerCase().trim();
    if (!key || existing.has(key)) continue;
    profile.customAnswers.push({ match: it.keywords, answer: it.answer });
    existing.add(key);
    added++;
  }
  await chrome.storage.local.set({ profile });
  return added;
}

if (typeof self !== 'undefined') {
  self.fillActiveTab = fillActiveTab;
  self.learnActiveTab = learnActiveTab;
  self.saveLearned = saveLearned;
}
