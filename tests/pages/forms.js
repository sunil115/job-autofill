/* global React, ReactDOM */
const h = React.createElement;
const { useState } = React;
window.STATE = {};

function useField(key, init = '') {
  const [v, setV] = useState(init);
  window.STATE[key] = v;
  return [v, setV];
}

function Text({ k, label, required, type = 'text' }) {
  const [v, setV] = useField(k);
  return h('div', { className: 'field' },
    h('label', { htmlFor: k }, label, required ? ' *' : ''),
    h('input', { id: k, name: k, type, value: v, required, onChange: (e) => setV(e.target.value) }));
}
function Area({ k, label }) {
  const [v, setV] = useField(k);
  return h('div', null, h('label', { htmlFor: k }, label), h('textarea', { id: k, value: v, onChange: (e) => setV(e.target.value) }));
}
function Sel({ k, label, options }) {
  const [v, setV] = useField(k);
  return h('div', null, h('label', { htmlFor: k }, label),
    h('select', { id: k, value: v, onChange: (e) => setV(e.target.value) },
      h('option', { value: '' }, 'Select...'), ...options.map((o, i) => h('option', { key: i, value: 'v' + i }, o))));
}
function Radios({ k, label, options }) {
  const [v, setV] = useField(k);
  return h('fieldset', null, h('legend', null, label),
    ...options.map((o) => h('label', { key: o }, h('input', { type: 'radio', name: k, checked: v === o, onChange: () => setV(o) }), o)));
}

function Greenhouse() {
  return h('form', null,
    h(Text, { k: 'first_name', label: 'First Name', required: true }),
    h(Text, { k: 'last_name', label: 'Last Name', required: true }),
    h(Text, { k: 'email', label: 'Email', required: true, type: 'email' }),
    h(Text, { k: 'phone', label: 'Phone', type: 'tel' }),
    h(Text, { k: 'loc', label: 'Location (City)' }),
    h(Text, { k: 'li', label: 'LinkedIn Profile' }),
    h(Text, { k: 'web', label: 'Website' }),
    h(Text, { k: 'company', label: 'Current Company' }),
    h(Sel, { k: 'auth', label: 'Are you legally authorized to work in the United States?', options: ['Yes', 'No'] }),
    h(Radios, { k: 'sponsor', label: 'Will you now or in the future require sponsorship for employment visa status?', options: ['Yes', 'No'] }),
    h(Text, { k: 'sfyears', label: 'How many years of Salesforce experience do you have?', required: true }),
    h(Text, { k: 'mystery', label: 'What is your favorite Salesforce feature and why?', required: true }),
    h(Sel, { k: 'gender', label: 'Gender', options: ['Male', 'Female', 'Decline To Self Identify'] }),
    h(Sel, { k: 'race', label: 'Race', options: ['Asian', 'White', 'Decline To Self Identify'] }),
    h(Sel, { k: 'vet', label: 'Veteran Status', options: ['I am a protected veteran', 'I am not a protected veteran', "I don't wish to answer"] }),
    h(Sel, { k: 'dis', label: 'Disability Status', options: ['Yes, I have a disability', 'No, I do not have a disability', "I don't wish to answer"] }),
    h(Sel, { k: 'state', label: 'State', options: ['California', 'Oregon', 'Washington'] })
  );
}

// ---------- Workday-like ----------
function WdText({ id, label, k }) {
  const [v, setV] = useField(k);
  return h('div', { 'data-automation-id': 'formField-' + id },
    h('label', { htmlFor: k }, label),
    h('input', { id: k, value: v, onChange: (e) => setV(e.target.value) }));
}
function WdArea({ id, label, k }) {
  const [v, setV] = useField(k);
  return h('div', { 'data-automation-id': 'formField-' + id }, h('label', null, label), h('textarea', { value: v, onChange: (e) => setV(e.target.value) }));
}
function WdDropdown({ id, label, k, options }) {
  const [v, setV] = useField(k);
  const [open, setOpen] = useState(false);
  return h('div', { 'data-automation-id': 'formField-' + id },
    h('label', null, label),
    h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-label': label + ' ' + (v || 'Select One'), onClick: () => setOpen(!open) }, v || 'Select One'),
    open && h('ul', { role: 'listbox' }, ...options.map((o) => h('li', { key: o, role: 'option', onClick: () => { setV(o); setOpen(false); } }, o))));
}
function WdDate({ id, label, k }) {
  const [m, setM] = useField(k + '_m');
  const [y, setY] = useField(k + '_y');
  return h('div', { 'data-automation-id': 'formField-' + id }, h('label', null, label),
    h('input', { 'data-automation-id': 'dateSectionMonth-input', value: m, onChange: (e) => setM(e.target.value) }),
    h('input', { 'data-automation-id': 'dateSectionYear-input', value: y, onChange: (e) => setY(e.target.value) }));
}
function WdCheck({ id, label, k }) {
  const [v, setV] = useField(k, false);
  return h('div', { 'data-automation-id': 'formField-' + id }, h('label', null, h('input', { type: 'checkbox', checked: v, onChange: (e) => setV(e.target.checked) }), label));
}

function Job({ i }) {
  return h('div', { role: 'group', 'aria-label': 'Work Experience ' + (i + 1) },
    h('h4', null, 'Work Experience ' + (i + 1)),
    h(WdText, { id: 'jobTitle', label: 'Job Title', k: `job${i}_title` }),
    h(WdText, { id: 'companyName', label: 'Company', k: `job${i}_company` }),
    h(WdText, { id: 'location', label: 'Location', k: `job${i}_loc` }),
    h(WdCheck, { id: 'currentlyWorkHere', label: 'I currently work here', k: `job${i}_cur` }),
    h(WdDate, { id: 'startDate', label: 'From', k: `job${i}_start` }),
    h(WdDate, { id: 'endDate', label: 'To', k: `job${i}_end` }),
    h(WdArea, { id: 'roleDescription', label: 'Role Description', k: `job${i}_desc` }));
}
function Edu({ i }) {
  return h('div', { role: 'group' },
    h(WdText, { id: 'schoolName', label: 'School or University', k: `edu${i}_school` }),
    h(WdDropdown, { id: 'degree', label: 'Degree', k: `edu${i}_degree`, options: ['Associate Degree', "Bachelor's Degree", "Master's Degree"] }),
    h(WdDate, { id: 'lastYearAttended', label: 'To (Actual or Expected)', k: `edu${i}_end` }));
}

function Workday() {
  const [jobs, setJobs] = useState(0);
  const [edus, setEdus] = useState(0);
  return h('div', null,
    h('h2', null, 'My Information'),
    h(WdDropdown, { id: 'countryDropdown', label: 'Country', k: 'country', options: ['Canada', 'India', 'United States of America'] }),
    h(WdText, { id: 'legalName--firstName', label: 'Given Name(s)', k: 'wd_first' }),
    h(WdText, { id: 'legalName--lastName', label: 'Family Name', k: 'wd_last' }),
    h(WdText, { id: 'addressLine1', label: 'Address Line 1', k: 'wd_addr' }),
    h(WdText, { id: 'city', label: 'City', k: 'wd_city' }),
    h(WdDropdown, { id: 'countryRegion', label: 'State', k: 'wd_state', options: ['California', 'Oregon', 'Washington'] }),
    h(WdText, { id: 'postalCode', label: 'Postal Code', k: 'wd_zip' }),
    h(WdDropdown, { id: 'phoneType', label: 'Phone Device Type', k: 'wd_ptype', options: ['Home', 'Mobile', 'Work'] }),
    h(WdText, { id: 'phoneNumber', label: 'Phone Number', k: 'wd_phone' }),
    h('h2', null, 'My Experience'),
    h('div', null,
      h('h3', null, 'Work Experience'),
      ...Array.from({ length: jobs }, (_, i) => h(Job, { key: i, i })),
      h('button', { type: 'button', 'data-automation-id': 'add-button', onClick: () => setJobs(jobs + 1) }, jobs ? 'Add Another' : 'Add')),
    h('div', null,
      h('h3', null, 'Education'),
      ...Array.from({ length: edus }, (_, i) => h(Edu, { key: i, i })),
      h('button', { type: 'button', onClick: () => setEdus(edus + 1) }, edus ? 'Add Another' : 'Add'))
  );
}

const which = location.hash.slice(1) || 'greenhouse';
ReactDOM.createRoot(document.getElementById('root')).render(h(which === 'workday' ? Workday : Greenhouse));
