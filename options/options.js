/* global chrome */
const SECTIONS = [
  ['Personal', [
    ['firstName', 'First name'], ['lastName', 'Last name'], ['preferredName', 'Preferred name'], ['middleName', 'Middle name'],
    ['email', 'Email', 'email'], ['phone', 'Phone', 'tel', 'Digits only works best on Workday, e.g. 5555550123'],
    ['phoneCountryCode', 'Phone country code', '', 'e.g. United States of America (+1)'], ['phoneType', 'Phone type', '', 'Mobile'],
    ['pronouns', 'Pronouns']
  ]],
  ['Address', [
    ['address1', 'Address line 1'], ['address2', 'Address line 2'], ['city', 'City'],
    ['state', 'State / Province', '', 'e.g. Oregon or OR'], ['zip', 'ZIP / Postal code'], ['country', 'Country', '', 'United States of America']
  ]],
  ['Links', [
    ['linkedin', 'LinkedIn URL', 'url'], ['github', 'GitHub URL', 'url'], ['portfolio', 'Website / Portfolio', 'url']
  ]],
  ['Current role', [
    ['currentTitle', 'Current / most recent title'], ['currentCompany', 'Current / most recent company'],
    ['yearsExperience', 'Years of experience', 'number']
  ]],
  ['Common questions', [
    ['workAuthorized', 'Authorized to work in the US?', 'yesno'], ['requireSponsorship', 'Need visa sponsorship?', 'yesno'],
    ['relocate', 'Willing to relocate?', 'yesno'], ['over18', 'At least 18 years old?', 'yesno'],
    ['previouslyEmployed', 'Previously worked for this company?', 'yesno', 'Usually No — change per company if needed'],
    ['howHeard', 'How did you hear about us?', '', 'e.g. LinkedIn'], ['salary', 'Desired salary', '', 'e.g. 180000 or "Open / negotiable"'],
    ['noticePeriod', 'Notice period', '', 'e.g. 2 weeks'], ['startDate', 'Earliest start date', '', 'e.g. 2 weeks from offer']
  ]],
  ['Voluntary self-identification (EEO)', [
    ['gender', 'Gender', '', 'or "Decline to self identify"'], ['hispanic', 'Hispanic or Latino?', '', 'Yes / No / Decline'],
    ['race', 'Race / Ethnicity', '', 'or "Decline to self identify"'], ['veteran', 'Veteran status', '', 'e.g. I am not a protected veteran'],
    ['disability', 'Disability status', '', 'e.g. No, I do not have a disability']
  ]]
];

const LIST_FIELDS = {
  experiences: [
    ['title', 'Job title'], ['company', 'Company'], ['location', 'Location'],
    ['start', 'Start (MM/YYYY)'], ['end', 'End (MM/YYYY)'], ['current', 'I currently work here', 'checkbox'],
    ['description', 'Description', 'textarea']
  ],
  education: [
    ['school', 'School'], ['degree', 'Degree', '', "e.g. Bachelor's Degree"], ['field', 'Field of study'],
    ['gpa', 'GPA'], ['start', 'Start year (YYYY)'], ['end', 'End year (YYYY)']
  ],
  customAnswers: [['match', 'Question keywords'], ['answer', 'Answer']]
};

const $ = (s) => document.querySelector(s);
let profile = {};

function input(key, type, placeholder, value) {
  if (type === 'yesno') {
    const s = document.createElement('select');
    s.dataset.key = key;
    ['', 'Yes', 'No'].forEach((o) => s.add(new Option(o || '—', o)));
    s.value = value || '';
    return s;
  }
  if (type === 'textarea') {
    const t = document.createElement('textarea');
    t.dataset.key = key; t.value = value || ''; t.placeholder = placeholder || '';
    return t;
  }
  const i = document.createElement('input');
  i.type = type || 'text';
  i.dataset.key = key;
  if (type === 'checkbox') i.checked = !!value; else i.value = value ?? '';
  if (placeholder) i.placeholder = placeholder;
  return i;
}

function field(key, label, type, hint, value) {
  const l = document.createElement('label');
  l.className = 'f' + (type === 'textarea' ? ' full' : '') + (type === 'checkbox' ? ' check' : '');
  const span = document.createElement('span');
  span.textContent = label;
  const el = input(key, type, hint, value);
  if (type === 'checkbox') { l.append(el, span); } else { l.append(span, el); }
  return l;
}

function renderSections() {
  const root = $('#sections');
  root.innerHTML = '';
  for (const [title, fields] of SECTIONS) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h2>${title}</h2>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    fields.forEach(([k, l, t, h]) => grid.append(field(k, l, t, h, profile[k])));
    sec.append(grid);
    root.append(sec);
  }
}

function renderList(name) {
  const root = document.getElementById(name);
  root.innerHTML = '';
  (profile[name] || []).forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = name === 'customAnswers' ? 'row' : 'card';
    card.dataset.idx = idx;
    if (name === 'customAnswers') {
      LIST_FIELDS[name].forEach(([k, l]) => card.append(input(k, 'text', l, item[k])));
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';
      LIST_FIELDS[name].forEach(([k, l, t, h]) => grid.append(field(k, l, t, h, item[k])));
      card.append(grid);
    }
    const rm = document.createElement('button');
    rm.className = 'remove'; rm.textContent = 'Remove';
    rm.onclick = () => { collect(); profile[name].splice(idx, 1); renderList(name); };
    card.append(rm);
    root.append(card);
  });
}

function collect() {
  document.querySelectorAll('#sections [data-key]').forEach((el) => { profile[el.dataset.key] = el.value.trim(); });
  for (const name of Object.keys(LIST_FIELDS)) {
    profile[name] = [...document.getElementById(name).children].map((card) => {
      const o = {};
      card.querySelectorAll('[data-key]').forEach((el) => { o[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      return o;
    });
  }
  return profile;
}

function renderAll() {
  renderSections();
  Object.keys(LIST_FIELDS).forEach(renderList);
}

function flash(msg) {
  $('#status').textContent = msg;
  setTimeout(() => { $('#status').textContent = ''; }, 2500);
}

async function save() {
  collect();
  await chrome.storage.local.set({ profile });
  flash('Saved ✓');
}

document.querySelectorAll('[data-add]').forEach((b) => {
  b.onclick = () => {
    collect();
    const name = b.dataset.add;
    profile[name] = profile[name] || [];
    profile[name].push({});
    renderList(name);
  };
});

$('#save').onclick = save;
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });

$('#export').onclick = () => {
  collect();
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'job-autofill-profile.json';
  a.click();
};

$('#import').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    profile = JSON.parse(await file.text());
    renderAll();
    await chrome.storage.local.set({ profile });
    flash('Imported and saved ✓');
  } catch (err) {
    flash('Could not read that file: ' + err.message);
  }
};

chrome.storage.local.get('profile').then(({ profile: p }) => {
  profile = p || {
    country: 'United States of America', phoneType: 'Mobile', workAuthorized: 'Yes', requireSponsorship: 'No',
    over18: 'Yes', previouslyEmployed: 'No', howHeard: 'LinkedIn',
    gender: 'Decline to self identify', hispanic: 'Decline', race: 'Decline to self identify',
    veteran: 'I am not a protected veteran', disability: 'I do not want to answer',
    experiences: [{}], education: [{}], customAnswers: []
  };
  renderAll();
});
