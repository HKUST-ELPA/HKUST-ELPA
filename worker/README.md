# HKUST-ELPA submission Worker

This Cloudflare Worker receives anonymous website contributions and creates a public GitHub Issue. It **never edits the question bank directly**.

## Canonical v3 API

`POST /submit` accepts a single JSON payload:

```json
{
  "version": 3,
  "kind": "question",
  "campus": "gz",
  "track": "regular",
  "term": "2027 Fall",
  "examStage": "start",
  "main": {"en": "How would you explain your research?", "cn": "你会如何解释自己的研究？"},
  "subs": [],
  "source": "firsthand",
  "turnstileToken": "..."
}
```

`campus` must be `gz` or `hk`; `track` must be `regular` or `fast-track`. The optional `advice` object contains `phase`, `tags`, `title`, and `body`. Optional `linkedQuestionId` uses the same `GZ-R-0001`-style domain as the submission, with `intent: encounter/supplement` and optional `alternatives`. The Worker stores a readable Issue body plus one `elpa-submission-v3` machine-readable marker. It never includes the Turnstile token in the Issue.

No independent advice-only submission protocol or v1/v2 compatibility is supported. To share experience, submit a question with optional advice in the same Issue. Campus and track always apply to both.

Successful response: HTTP 201 with `{"ok":true,"issueUrl":"..."}`.

## Production settings

- Worker: `hkust-elpa-submissions` at `https://hkust-elpa-submissions.futseyi.workers.dev/submit`.
- Origins: `https://hkust-elpa.github.io` and `https://hkust-elpa.vercel.app` only.
- Turnstile action: `elpa_submit`; the hostname must match the request Origin.
- Rate limit: Cloudflare `SUBMISSION_LIMITER`, namespace `11247601`, 3 requests / 60 seconds / IP / edge location.
- Request size limit: 24,576 bytes.
- GitHub App secrets: `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8 PEM). The Worker signs an RS256 JWT and exchanges it for a short-lived token restricted to the Source repository and `Issues: write`. There is no PAT fallback.
- `TURNSTILE_SECRET` and all GitHub App credentials must remain Cloudflare Secrets, never repository files.
- `SUBMISSION_MODE=public` and `SUBMISSIONS_DISABLED=false` open submissions. Missing credentials or invalid mode fail closed.

The repository `worker/wrangler.jsonc` defaults to closed mode for local deployments. **Preserve the production bindings and explicitly verify the mode after each deployment.**

## Review and publication

One Issue represents one assessment domain, and can include question content plus preparation experience. An Issue workflow assigns domain labels and mentions the corresponding Team. A member of the designated Team or organization Owner can approve by closing as completed. The GitHub App commits approved Source data and the existing Source→Published pipeline deploys the site.

See [moderation](../question-bank/MODERATION.md).
