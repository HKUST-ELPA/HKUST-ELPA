# Repository Guide

HKUST-ELPA is a student-maintained static ELPA preparation website built with HTML, CSS, JavaScript and Python. Cloudflare Workers handles submissions; GitHub Issues handles moderation.

`HKUST-ELPA/HKUST-ELPA-Site-Source` owns source, issue moderation and the only production build. `HKUST-ELPA/HKUST-ELPA.github.io` contains generated output only; never edit it directly after bootstrapping. See `README.md` for the publishing flow and `PREVIEW.md` for commands.

**Every line of code should justify its existence. Define once. Reuse everywhere.**

## Architecture

- `index.html` owns the homepage, shared navigation/footer, and authored guide/sources content in `<template data-page>` blocks.
- `practice.html` owns question browsing, practice and local learning records. `submit.html` owns the submission interface.
- `preview.py` builds and verifies the complete portable static site in `_site/`. It publishes six routes: `index.html`, `guide.html`, `practice.html`, `sources.html`, `submit.html`, `community.html`.
- `assets/` holds front-end CSS, JavaScript and media; `data/` holds the public submission configuration and initial record template.
- `question-bank/` is the canonical source for questions, appearances, reviewed advice, taxonomy and provenance. Python generates browser-ready resources.
- `worker/` validates untrusted submissions and creates public Issues. Owner-approved Issue closures trigger the importer in `scripts/`, which updates canonical question data.
- `.github/workflows/` runs PR-only full validation, trusted-main build and Published publication, and reviewed-Issue import. `tests/` covers data, user interactions, publication and Worker security.

## Engineering principles

- Design changes holistically. Reuse shared components and authoritative data instead of accumulating patches or independent copies.
- Keep plain, accessible HTML and native links as the fallback. Shared site navigation preserves the document shell for home, guide, practice and sources, while the submission form remains an independent document. Prefer small, direct implementations with clear ownership and no unnecessary runtime dependencies.
- Make directory structure reflect maintenance responsibilities. Consolidate a feature when it genuinely reduces source and coordination cost.
- Preserve question IDs, legacy aliases, query parameters, published URLs, and existing note/backup behavior. Follow-up positions identify users' saved notes.
- Keep the browser record keys `elpa-q-status-v1`, `elpa-notes-v1`, `elpa-data-snapshot-v2` and `elpa-autosave`, plus the IndexedDB folder-handle storage contract, unless a tested migration is introduced.
- Preserve historical question reports, attribution, uncertainty and student wording. Never fabricate dates, questions or translations.
- Keep browser validation, Worker security validation and trusted importer verification at their respective trust boundaries.
- Publish reviewed content only after maintainer `FuTseYi` closes the Source Issue as completed. Imports must remain idempotent; writes must be constrained to authorized data files and must not force-push.
- Retain support for existing v1 and v2 submissions. Keep production credentials out of the repository and public frontend.
- Maintain a single coherent PR for substantial architectural changes and verify before merging.

## Development and verification

- Local preview: `py -3 preview.py` on Windows or `python3 preview.py` elsewhere.
- Build: `preview.py --build-only` through the matching Python launcher; Source Actions copies `_site/` to Published, and Pages/Vercel serve Published `main`.
- Build and verify the site with `preview.py --build-only`, then run `node --test` (Node.js 22+) and the Python tests. JavaScript tests cover browser behavior, Worker security, importer compatibility and the generated site.
- Python tests: `python -m unittest discover -s tests -t . -p 'test_*.py'`.
- Browser regression: install `requirements-dev.txt` and Chromium/WebKit, then run `python tests/browser_smoke.py`. Run full browser regression on PRs; main pushes publish through the existing validated Pages build without repeating browser tests.
- Verify root and `/HKUST-ELPA/` deployment paths and maintain all data and URL contracts.
- Report what was tested, what changed, and the outcome. CI success is distinct from production deployment success.

## Documentation

- `README.md`: usage and publishing architecture. `PREVIEW.md`: development, verification and deployment operations. `PUBLISHED_README.md`: generated Published notice.
- `question-bank/README.md`: editorial provenance and question data.
- `question-bank/MODERATION.md`: review approval and recovery.
- `worker/README.md`: Worker deployment, security settings and operations.

Update the document that owns a rule rather than repeating its full specification in multiple places.
