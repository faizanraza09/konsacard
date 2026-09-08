# Daily-refresh auto-heal routine — setup

The **playbook** (`.github/autoheal-playbook.md`) is committed, rewritten against the
2026-08-19 → 2026-09-08 outage, and the **browser problem is solved** (see below).
What is still missing is the scheduled cloud agent that runs it, and it is blocked on one
account-level action.

## Status (2026-09-08)

| Piece | State |
|---|---|
| Playbook, gate-by-gate repair procedure | ✅ committed |
| Browser access to bot-walled bank sites | ✅ `fetch-walled-sources.yml`, proven on a runner (run 34240320095) |
| Offline rehearsal harness for every strict gate | ✅ in playbook section 6 |
| Cloud routine `daily-refresh-autoheal` | ❌ blocked: HTTP 401, GitHub account not connected |
| GitHub webhook trigger (fire on failure) | ❌ blocked by the same thing |

## The one blocker

Creating the routine returns:

```
HTTP 401  Connect your GitHub account before saving a routine that uses a GitHub repository.
```

The cloud agent needs write access to this repo (push to main and dev, dispatch workflows,
comment on issues). Connect it once, either way:

- in Claude Code, run **`/web-setup`**, or
- install the **Claude GitHub App**: https://claude.ai/code/onboarding?magic=github-app-setup

This was also the blocker in July 2026; nothing else about the setup is outstanding.

## Create it (after connecting GitHub)

Ask Claude Code: **"create the daily-refresh-autoheal routine from .github/autoheal-routine.md"**.
The call is ready to fire as-is:

- **Name:** `daily-refresh-autoheal`
- **Schedule:** `cron_expression: "15 7 * * *"` (07:15 UTC daily = 12:15 PKT), a safety net
  ~1h after the 06:17 UTC refresh cron. The primary trigger is the webhook below.
- **Model:** `claude-opus-5`. The judgement calls are the whole value: reading a scanned
  schedule from a page render, noticing a replacement fee sitting in a supplementary
  field, catching a card tier the feed invented.
- **Environment:** `env_01QafgNWkQVEMVj1ALEXUCko` (`Default`, anthropic_cloud)
- **Repo source:** `https://github.com/faizanraza09/konsacard`
- **Allowed tools:** `Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch`
- **Autonomy:** full — pushes verified fixes to `main` + `dev` and re-runs the pipeline. No
  PR step. The hard rule is unchanged: any figure it cannot source from an official
  document stays `null` with a `bank_gaps` note.
- **Prompt:** the entry point that routes into the playbook — triage the latest
  `daily-refresh.yml` run; no run in ~26h means the cron itself stopped, so comment and
  stop; heal gates 2A/2B/2F, comment-and-stop on 2C/2D/2E; never invent a figure; dispatch
  `fetch-walled-sources.yml` for walled banks and read the renders; rehearse offline;
  regenerate `summary.json` in the same commit as any requirements change; push both
  branches without racing the refresh workflow; re-run to green; comment, close, and say
  what was left for a human.

Then attach the event source so it fires on failure rather than waiting for 07:15:

- `RemoteTrigger` → `create_webhook_trigger`, source GitHub, scope this repository,
  event `workflow_run` filtered to `daily-refresh.yml` concluding `failure`, firing
  `routine_trigger_id` = the routine created above.

## What it will do

- Refresh green → no-op.
- **New bank in the feed** → verify it is real, add to `optional_banks`, wire up logo +
  apply URL + counts, bridge its cards, push, re-run to green. (This is the gate that
  caused the 21-day outage and that the old playbook refused to touch.)
- **New unmatched card** → alias, or a sourced record, or known-unmatched if genuinely
  unsourceable; push, re-run to green.
- **Stale ranking summary** → regenerate and push.
- **Feed volume / floor / restaurant-loss / SEO determinism failures** → comment the
  evidence and stop. These are feed or code faults and must not be papered over.

## Fallback if the GitHub connection is not wanted

An event-driven GitHub Action running Claude Code headless (`workflow_run` on
`daily-refresh.yml` failure) would need an `ANTHROPIC_API_KEY` repo secret instead of the
GitHub connection, and bills to API credits rather than the subscription. Not set up.
