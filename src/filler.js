// Job Autofill — fill engine. Injected into each frame on demand.
// Never submits anything; only fills empty fields and highlights them for review.
(() => {
  if (window.__jobAutofill) return;

  // ---------- helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    String(s || '')
      .replace(/ /g, ' ')
      .replace(/\*|\(required\)|\(optional\)/gi, ' ')
      .replace(/[_\-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  async function waitFor(fn, timeout = 2500, step = 80) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
    LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
    SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
  };

  // Alternative spellings an option may use for a given answer.
  function answerVariants(answer) {
    const a = String(answer).trim();
    const n = norm(a);
    const v = [a];
    if (US_STATES[a.toUpperCase()]) v.push(US_STATES[a.toUpperCase()]);
    for (const [abbr, name] of Object.entries(US_STATES)) if (norm(name) === n) v.push(abbr);
    if (/^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i.test(a))
      v.push('United States', 'United States of America', 'USA', 'US');
    return [...new Set(v)];
  }

  const DECLINE_RE = /decline|prefer not|don.?t wish|do not wish|not to (say|disclose|answer|self.?identify)|choose not|rather not|(do not|don.?t) want to (answer|disclose|say)/;

  // Pick the option that best matches an answer. options: [{text, el}]
  function bestOption(options, answer) {
    if (answer == null || answer === '') return null;
    const opts = options.filter((o) => norm(o.text) && !/^(select|choose|--|please select)/.test(norm(o.text)));
    const variants = answerVariants(answer).map(norm);
    const wantsDecline = DECLINE_RE.test(norm(answer));
    for (const v of variants) {
      const hit = opts.find((o) => norm(o.text) === v);
      if (hit) return hit;
    }
    if (wantsDecline) {
      const hit = opts.find((o) => DECLINE_RE.test(norm(o.text)));
      if (hit) return hit;
    }
    for (const v of variants) {
      // "Yes" should match "Yes, I am authorized" but not "Yes" inside another word
      const hit = opts.find((o) => norm(o.text).startsWith(v + ' ') || norm(o.text).startsWith(v + ','));
      if (hit) return hit;
    }
    for (const v of variants) {
      if (v.length < 3) continue;
      const hit = opts.find((o) => norm(o.text).includes(v)) || opts.find((o) => v.includes(norm(o.text)) && norm(o.text).length > 3);
      if (hit) return hit;
    }
    return null;
  }

  // ---------- reading labels ----------
  function textOf(el) {
    return el ? (el.innerText || el.textContent || '').trim() : '';
  }

  function questionText(el) {
    const parts = [];
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach((id) => parts.push(textOf(document.getElementById(id))));
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    if (el.id) {
      try {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l) parts.push(textOf(l));
      } catch (_) { /* ignore */ }
    }
    const wrapLabel = el.closest('label');
    if (wrapLabel) parts.push(textOf(wrapLabel));

    // Workday: label lives in the formField container
    const wd = el.closest('[data-automation-id^="formField"]');
    if (wd) {
      const l = wd.querySelector('label, legend');
      if (l) parts.push(textOf(l));
    }
    // fieldset legend (radio groups, address blocks)
    const fs = el.closest('fieldset');
    if (fs && fs.querySelector('legend')) parts.push(textOf(fs.querySelector('legend')));

    if (!parts.some(Boolean)) {
      // walk up a few levels looking for a label-ish element
      let node = el.parentElement;
      for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
        const l = node.querySelector('label, legend, [class*="label" i], [class*="question" i]');
        if (l && !l.contains(el) && textOf(l).length < 250) { parts.push(textOf(l)); break; }
      }
    }
    if (el.placeholder) parts.push(el.placeholder);
    return parts.filter(Boolean).join(' | ');
  }

  function attrHints(el) {
    const wd = el.closest('[data-automation-id]');
    return [el.name, el.id, el.getAttribute('autocomplete'), el.getAttribute('data-automation-id'), wd && wd.getAttribute('data-automation-id')]
      .filter(Boolean)
      .join(' ');
  }

  // ---------- profile → answers ----------
  // Order matters: more specific rules first.
  const RULES = [
    ['email', /e.?mail/, /confirm|re.?enter|verify/],
    ['emailConfirm', /(confirm|re.?enter|verify).*e.?mail/],
    ['preferredName', /preferred (first )?name|nick ?name/],
    ['middleName', /middle (name|initial)/],
    ['firstName', /\b(first|given)\s*name\b|^first$|first name|firstname|\bfname\b/],
    ['lastName', /\b(last|family|sur)\s*name\b|surname|lastname|\blname\b/],
    ['fullName', /^(your )?(full |legal )?name$|full name|legal name|^name\b/, /company|school|employer|reference|manager|recruiter|emergency|user ?name/],
    ['phoneCountryCode', /country (phone )?code|phone.*country|dialing code/],
    ['phoneType', /phone (device )?type|device type/],
    ['phone', /phone|mobile|cell|telephone/, /extension|type|code/],
    ['address2', /address( line)? ?2|apartment|\bapt\b|\bsuite\b|\bunit\b/],
    ['address1', /address( line)? ?1|street|^address$|mailing address|home address|^address\b/, /e.?mail|web|url|ip address/],
    ['city', /\bcity\b|\btown\b/],
    ['zip', /\bzip|postal|post ?code/],
    ['state', /\bstate\b|province|region/, /united states|statement|state your|citizen/],
    ['country', /\bcountry\b/, /phone|code|citizenship|authori[sz]ed|other than/],
    ['location', /^(current )?location$|where are you (located|based)|current city|city.*state/],
    ['linkedin', /linked ?in/],
    ['github', /git ?hub/],
    ['portfolio', /portfolio|personal (web ?)?site|^website$|website url|blog|other (website|url|link)/],
    ['salary', /salary|compensation|pay (expectation|requirement|range)|desired pay|expected pay/],
    ['noticePeriod', /notice period/],
    ['startDate', /start date|earliest (start|date|available)|when can you start|date available|availability to start/],
    ['yearsExperience', /years of (relevant |professional |total )?experience|how many years/],
    ['requireSponsorship', /sponsor/],
    ['workAuthorized', /authori[sz]ed to work|eligible to work|legally (able|permitted|allowed) to work|right to work|work authori[sz]ation|legal right/],
    ['relocate', /relocat/],
    ['over18', /18 years|at least 18|age of 18|over 18/],
    ['previouslyEmployed', /previously (been )?(employed|worked)|former employee|ever (been )?(worked|employed)|worked (for|at) .* before/],
    ['howHeard', /how did you (hear|learn|find)|where did you (hear|learn|find)|referral source|^source$|how .* hear about/],
    ['currentCompany', /current (company|employer)|most recent (company|employer)|^company( name)?$|^employer$/],
    ['currentTitle', /current (job )?(title|position|role)|most recent (title|position)|^job title$|^title$/, /applying/],
    ['pronouns', /pronoun/],
    ['gender', /gender|^sex$|\bsex\b/],
    ['hispanic', /hispanic|latin[oax]/],
    ['race', /\brace\b|ethnicit/],
    ['veteran', /veteran|military|armed forces/],
    ['disability', /disabilit/],
    ['school', /school|university|college|institution/],
    ['degree', /\bdegree\b/],
    ['fieldOfStudy', /field of study|major|discipline|area of study/],
    ['gpa', /\bgpa\b|grade (point )?average/],
    ['cityState', /city,? (and )?state/]
  ];

  function profileValue(p, key) {
    const edu = (p.education && p.education[0]) || {};
    const exp = (p.experiences && p.experiences[0]) || {};
    switch (key) {
      case 'emailConfirm': return p.email;
      case 'fullName': return [p.firstName, p.lastName].filter(Boolean).join(' ');
      case 'location':
      case 'cityState': return [p.city, p.state].filter(Boolean).join(', ');
      case 'currentCompany': return p.currentCompany || exp.company;
      case 'currentTitle': return p.currentTitle || exp.title;
      case 'school': return edu.school;
      case 'degree': return edu.degree;
      case 'fieldOfStudy': return edu.field;
      case 'gpa': return edu.gpa;
      default: return p[key];
    }
  }

  function customAnswer(p, q) {
    for (const c of p.customAnswers || []) {
      if (!c || !c.match || c.answer == null) continue;
      const keys = c.match.split(/[,|]/).map((s) => norm(s)).filter(Boolean);
      if (keys.length && keys.every((k) => q.includes(k))) return c.answer;
    }
    return null;
  }

  function answerFor(p, el) {
    const q = norm(questionText(el));
    const custom = customAnswer(p, q);
    if (custom != null) return { key: 'custom', value: custom };
    const tryMatch = (text) => {
      for (const [key, re, ex] of RULES) {
        if (re.test(text) && !(ex && ex.test(text))) {
          const v = profileValue(p, key);
          if (v != null && v !== '') return { key, value: v };
          return { key, value: null };
        }
      }
      return null;
    };
    // Long questions: match on the question text; fall back to attribute hints.
    return (q && tryMatch(q)) || tryMatch(norm(attrHints(el))) || null;
  }

  // ---------- writing values ----------
  const marked = new Set();
  function mark(el, kind) {
    const target = el.closest('[data-automation-id^="formField"]') || el;
    target.style.outline = kind === 'ok' ? '2px solid #22a06b' : '2px solid #f5a623';
    target.style.outlineOffset = '2px';
    marked.add(target);
  }

  function setText(el, value) {
    value = String(value);
    el.focus();
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    try { el.select && el.select(); } catch (_) { /* some types don't support select */ }
    let ok = false;
    try { ok = document.execCommand('insertText', false, value); } catch (_) { ok = false; }
    if (!ok || el.value !== value) {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    el.blur();
    return el.value === value;
  }

  function setSelect(sel, answer) {
    const opt = bestOption([...sel.options].map((o) => ({ text: o.text, el: o })), answer);
    if (!opt) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, opt.el.value);
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function radioLabel(r) {
    if (r.id) {
      const l = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
      if (l) return textOf(l);
    }
    const l = r.closest('label');
    if (l) return textOf(l);
    return r.getAttribute('aria-label') || r.value || textOf(r.parentElement);
  }

  function groupQuestion(radios) {
    const first = radios[0];
    const fs = first.closest('fieldset, [role="radiogroup"], [role="group"], [data-automation-id^="formField"]');
    if (fs) {
      const lb = fs.getAttribute('aria-labelledby');
      if (lb) return lb.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ');
      const l = fs.querySelector('legend, label:not(:has(input))');
      if (l) return textOf(l);
      if (fs.getAttribute('aria-label')) return fs.getAttribute('aria-label');
    }
    // nearest preceding text block
    let node = first.parentElement;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const t = textOf(node);
      const own = radios.map(radioLabel).join(' ');
      if (t.length > own.length + 5) return t.replace(own, '');
    }
    return '';
  }

  function answerForQuestion(p, q) {
    q = norm(q);
    const custom = customAnswer(p, q);
    if (custom != null) return custom;
    for (const [key, re, ex] of RULES) {
      if (re.test(q) && !(ex && ex.test(q))) return profileValue(p, key);
    }
    return null;
  }

  // ---------- Workday custom widgets ----------
  async function pickFromListbox(answer) {
    const listbox = await waitFor(() => {
      const opts = [...document.querySelectorAll('[role="option"]')].filter(visible);
      return opts.length ? opts : null;
    }, 2500);
    if (!listbox) return false;
    const opt = bestOption(listbox.map((el) => ({ text: textOf(el), el })), answer);
    if (!opt) return false;
    opt.el.scrollIntoView({ block: 'nearest' });
    opt.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    opt.el.click();
    await sleep(250);
    return true;
  }

  function closePopups() {
    document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.click();
  }

  async function fillDropdownButton(btn, answer) {
    const current = norm(textOf(btn));
    if (current && !/^select( one)?$/.test(current) && current !== 'select one') return 'skip';
    btn.click();
    const ok = await pickFromListbox(answer);
    if (!ok) closePopups();
    return ok;
  }

  async function fillPrompt(input, answer) {
    // Workday multiselect "prompt" search boxes: type, press Enter, choose option
    setText(input, answer);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    const ok = await pickFromListbox(answer);
    if (!ok) closePopups();
    return ok;
  }

  // Workday month/year date widgets
  function fillWorkdayDate(container, mmYYYY) {
    if (!container || !mmYYYY) return false;
    const m = String(mmYYYY).match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/) || String(mmYYYY).match(/^(\d{4})$/);
    if (!m) return false;
    const month = m[2] ? m[1].padStart(2, '0') : null;
    const year = m[2] || m[1];
    const mi = container.querySelector('[data-automation-id="dateSectionMonth-input"]');
    const yi = container.querySelector('[data-automation-id="dateSectionYear-input"]');
    let ok = false;
    if (mi && month) ok = setText(mi, month) || ok;
    if (yi) ok = setText(yi, year) || ok;
    if (!mi && !yi) {
      const inp = container.querySelector('input');
      if (inp) ok = setText(inp, month ? `${month}/${year}` : year);
    }
    return ok;
  }

  // ---------- Workday "My Experience" repeating sections ----------
  const WD_EXP = ['jobTitle', 'companyName', 'location', 'currentlyWorkHere', 'startDate', 'endDate', 'roleDescription'];
  const WD_EDU = ['school', 'schoolName', 'degree', 'fieldOfStudy', 'gradeAverage', 'firstYearAttended', 'lastYearAttended'];
  const WD_REPEAT_IDS = new Set([...WD_EXP, ...WD_EDU].map((k) => 'formField-' + k));

  function inRepeatSection(el) {
    const f = el.closest('[data-automation-id^="formField-"]');
    return !!(f && WD_REPEAT_IDS.has(f.getAttribute('data-automation-id')));
  }

  // anchorIds: one id or "a|b" alternatives (Workday tenants differ, e.g. school vs schoolName)
  function anchorSel(anchorIds) {
    return anchorIds.split('|').map((id) => `[data-automation-id="formField-${id}"]`).join(', ');
  }
  function groupsFor(anchorIds) {
    const sel = anchorSel(anchorIds);
    const anchors = [...document.querySelectorAll(sel)].filter(visible);
    return anchors.map((a) => {
      let g = a;
      while (g.parentElement && g.parentElement.querySelectorAll(sel).length === 1) g = g.parentElement;
      return g;
    });
  }

  function sectionAddButton(headingRe) {
    const headings = [...document.querySelectorAll('h2, h3, h4, legend, [role="heading"]')].filter((h) => headingRe.test(norm(textOf(h))));
    for (const h of headings) {
      let node = h.parentElement;
      for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
        const btn = [...node.querySelectorAll('button')].find(
          (b) => visible(b) && (/^add( another)?$/.test(norm(textOf(b))) || b.getAttribute('data-automation-id') === 'add-button')
        );
        if (btn) return btn;
      }
    }
    return null;
  }

  async function ensureGroups(anchorId, headingRe, wanted) {
    for (let guard = 0; guard < wanted + 2; guard++) {
      const have = groupsFor(anchorId).length;
      if (have >= wanted) break;
      const btn = sectionAddButton(headingRe);
      if (!btn) break;
      btn.click();
      await waitFor(() => groupsFor(anchorId).length > have, 2500);
    }
    return groupsFor(anchorId);
  }

  async function fillField(group, id, value, stats) {
    if (value == null || value === '') return;
    const f = group.querySelector(`[data-automation-id="formField-${id}"]`);
    if (!f || !visible(f)) return;
    const btn = f.querySelector('button[aria-haspopup="listbox"]');
    const prompt = f.querySelector('[data-automation-id="searchBox"], [data-automation-id="multiselectInputContainer"] input');
    const area = f.querySelector('textarea');
    const input = f.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
    let ok = false;
    if (btn) ok = (await fillDropdownButton(btn, value)) === true;
    else if (prompt) ok = await fillPrompt(prompt, value);
    else if (area) ok = area.value ? false : setText(area, value);
    else if (input) ok = input.value ? false : setText(input, value);
    if (ok) { stats.filled++; mark(f, 'ok'); }
  }

  async function fillWorkdayExperience(p, stats) {
    const exps = (p.experiences || []).filter((e) => e && (e.title || e.company));
    if (exps.length && (document.querySelector('[data-automation-id="formField-jobTitle"]') || sectionAddButton(/^work experience/))) {
      const groups = await ensureGroups('jobTitle', /^work experience/, exps.length);
      for (let i = 0; i < Math.min(groups.length, exps.length); i++) {
        const g = groups[i], e = exps[i];
        const t = g.querySelector('[data-automation-id="formField-jobTitle"] input');
        if (t && t.value) continue; // already filled — leave it
        await fillField(g, 'jobTitle', e.title, stats);
        await fillField(g, 'companyName', e.company, stats);
        await fillField(g, 'location', e.location, stats);
        const cb = g.querySelector('[data-automation-id="formField-currentlyWorkHere"] input[type="checkbox"]');
        if (cb && !!e.current !== cb.checked) { cb.click(); await sleep(200); }
        if (fillWorkdayDate(g.querySelector('[data-automation-id="formField-startDate"]'), e.start)) stats.filled++;
        if (!e.current && fillWorkdayDate(g.querySelector('[data-automation-id="formField-endDate"]'), e.end)) stats.filled++;
        await fillField(g, 'roleDescription', e.description, stats);
      }
    }
    const edus = (p.education || []).filter((e) => e && e.school);
    if (edus.length && (document.querySelector(anchorSel('schoolName|school')) || sectionAddButton(/^education/))) {
      const groups = await ensureGroups('schoolName|school', /^education/, edus.length);
      for (let i = 0; i < Math.min(groups.length, edus.length); i++) {
        const g = groups[i], e = edus[i];
        await fillField(g, 'schoolName', e.school, stats);
        await fillField(g, 'school', e.school, stats);
        await fillField(g, 'degree', e.degree, stats);
        await fillField(g, 'fieldOfStudy', e.field, stats);
        await fillField(g, 'gradeAverage', e.gpa, stats);
        if (fillWorkdayDate(g.querySelector('[data-automation-id="formField-firstYearAttended"]'), e.start)) stats.filled++;
        if (fillWorkdayDate(g.querySelector('[data-automation-id="formField-lastYearAttended"]'), e.end)) stats.filled++;
      }
    }
  }

  // ---------- main ----------
  async function run(p, opts = {}) {
    const stats = { filled: 0, review: 0 };
    marked.forEach((t) => { t.style.outline = ''; });
    marked.clear();

    // 1) plain text inputs, textareas, selects
    const fields = [...document.querySelectorAll('input, textarea, select')].filter((el) => {
      if (!visible(el) || el.disabled || el.readOnly) return false;
      if (el.tagName === 'INPUT' && /^(hidden|submit|button|file|password|checkbox|radio|image|reset|range|color)$/i.test(el.type)) return false;
      if (inRepeatSection(el)) return false;
      if (el.closest('[data-automation-id="multiselectInputContainer"], [data-automation-id^="dateSection"]')) return false;
      return true;
    });

    const asyncJobs = [];
    for (const el of fields) {
      const a = answerFor(p, el);
      const required = el.required || el.getAttribute('aria-required') === 'true';
      if (!a || a.value == null || a.value === '') {
        if (required && !el.value) { stats.review++; mark(el, 'review'); }
        continue;
      }
      if (el.tagName === 'SELECT') {
        if (el.selectedIndex > 0 && !opts.overwrite) continue;
        if (setSelect(el, a.value)) { stats.filled++; mark(el, 'ok'); }
        else if (required) { stats.review++; mark(el, 'review'); }
        continue;
      }
      if (el.value && !opts.overwrite) continue;
      // React-select / combobox style inputs (Greenhouse, Ashby): type then choose option
      if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list') {
        asyncJobs.push(async () => {
          setText(el, a.value);
          el.focus();
          const ok = await pickFromListbox(a.value);
          if (ok) { stats.filled++; mark(el, 'ok'); } else { closePopups(); if (el.value) { stats.filled++; mark(el, 'review'); stats.review++; } }
        });
        continue;
      }
      if (setText(el, a.value)) { stats.filled++; mark(el, 'ok'); }
    }

    // 2) radio groups
    const radios = [...document.querySelectorAll('input[type="radio"]')].filter((r) => visible(r) || visible(r.parentElement));
    const groups = {};
    radios.forEach((r) => { const k = r.name || r.closest('fieldset, [role="radiogroup"]')?.id || Math.random(); (groups[k] = groups[k] || []).push(r); });
    for (const list of Object.values(groups)) {
      if (list.some((r) => r.checked)) continue;
      const ans = answerForQuestion(p, groupQuestion(list));
      if (ans == null || ans === '') continue;
      const opt = bestOption(list.map((r) => ({ text: radioLabel(r), el: r })), ans);
      if (opt) { opt.el.click(); stats.filled++; mark(opt.el.closest('fieldset, [role="radiogroup"]') || opt.el.parentElement, 'ok'); }
    }

    // 3) ARIA radio groups (custom widgets)
    for (const rg of document.querySelectorAll('[role="radiogroup"]')) {
      const items = [...rg.querySelectorAll('[role="radio"]')];
      if (!items.length || items.some((i) => i.getAttribute('aria-checked') === 'true')) continue;
      const ans = answerForQuestion(p, groupQuestion(items));
      const opt = ans && bestOption(items.map((el) => ({ text: textOf(el) || el.getAttribute('aria-label'), el })), ans);
      if (opt) { opt.el.click(); stats.filled++; mark(rg, 'ok'); }
    }

    // 4) Workday dropdown buttons and prompts (outside repeating sections)
    for (const btn of document.querySelectorAll('button[aria-haspopup="listbox"]')) {
      if (!visible(btn) || inRepeatSection(btn)) continue;
      const a = answerFor(p, btn);
      if (!a || !a.value) continue;
      asyncJobs.push(async () => {
        const r = await fillDropdownButton(btn, a.value);
        if (r === true) { stats.filled++; mark(btn, 'ok'); }
      });
    }
    for (const inp of document.querySelectorAll('[data-automation-id="multiselectInputContainer"] input, [data-automation-id="searchBox"]')) {
      if (!visible(inp) || inRepeatSection(inp)) continue;
      const f = inp.closest('[data-automation-id^="formField"]');
      if (f && f.querySelector('[data-automation-id="selectedItem"]')) continue; // already chosen
      const a = answerFor(p, inp);
      if (!a || !a.value) continue;
      asyncJobs.push(async () => { if (await fillPrompt(inp, a.value)) { stats.filled++; mark(inp, 'ok'); } });
    }

    for (const job of asyncJobs) { try { await job(); } catch (_) { /* keep going */ } }

    // 5) Workday experience / education
    try { await fillWorkdayExperience(p, stats); } catch (_) { /* keep going */ }

    if (window === window.top || stats.filled) toast(stats);
    return stats;
  }

  function toast({ filled, review }) {
    const old = document.getElementById('__jobAutofillToast');
    if (old) old.remove();
    const d = document.createElement('div');
    d.id = '__jobAutofillToast';
    d.textContent = `Job Autofill: filled ${filled} field${filled === 1 ? '' : 's'}` + (review ? ` · ${review} need your attention (orange)` : '') + ' · review before submitting';
    Object.assign(d.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 2147483647, background: '#1f2937', color: '#fff',
      padding: '10px 14px', borderRadius: '8px', font: '13px/1.4 system-ui, sans-serif', boxShadow: '0 4px 14px rgba(0,0,0,.25)'
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }

  // ---------- learn: turn answers typed on this page into custom answers ----------
  const STOP = new Set(('a an the are you your do does did have has had is was were be been being in of to for with and or any this ' +
    'that what which who whom how why when where please will would could should can may might shall if on at by as we our us ' +
    'currently now future from i me my it its there they them these those about into than then so not all other select one ' +
    'describe provide list enter type indicate let know tell following question answer below above here also more most such ' +
    'per via etc yes no own just only each every both either neither same very many much').split(' '));
  const SENSITIVE = /ssn|social security|date of birth|\bdob\b|birth ?date|password|signature|sign here|credit card|bank|passport|driver.?s? licen[sc]e/;

  function keywordsFor(q) {
    const tokens = norm(q).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
    const uniq = [...new Set(tokens)];
    const top = [...uniq].sort((a, b) => b.length - a.length).slice(0, 4);
    return uniq.filter((t) => top.includes(t)).join(', ');
  }

  function learn(p) {
    const out = [];
    const seen = new Set();
    const add = (question, answer) => {
      question = String(question || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
      answer = String(answer == null ? '' : answer).trim();
      if (!question || !answer || question.length > 400 || answer.length > 2000) return;
      const q = norm(question);
      if (SENSITIVE.test(q) || seen.has(q)) return;
      // skip anything the built-in rules or existing custom answers already cover
      if (customAnswer(p, q) != null) return;
      for (const [key, re, ex] of RULES) {
        if (re.test(q) && !(ex && ex.test(q))) { const v = profileValue(p, key); if (v != null && v !== '') return; break; }
      }
      const keywords = keywordsFor(question);
      if (!keywords) return;
      seen.add(q);
      out.push({ question: question.slice(0, 200), keywords, answer });
    };

    for (const el of document.querySelectorAll('input, textarea, select')) {
      if (!visible(el) || el.disabled) continue;
      if (el.tagName === 'INPUT' && /^(hidden|submit|button|file|password|checkbox|radio|image|reset|range|color|search)$/i.test(el.type)) continue;
      if (inRepeatSection(el) || el.closest('[data-automation-id^="dateSection"], #__jobAutofillToast')) continue;
      if (el.tagName === 'SELECT') {
        if (el.selectedIndex > 0) add(questionText(el), el.options[el.selectedIndex].text);
      } else if (el.value) {
        add(questionText(el).split(' | ').filter((s) => s !== el.placeholder)[0] || questionText(el), el.value);
      }
    }
    const groups = {};
    document.querySelectorAll('input[type="radio"]').forEach((r) => { if (r.name) (groups[r.name] = groups[r.name] || []).push(r); });
    for (const list of Object.values(groups)) {
      const c = list.find((r) => r.checked);
      if (c) add(groupQuestion(list), radioLabel(c));
    }
    for (const rg of document.querySelectorAll('[role="radiogroup"]')) {
      const items = [...rg.querySelectorAll('[role="radio"]')];
      const c = items.find((i) => i.getAttribute('aria-checked') === 'true');
      if (c) add(groupQuestion(items), textOf(c) || c.getAttribute('aria-label'));
    }
    for (const btn of document.querySelectorAll('button[aria-haspopup="listbox"]')) {
      if (!visible(btn) || inRepeatSection(btn)) continue;
      const val = textOf(btn);
      if (!val || /^select( one)?$/i.test(val.trim())) continue;
      const f = btn.closest('[data-automation-id^="formField"]');
      const l = f && f.querySelector('label, legend');
      add(l ? textOf(l) : questionText(btn), val);
    }
    return out;
  }

  window.__jobAutofill = { run, learn, _internals: { norm, bestOption, questionText, answerFor, keywordsFor } };
})();
