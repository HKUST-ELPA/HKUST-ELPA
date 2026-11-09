# ELPA review and publication

## Four domain teams

| Campus | Assessment | Team |
| --- | --- | --- |
| `gz` | `regular` | `gz-regular-reviewers` |
| `gz` | `fast-track` | `gz-fast-track-reviewers` |
| `hk` | `regular` | `hk-regular-reviewers` |
| `hk` | `fast-track` | `hk-fast-track-reviewers` |

Each Team has **Triage** access to Source, not code write access or Published access. All four Teams may view and manage repository Issues, but **only members of the corresponding Team or an organization Owner can authorize publication**. GitHub itself does not provide per-Issue Triage boundaries.

## Submission lifecycle

1. A student submits a question, optionally with preparation advice. Both share a required campus and assessment type.
2. The Cloudflare Worker verifies Turnstile and rate limiting, creates one Issue with a single GitHub App-signed `elpa-submission-v3` payload, and labels it `submission:pending`.
3. An `issues: opened` workflow derives `campus` and `track` from the verified signed payload, adds `campus:*` and `track:*` labels, and posts one structured GitHub-native notification mentioning the designated Team. The notification includes campus, assessment, term, stage, source, bilingual question, follow-ups, optional advice, and approval instructions. Reruns do not duplicate notifications.
4. A reviewer checks the original content, accuracy, privacy, duplicates and references.
5. **Close as completed** requests publication; **Close as not planned** rejects. Reopening restores pending status but does not undo published data.
6. On completed closure, the workflow verifies the App-created Issue, its signed payload, and the authenticated event sender against the corresponding Team Membership API or organization Owner membership. It fails closed when authorization cannot be established. Unauthorized approvals are reopened.
7. The importer validates the v3 schema, updates only allowlisted JSON/Markdown files and reuses an existing canonical question ID if the wording matches within the same domain; otherwise it allocates the next domain-local ID.
8. Source validations run before a GitHub App commit. Source publishes to Published; GitHub Pages and Vercel deploy Published `main`.

**Publication identity:** one GitHub App handles Worker Issue creation, review commits and cross-repository publishing using separately scoped short-lived Installation Tokens. The review action requests `Contents: write`, `Issues: write` and organization `Members: read`; the GitHub App installation must have these permissions approved. The Worker requests only Source `Issues: write`.

## Data integrity

- Structured payloads use only `version:3`. No legacy v1/v2 import paths.
- Canonical campus values are `gz/hk`; assessment values are `regular/fast-track`. Title and labels are for discoverability, **not authorization**.
- The GitHub event identifies the reviewer; Team membership is verified in GitHub at the time of approval.
- Combined question and advice are reviewed together, preserving one source Issue.
- Issue numbers are provenance, not question IDs.
- Duplicate Issue processing is idempotent; `TEST ONLY` Issues are never published.
- Changes are limited by `scripts/check-submission-diff.cjs`; concurrent approvals are serialized and retried against the latest `main` without force-push.
- `submission:published` means Source has recorded the content; deploy status must be checked separately.
- Disallow untrusted member edits to code by retaining Triage permissions for reviewers.
