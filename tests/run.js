const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const profile = {
  firstName: 'Alex', lastName: 'Sample', email: 'alex@example.com', phone: '5555550123',
  address1: '123 Main St', city: 'Springfield', state: 'OR', zip: '12345', country: 'United States of America',
  linkedin: 'https://linkedin.com/in/test', portfolio: 'https://example.com', currentCompany: 'Example Corp',
  phoneType: 'Mobile', workAuthorized: 'Yes', requireSponsorship: 'No',
  gender: 'Decline to self identify', race: 'Decline to self identify', veteran: 'I am not a protected veteran',
  disability: 'I do not want to answer',
  customAnswers: [{ match: 'salesforce, years', answer: '15' }],
  experiences: [
    { title: 'Solution Architect', company: 'Example Corp', location: 'Springfield, OR', start: '01/2020', current: true, description: 'Salesforce architecture.' },
    { title: 'Engineering Manager', company: 'Acme', location: 'Portland, OR', start: '03/2015', end: '12/2019', description: 'Led team.' }
  ],
  education: [{ school: 'State University', degree: "Bachelor's", end: '2008' }]
};

(async () => {
  const dir = __dirname;
  const nm = path.join(dir, 'node_modules');
  const html = `<!doctype html><html><body><div id="root"></div>
<script src="file://${nm}/react/umd/react.development.js"></script>
<script src="file://${nm}/react-dom/umd/react-dom.development.js"></script>
<script src="file://${dir}/pages/forms.js"></script></body></html>`;
  fs.writeFileSync(path.join(dir, 'pages/index.html'), html);

  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const filler = fs.readFileSync(path.join(__dirname, '..', 'src', 'filler.js'), 'utf8');

  for (const which of ['greenhouse', 'workday']) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto(`file://${dir}/pages/index.html#${which}`);
    await page.waitForSelector('input');
    await page.addScriptTag({ content: filler });
    const stats = await page.evaluate((p) => window.__jobAutofill.run(p), profile);
    await new Promise((r) => setTimeout(r, 300));
    const state = await page.evaluate(() => {
      // map select values back to option text
      const out = { ...window.STATE };
      document.querySelectorAll('select').forEach((s) => { if (s.id && out[s.id]) out[s.id] = s.options[s.selectedIndex].text; });
      return out;
    });
    console.log(`\n=== ${which} === stats:`, stats);
    for (const [k, v] of Object.entries(state)) console.log(`  ${v === '' || v === false ? '  ' : '✓ '}${k.padEnd(16)} ${JSON.stringify(v)}`);
    await page.screenshot({ path: path.join(dir, `${which}.png`), fullPage: true });
  }
  await browser.close();
})();
