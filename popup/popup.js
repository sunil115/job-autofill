/* global chrome, fillActiveTab, learnActiveTab, saveLearned */
const msg = document.getElementById('msg');
const learnedBox = document.getElementById('learned');
const itemsEl = document.getElementById('items');

function say(text, cls = '') {
  msg.className = cls;
  msg.textContent = text;
}

document.getElementById('fill').onclick = async () => {
  say('Filling…');
  const r = await fillActiveTab({ overwrite: document.getElementById('overwrite').checked });
  if (!r.ok) return say(r.error, 'err');
  say(`Filled ${r.filled} field${r.filled === 1 ? '' : 's'}` +
    (r.review ? ` · ${r.review} need attention (orange)` : '') +
    '. Review, then click Next/Submit yourself. Answered extra questions by hand? Click "Learn from this page".', 'ok');
};

document.getElementById('learn').onclick = async () => {
  say('Looking for answers you typed…');
  const r = await learnActiveTab();
  if (!r.ok) return say(r.error, 'err');
  itemsEl.innerHTML = '';
  if (!r.items.length) {
    learnedBox.style.display = 'none';
    document.body.classList.remove('wide');
    return say('Nothing new to learn here. Every answered question is already covered by your profile.', 'ok');
  }
  say(`Found ${r.items.length} answer${r.items.length === 1 ? '' : 's'} not in your profile yet.`, 'ok');
  document.body.classList.add('wide');
  learnedBox.style.display = 'block';
  for (const it of r.items) {
    const row = document.createElement('div');
    row.className = 'item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    const q = document.createElement('div');
    q.className = 'q';
    q.textContent = it.question;
    const kl = document.createElement('div'); kl.className = 'lbl'; kl.textContent = 'Keywords';
    const kw = document.createElement('input');
    kw.type = 'text'; kw.value = it.keywords; kw.className = 'kw';
    const al = document.createElement('div'); al.className = 'lbl'; al.textContent = 'Answer';
    const an = document.createElement('input');
    an.type = 'text'; an.value = it.answer; an.className = 'an';
    row.append(cb, q);
    [kl, kw, al, an].forEach((el) => { const pad = document.createElement('span'); row.append(pad, el); });
    itemsEl.append(row);
  }
};

document.getElementById('saveLearned').onclick = async () => {
  const picked = [...itemsEl.querySelectorAll('.item')]
    .filter((row) => row.querySelector('input[type=checkbox]').checked)
    .map((row) => ({ keywords: row.querySelector('.kw').value.trim(), answer: row.querySelector('.an').value.trim() }))
    .filter((it) => it.keywords && it.answer);
  const added = await saveLearned(picked);
  learnedBox.style.display = 'none';
  document.body.classList.remove('wide');
  say(`Saved ${added} new answer${added === 1 ? '' : 's'}. They'll fill automatically next time.`, 'ok');
};

document.getElementById('settings').onclick = () => chrome.runtime.openOptionsPage();
