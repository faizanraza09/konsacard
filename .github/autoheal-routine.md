# Daily-refresh auto-heal — setup

The **playbook** (`.github/autoheal-playbook.md`) is committed and rewritten against the
2026-08-19 → 2026-09-08 outage, and the **browser problem is solved**. What remains is
arming the agent that runs it. There are two routes; **route A needs no admin and is the
recommended one.**

## Status (2026-09-08)

| Piece | State |
|---|---|
| Playbook, gate-by-gate repair procedure | ✅ committed |
| Browser access to bot-walled bank sites | ✅ `fetch-walled-sources.yml`, proven on a runner (run 34240320095) |
| Offline rehearsal harness for every strict gate | ✅ playbook section 6 |
| **Route A** — GitHub Actions (`autoheal.yml`) | ⚠️ committed, waiting on one repo secret |
| **Route B** — cloud routine + webhook | ❌ blocked: needs a Whiteshield org Owner (see below) |

---

## Route A — GitHub Actions (recommended)

`.github/workflows/autoheal.yml` runs Claude Code headless. It fires on
`workflow_run` the moment a **Daily offers refresh** run concludes as `failure`, plus a
07:15 UTC scheduled check (which also catches the refresh cron not firing at all — the
failure mode a webhook is blind to), plus manual dispatch.

**Two commands to arm it:**

```bash
claude setup-token                     # prints a long-lived subscription token
gh secret set CLAUDE_CODE_OAUTH_TOKEN  # paste it at the prompt (keeps it out of shell history)
```

Until that secret exists the job exits cleanly with a notice, so an unarmed auto-heal never
turns into a wall of failed runs.

Notes:
- The token is tied to whoever runs `claude setup-token` — currently a **Whiteshield Team**
  subscription being used on a personal repo. Decide whether that is acceptable; the
  alternative is `ANTHROPIC_API_KEY` from https://platform.claude.com, which bills API
  credits and is not tied to one person.
- Model is pinned to `claude-opus-5` in `claude_args`. The judgement calls are the value:
  reading a scanned schedule from a page render, noticing a replacement fee sitting in a
  supplementary field, catching a card tier the feed invented.
- **A push made with `GITHUB_TOKEN` does not trigger other workflows**, so CI (including
  the mobile ranking-parity job) will not vet the agent's commit. The prompt tells it to
  verify parity itself; that is why regenerating `data/summary.json` in the same commit is
  mandatory rather than merely advisable.
- Permissions are scoped to what the playbook needs: `contents: write` (push), `issues:
  write` (comment/close), `actions: write` (re-run the refresh, dispatch the fetch helper).

---

## Route B — scheduled cloud routine

A cloud routine (`/schedule`) needs the claude.ai account linked to GitHub. Creating one
currently fails:

```
HTTP 401  Connect your GitHub account before saving a routine that uses a GitHub repository.
```

On this account that link requires **org action**, because the Claude account is a
**Team** plan (`Whiteshield`), not a personal one:

1. An Owner enables the GitHub connector at https://claude.ai/admin-settings/connectors —
   required for the browser authorization flow.
2. Then either authorize GitHub at https://claude.ai/code, or run **`/web-setup`** inside
   the `claude` CLI. Note `/web-setup` is **hidden on Team/Enterprise** until an Owner also
   enables "Quick web setup" at https://claude.ai/admin-settings/claude-code — which is why
   the command appears not to exist.
3. Verify at https://github.com/settings/applications → Claude → Configure (check this repo
   is in scope), and https://claude.ai/code/routines.

Also note: a Zero Data Retention policy blocks cloud sessions entirely, routines included.

(The old `https://claude.ai/code/onboarding?magic=github-app-setup` link in these notes was
outdated — there is no magic-link flow; use https://claude.ai/code.)

Once linked, ask Claude Code to **"create the daily-refresh-autoheal routine from
.github/autoheal-routine.md"**. Config, ready to fire:

- **Name:** `daily-refresh-autoheal`
- **Schedule:** `cron_expression: "15 7 * * *"` (07:15 UTC = 12:15 PKT) as the safety net
- **Model:** `claude-opus-5`
- **Environment:** `env_01QafgNWkQVEMVj1ALEXUCko` (`Default`, anthropic_cloud)
- **Repo source:** `https://github.com/faizanraza09/konsacard`
- **Allowed tools:** `Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch`
- **Autonomy:** full — pushes to `main` + `dev` and re-runs the pipeline, no PR step
- **Prompt:** the same entry point as the `prompt:` block in
  `.github/workflows/autoheal.yml` — keep the two in step if you edit one
- **Then:** `RemoteTrigger` → `create_webhook_trigger`, GitHub source scoped to this repo,
  event `workflow_run` filtered to `daily-refresh.yml` concluding `failure`, firing that
  routine, so it reacts on failure instead of waiting for 07:15.

Routes A and B do the same work; running both would just duplicate effort. Pick one.

---

## What it will do

- Refresh green → no-op.
- **New bank in the feed** → verify it is real, add to `optional_banks`, wire up logo,
  apply URL and the hardcoded counts, bridge its cards, push, re-run to green. This is the
  gate that caused the 21-day outage and that the old playbook refused to touch.
- **New unmatched card** → alias, or a sourced record, or known-unmatched if genuinely
  unsourceable; push, re-run to green.
- **Stale ranking summary** → regenerate and push.
- **Feed volume / floor / restaurant-loss / SEO determinism failure** → comment the
  evidence and stop. Those are feed or code faults and must not be papered over.
- Never invents a financial figure. Unsourceable ⇒ `null` + `bank_gaps` + flagged to a
  human.
