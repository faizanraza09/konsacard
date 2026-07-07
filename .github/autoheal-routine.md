# Daily-refresh auto-heal routine — setup (pending)

The auto-heal **playbook** (`.github/autoheal-playbook.md`) is committed and ready.
What's left is to create the scheduled cloud agent (routine) that runs it. This was
intentionally deferred until the GitHub account is connected.

## One prerequisite (blocks routine creation)

The cloud agent needs write access to this repo (push branches, open PRs, dispatch
workflows). Connect it once:

- In Claude Code, run **`/web-setup`** to sync GitHub credentials, **or**
- Install the **Claude GitHub App**: https://claude.ai/code/onboarding?magic=github-app-setup

Until this is done, creating the routine returns HTTP 401
("Connect your GitHub account before saving a routine that uses a GitHub repository").

## Create the routine (after connecting GitHub)

Ask Claude Code: **"create the daily-refresh-autoheal routine from .github/autoheal-routine.md"**,
or run the `schedule` skill. Use this exact config:

- **Name:** `daily-refresh-autoheal`
- **Schedule (cron, UTC):** `15 7 * * *` — 07:15 UTC daily (~1h after the 06:17 UTC
  refresh cron, so the refresh run has finished). 07:15 UTC = 12:15 PKT / 11:15 Asia/Dubai.
- **Model:** `claude-sonnet-5` (the playbook is prescriptive; the accuracy-sensitive
  step is gated behind a human-reviewed PR). Upgrade to Opus if desired.
- **Repo:** `https://github.com/faizanraza09/konsacard`
- **Allowed tools:** `Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch`
  (WebSearch/WebFetch are required for requirements research.)
- **Prompt:** "Read `.github/autoheal-playbook.md` and follow it exactly." plus the
  self-contained summary that was drafted for the create call (triage the latest
  `daily-refresh.yml` run; if it failed on the new-unmatched-card gate, do the safe
  known-unmatched unblock on main+dev, re-run to green, and open a PR with researched
  real requirements; for any other gate, comment on the issue and stop; never fabricate
  fees/salaries).

## Behavior recap (what it will do)

- Refresh not failed → no-op.
- Failed on **new-unmatched-card** gate → auto-unblock (known-unmatched, pushed to
  main+dev) + re-run to green, then a **PR** (never auto-merged) with the real,
  sourced requirements. Mirrors the manual fix in commits `3987296` (AL Habib
  Platinum record) and `710cdaa` (Faysal PayPak records).
- Any **other** gate → comment on the failure issue and stop (needs a human).

## Optional upgrade: event-driven (GitHub Actions)

Instead of a 07:15 poll, trigger on failure via a `workflow_run` workflow that runs
Claude Code headless. Needs an `ANTHROPIC_API_KEY` repo secret. Not set up yet — ask
for it when you want the event-driven version.
