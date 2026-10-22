# Working notes for Claude sessions (export_tdb)

export_tdb is a Grist custom widget: a dashboard composer. It reads the table it is linked to and the tables that descend from it through reference columns, and lets the user build pages with text (Markdown), tables with totals, charts, images and indicators, then print them or save them as PDF. It is hosted by GitHub Pages, with no build step. The maintainer is not a programmer. The full specification is in `docs/specification.md`: read it at the start of a session.

## Dialogue

- Talk to the maintainer in French, in plain words, without flattery. Ask the questions that remove ambiguity before programming, in small groups, with a recommendation. Work by small versions that the maintainer can test one by one.
- Explain every GitHub step with the exact names of the buttons (merging a pull request, enabling GitHub Pages, updating the widget).
- Texts meant to be pasted into Word contain no emoji, no horizontal rules and no needless bullets. In French, never put a comma before "et" and avoid long dashes in the middle of a sentence.

## Code rules

- Every JavaScript string is a template literal (backticks), never single or double quotes, so that French apostrophes cause no syntax error.
- Identifiers and comments are in English: one short block above every function and file. Texts shown to the user go through `shared/i18n.js` (French and English).
- No code or library loaded from a CDN: anything the widget needs is copied into the repository with its licence and a `VENDOR.md` that records the version, the source and the checks made. No `eval`, no `new Function`. User data is inserted into the page as text only, never as HTML.
- The widget knows no table or column name: everything is chosen in the interface from the schema read in the document. Never write real table names, column names, figures or links of the maintainer in this public repository, in the code, the tests, the comments, the commit messages or the pull requests. Tests use the invented document of `tests/fixtures/demo-data.js`.
- Only https links without credentials are used. The Content-Security-Policy of the pages stays as strict as the current version allows.
- Banners and messages must stay readable at a narrow width (about 340 px) and in dark mode: explicit colours, wrapping text, no truncation.
- Logic goes in pure modules (no access to the page or to Grist) that are tested with Node. Only the display modules touch the page. Every call to the Grist API goes through one module so that the rest can be tested with a fake Grist.
- Do not rebuild what Grist already provides (for example a full-screen button inside the Grist frame).
- Do not rename option keys once a version is published: saved dashboards depend on them. Change the format only with a versioned migration.

## Tests and versions

- `npm test` runs the Node tests of the pure modules. Add a test for every behaviour of a pure module.
- `npm run test:integration` runs the browser tests of `tests/integration/` (Playwright, a development tool that the widget never loads, with a fake Grist object). Run them before every release; they are not part of the automatic GitHub check. Add a scenario for every visible behaviour. Set `CHROMIUM_PATH` to use an existing Chromium.
- Pages reference their scripts with `?v=X.Y.Z`: change that number in the pages and in `package.json` with every release, and add a section to `CHANGELOG.md`.
- Commit message: `Version 0.2.0 : short description in French`. Work on a branch, push, open a draft pull request.
- The widget cannot be tried inside Grist from a session: give the maintainer the list of manual tests after each version.

## Decisions of the maintainer

- Charts: a custom build of Apache ECharts (Apache-2.0, SVG renderer) copied into the repository. Two dimensions first; three dimensional variants come after the final acceptance test.
- Five block types: text, table, chart, image and indicator, with named values reusable in texts and indicators.
- Long tables are fluid: they continue on the following pages with their headings repeated.
- A text block takes its text either from a fixed text kept in the widget or from a column of the selected row (written back to the cell). Fields such as `{Column}` can be used in both.
- Defaults: screen format with a 16 to 9 ratio, square format of 210 by 210 mm, widget linked to a table with "Select by", printing in a dedicated window opened by a click.
- Grist server by default: `grist.numerique.gouv.fr`.

## Plan

Version 0.1 explorer (proves the Grist API assumptions), 0.2 data engine, 0.3 canvas and layout, 0.4 text block, 0.5 table block, 0.6 indicators and named values, 0.7 chart block, 0.8 image block, 0.9 printing and PDF, 0.10 templates export and import, help and README, 0.11 final acceptance test with the maintainer. Then the finalisation audit (security, performance, cleaning, comments).
