// Learn loop: fill, answer a question by hand, learn it, reuse it on a fresh form.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const filler = fs.readFileSync(path.join(__dirname, '..', 'src', 'filler.js'), 'utf8');
const profile = { firstName: 'Alex', lastName: 'Sample', email: 'alex@example.com', workAuthorized: 'Yes', requireSponsorship: 'No', customAnswers: [] };

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const url = `file://${__dirname}/pages/index.html#greenhouse`;
  const open = async () => { const p = await b.newPage(); await p.goto(url); await p.waitForSelector('input'); await p.addScriptTag({ content: filler }); return p; };

  const p1 = await open();
  await p1.evaluate((pr) => window.__jobAutofill.run(pr), profile);
  await p1.type('#mystery', 'Flows, because admins can automate without code.');
  await p1.type('#sfyears', '15');
  await p1.select('#gender', 'v2');
  const items = await p1.evaluate((pr) => window.__jobAutofill.learn(pr), profile);
  console.log('learned:', items);

  profile.customAnswers = items.map((i) => ({ match: i.keywords, answer: i.answer }));
  const p2 = await open();
  const stats = await p2.evaluate((pr) => window.__jobAutofill.run(pr), profile);
  const st = await p2.evaluate(() => ({ mystery: STATE.mystery, sfyears: STATE.sfyears, gender: document.getElementById('gender').selectedOptions[0].text }));
  console.log('second form stats', stats, st);
  const pass = st.mystery.startsWith('Flows') && st.sfyears === '15' && /decline/i.test(st.gender);
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
