# Job Autofill

A free, private Chrome extension that fills job applications in one click from a profile you save once.

- Works on **Workday** (including *My Experience*: it adds and fills multiple jobs and schools), **Greenhouse**, **Lever**, **Ashby**, iCIMS, SmartRecruiters and most normal forms.
- Fills text boxes, dropdowns, Yes/No radios, Workday's custom dropdowns, and month/year dates.
- **Never submits.** Filled fields are outlined **green**; required fields it couldn't answer are outlined **orange**.
- Fills only empty fields by default, so it never overwrites what you typed. You can turn on overwrite in the popup.
- Your data stays in `chrome.storage.local` on your computer. No account, no server, no tracking.

## Install (2 minutes)

1. Download this repo: **Code → Download ZIP**, then unzip it. Or `git clone` it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `job-autofill` folder.
4. The profile page opens. Fill it in and click **Save**. Pin the extension to the toolbar.

## Use

On an application page, click the extension and choose **Fill this application**, or press **Alt+Shift+F**.
On multi-page forms like Workday, press it again on each page. Review everything, then click Next or Submit yourself.

## Custom answers

Under **Custom answers**, add keywords and an answer. If a question contains all the keywords, your answer is used:

| Keywords | Answer |
|---|---|
| `salesforce, years` | `15` |
| `security clearance` | `No` |
| `non-compete` | `No` |

Custom answers take priority over the built-in rules.

## Learn from this page

When a form has questions the extension didn't fill:

1. Answer them yourself as usual.
2. Before clicking Next or Submit, open the extension and click **Learn from this page**.
3. It lists the questions you answered that your profile doesn't cover yet, each with suggested keywords and your answer. Untick anything you don't want saved, edit the keywords if needed, and click **Save selected to my profile**.

Next time a question with those keywords appears, it fills automatically. Sensitive fields (SSN, date of birth, passwords, bank details) are never learned.

## Sharing with someone else

Each person installs their own copy, and each copy keeps its own profile. Profiles are stored separately in each Chrome profile, so nobody sees anyone else's data.

- **On a different computer:** send them the ZIP (or this repo, if they have access) and have them follow *Install* above.
- **On the same computer:** each person needs their own Chrome profile (click the profile picture at Chrome's top right, then **Add**). Install the extension in each one. Two people in the same Chrome profile would share one Job Autofill profile.

## Updating

Replace the files in your folder with the latest version from GitHub, then click the **reload** icon on the Job Autofill card in `chrome://extensions`. Your saved profile is kept.

## Backup / move to another computer

Use **Export JSON** on the profile page, then **Import JSON** on the other machine.

## Tests

`tests/` has mock React forms built like Greenhouse and Workday, plus a headless-Chrome test runner:

```bash
cd tests && npm install && node run.js
```

## How it works

`src/filler.js` reads each field's label (including `label[for]`, `aria-labelledby`, Workday `data-automation-id` containers and fieldset legends). It matches the label against rules in `RULES` and writes values in a way React and Angular forms accept: `execCommand('insertText')`, with a native value setter and input/change events as fallback. For a site it misses, add a pattern to `RULES` or a custom answer.
