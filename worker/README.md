# HKUST-ELPA submission Worker

This **separate Cloudflare Worker** accepts anonymous submissions from
`https://hkust-elpa.github.io/submit.html` and
`https://hkust-elpa.vercel.app/submit.html`; both create a **public GitHub Issue**.
It does **not** edit website files or publish a question. Maintainer review remains mandatory.

## Deploy prerequisites

1. Configure the Cloudflare Turnstile widget for **hkust-elpa.github.io** and **hkust-elpa.vercel.app**.
   Use action **elpa_submit**. Keep the Site Key public; keep the Secret private.
2. Use a Wrangler version supporting this `wrangler.jsonc` and the native Rate Limiting binding. The configured `namespace_id` is `11247601`; it is account-specific and must be checked when deploying to another account.
3. Install **HKUST ELPA Site Automation** on `HKUST-ELPA/HKUST-ELPA-Site-Source` and grant its installation **Issues: Read and write**. The Worker requests a short-lived Installation Token scoped to this repository and Issues: write. No personal PAT or Contents permission is required for the Worker.
4. Configure Worker secrets via:
   - `npx wrangler secret put TURNSTILE_SECRET`
   - `npx wrangler secret put GITHUB_APP_ID` (GitHub App numeric ID)
   - `npx wrangler secret put GITHUB_APP_INSTALLATION_ID` (numeric installation ID for HKUST-ELPA)
   - `npx wrangler secret put GITHUB_APP_PRIVATE_KEY` (PEM-encoded RSA private key, PKCS#1 or PKCS#8)
   The key is used only to sign short-lived GitHub App JWTs. Do not add credentials to git, logs, or browser code. **Complete this secret migration before deploying the new Worker code**; it deliberately fails closed without App credentials.
   Optional kill switch (plaintext Worker environment variable):
   `SUBMISSIONS_DISABLED=true` disables POST submissions; requests are accepted **only** when set explicitly to `false` and all other validations succeed. If the binding is missing, submissions remain disabled.
5. Deploy with `npx wrangler deploy`. The checked-in `wrangler.jsonc` deliberately
   defaults to `SUBMISSION_MODE=closed` and `SUBMISSIONS_DISABLED=true`.
   **After every production deployment**, explicitly verify the live Worker settings
   and restore `SUBMISSION_MODE=public`, `SUBMISSIONS_DISABLED=false` only if submissions
   are intended to remain open. Never check secrets into the repository. In the public
   `submission-config.js`, set the HTTPS Worker URL ending in `/submit` and the public
   Turnstile Site Key.
6. Verify CORS and protection with invalid requests **before** activating the frontend.
   Only submit actual question reports after successful end-to-end testing.
   Any manual test Issues must be clearly marked as tests and closed without approval.

## Security posture

- Exact-origin CORS for the Pages and Vercel production domains (no wildcard/preview hosts), with the verified Turnstile hostname matched against each request's own origin and action validation;
  the Worker also checks token server-side with Siteverify. The endpoint is opt-in: `SUBMISSIONS_DISABLED` must be explicitly `false`.
- Cloudflare native binding limits attempted POSTs to **3 per 60 seconds per IP
  at each edge location**. This is approximate/edge-local, not a globally strict quota.
- Request body is streamed with a **24 KiB (24,576 bytes)** cap; text lengths, types and
  allowed source/term values are validated. Requests fail closed if secrets,
  limiter or external verification are unavailable.
- No DB, no submitted attachments, no contact details requested, no visitor IP
  stored in Issues. GitHub Issues are **public**, including unapproved entries.
- A malicious actor may still attempt automated abuse; rotate the GitHub App private key if compromised,
  monitor Worker usage, and toggle `SUBMISSIONS_DISABLED` when needed.

## Interface

`POST /submit` accepts **v2 submissions** from the current website:

- **Question (optionally with experience):** `version: 2`, `kind: "question"`, `term` (e.g. `2026 Fall`),
  `examStage` (`start` / `mid` / `end`), bilingual `main: {en, cn}`,
  optional bilingual `subs: [{en, cn}]`, `source` (`firsthand` / `secondhand`),
  optional `campus` (`nansha` / `clear-water-bay`) and `track` (`regular` / `fast-track`),
  optional linked-question `intent` and `alternatives`, optional `advice: {phase, tags, title, body}`, and `turnstileToken`. New submissions require both English main text and Chinese comprehension. An optional advice block inherits campus and track from the question.
- **Legacy standalone preparation advice (existing Issues remain compatible):** `version: 2`, `kind: "advice"`, `phase`
  (`before` / `during` / `after`), `tags` (1–4 predefined taxonomy tags),
  optional `track` (`regular` / `fast-track`, defaults to `regular`),
  `title`, `body`, and `turnstileToken`.
- **Legacy v1 compatibility:** `term`, `question`, `subquestions`, `source`,
  and `turnstileToken`. The time-bounded `test` mode accepts only its exact
  allowlisted legacy payload; it does not accept v2 submissions.

Successful response: HTTP 201 `{"ok":true,"issueUrl":"..."}`. The Issue
contains readable Markdown and a base64url machine-readable marker
(`elpa-submission-v1` or `elpa-submission-v2`). Both versions enter the
same `submission:pending` review queue. Unapproved Issues are never added
straight to the question bank.

## Production configuration

- Worker: `hkust-elpa-submissions`; endpoint `https://hkust-elpa-submissions.futseyi.workers.dev/submit`.
- Public Turnstile Site Key: `0x4AAAAAAFWWsgbB9w0JPOm3`. The widget must allow both production hostnames.
- Rate limiter: `SUBMISSION_LIMITER`, namespace `11247601`, 3 requests / 60 seconds per IP per Cloudflare location.
- Worker GitHub credentials are `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY`. Each request exchanges a short-lived JWT for a repository-scoped, Issues-write-only token. Never commit or paste private keys or tokens.
- The live Worker uses `SUBMISSION_MODE=public` and `SUBMISSIONS_DISABLED=false` when submissions are open. Checked-in Wrangler defaults stay closed; verify live settings after every deployment.
- A synthetic submission created [Issue #78](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/issues/78) after token rotation and was closed as **not planned**, without entering the question bank. Repeat an end-to-end browser test when changing the Worker or Turnstile configuration.

## Time-bounded live verification

The Worker accepts submissions only when `SUBMISSIONS_DISABLED=false` **and**
`SUBMISSION_MODE` is explicitly `test` or `public`.

For a controlled browser smoke test, set:

- `SUBMISSION_MODE=test`
- `SUBMISSION_TEST_DEADLINE_MS`: an absolute **13-digit Unix timestamp in milliseconds**.
  All submissions automatically fail after this time, regardless of other settings.
- `SUBMISSION_TEST_QUESTION`: the exact synthetic question to permit.
- `SUBMISSIONS_DISABLED=false` only after verifying the deadline and allowlist.

During test mode, the Worker rejects all other questions; the permitted question
must use `term=2026 Fall`, empty `subquestions`, and `source=firsthand`.
It still requires Turnstile Siteverify, rate limiting and a functioning GitHub
Issue token. Clearly label the test question as **TEST ONLY / DO NOT PUBLISH**.
Close a synthetic test Issue as **not planned** (never completed) so it cannot publish. Do not merge generated test data. Keep the test branch for
development traceability.

For immediate rollback set `SUBMISSIONS_DISABLED=true` and
`SUBMISSION_MODE=closed`. **Production launch must be deliberate**:
`SUBMISSION_MODE=public` together with `SUBMISSIONS_DISABLED=false`.
Never enable the public mode as part of this test.

## GitHub App identity migration

Issue creation (Cloudflare Worker), completed-Issue publication (Source Actions), and static-site publishing (Published Actions) should all act as `hkust-elpa-site-automation[bot]`.

- Source Actions use repository variable `PUBLISH_APP_ID` and secret `PUBLISH_APP_PRIVATE_KEY` with a **Source-only** token authorized for Issues and Contents; the Published workflow already requests a separate Published-only Contents token. The Git commit's author/committer and authentication must both use the App bot.
- Cloudflare Worker requires a **different, Issues-only** installation token minted at runtime. Do not reuse or expose the Actions' token. Configure the three Worker secrets above and confirm installation permissions before deployment.
- Once GitHub App Issue creation is confirmed, remove the obsolete `GITHUB_TOKEN` Worker secret through Cloudflare configuration. Never remove it before the new deployment is verified; current production remains on the previously deployed PAT-based Worker until then.
- Historical Issues and commits retain their original authors. Do not rewrite their history.
