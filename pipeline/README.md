# Past-paper pipeline

Turns Edexcel IAL past papers (PDF) into the question registry the site reads. Runs offline, on your
machine; the site never touches a PDF. Papers remain Pearson Edexcel's and are credited as such, with a
link to the original on every question.

```
registry/sources.json ─► fetch ─► verify ─► segment ─► pair MS ─► tag ─► review ─► registry/<subject>/papers/*.json
     (links)            (cache)  (covers)   (crops)    (rows)   (Gemini)  (you)        + crops in the data repo
```

| Stage    | Script       | Status |
|----------|--------------|--------|
| fetch    | `fetch.py`   | done   |
| verify   | `verify.py`  | done   |
| segment  | –            | next   |
| pair MS  | –            |        |
| tag      | –            | Gemini Flash sub-agents via T3 (`antigravity` provider) |
| review   | –            | local-only page in the site |

## Setup

```sh
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
```

## Adding papers

**From paperlords.org, automatically:** `scrape_paperlords.py` opens the IAL page in a visible browser and
clicks through it the way you would: subject → each series → QP / MS on each unit. From each viewer that
opens it reads the "open in new tab" link, then adds the papers to `sources.json`.

```sh
pipeline/.venv/bin/python pipeline/scrape_paperlords.py --dry-run              # walk the menus, open nothing
pipeline/.venv/bin/python pipeline/scrape_paperlords.py --series "June 2026"   # one series
pipeline/.venv/bin/python pipeline/scrape_paperlords.py                        # every Physics series
```

It pauses 1.5 s after each click, stops the viewer from loading the PDFs (fetch.py downloads each one once),
and skips papers already listed, so reruns only click what's new. If the site changes and a step fails, it
stops and saves a screenshot and the page HTML to `cache/debug/`. Run it yourself, not through an AI agent:
the site's robots.txt blocks AI agents.

**From Physics & Maths Tutor:** `scrape_pmt.py` reads PMT's six Edexcel Physics unit pages (plain HTML, allowed
by its robots.txt). It adds the old IAL spec (WPH01–06, 2014–2019) and attaches PMT's copies of current-spec
papers as `mirrors`, a fallback when the first source has the wrong file. UK A-level papers (6PH01–06) are
skipped unless you pass `--include-uk`.

Unit codes tell the qualifications apart: `WPH1n` current IAL spec (2018), `WPH0n` old IAL spec, `6PH0n` UK.

**By hand, in bulk:** open a past-paper listing in your browser, expand the series you want, and paste
`collect-links.js` into the dev-tools console. It copies every PDF link on the page. Save that to a file and run

```sh
pipeline/.venv/bin/python pipeline/import_links.py links.txt
```

It reads unit, series and QP/MS/ER from file names like `IAL_PHYSICS_2026_June_U4_QP_….pdf`, groups them
into papers, skips papers already listed and prints any names it couldn't read.

Both ways go through the site's own pages at a human pace. Don't swap them for a crawler that calls the
site's `/api` directly: its robots.txt blocks that.

**One at a time:** add an entry to `registry/sources.json` by hand (omit `sha256`).

Then download:

```sh
pipeline/.venv/bin/python pipeline/fetch.py
```

PDFs land in `pipeline/cache/pdf/` (git-ignored). The first download records each file's checksum in the
manifest; later runs flag any source whose file has changed.

Paper ids are `<UNIT>_<YEAR>_<MONTH>`, e.g. `WPH14_2026_06`.

## Checking the files are what they claim

Sites sometimes put the wrong PDF behind a link. After fetching, run

```sh
pipeline/.venv/bin/python pipeline/verify.py
```

It reads each PDF's cover (paper code such as `WPH14/01A`, the exam date or mark-scheme season, QP or MS)
and compares it with the manifest. Each file gets a `check` (`ok` / `mismatch` / `unreadable`). Then it repairs
what it can:

- **mirror swap:** a wrong file is replaced by a mirror whose cover agrees.
- **refile:** a file whose cover names another paper moves there, or is dropped if that paper has its own copy.
- **aliases:** June 2020 papers (cancelled, then sat in October 2020) are merged into October 2020.
- wrong links go to `rejected` in sources.json, so imports never bring them back.

Old scans with no text are read by a person and recorded in `registry/covers-by-eye.json`, keyed by checksum.
`--no-fix` reports without changing anything.

## Files

- `registry/sources.json`: every PDF we read, with its URL and checksum.
- `registry/<subject>/topics.json`: the spec turned into tags. Tags are spec point numbers.
- `src/lib/papers/types.ts`: the registry format, shared by the pipeline and the site.

## What the papers look like (WPH14, June 2026)

Layout facts the segmenter relies on, measured in PDF points on A4 (595 × 842):

- Question numbers start a line at x ≈ 43 (x ≈ 36 when prefixed `*` for an extended-writing question).
- Every question ends with `(Total for Question N = M marks)`; Section A questions are 1 mark MCQs.
- Part marks are a `(n)` at x ≈ 496, right-aligned after the answer space.
- Page furniture to strip: barcode `*P79350A0232*`, the rotated `DO NOT WRITE IN THIS AREA` margins,
  page numbers at y ≈ 798, blank pages and the formula sheet at the back.
- Mark scheme: a table of Question Number | Answer | (Additional Guidance) | Mark. MCQ rows read
  `The only correct answer is B`, so MCQ keys can be read reliably. All other text extracts with mangled
  maths fonts, so mark schemes are shown as crops too.
