# Cloud Agents & Cursor Automations Setup

This repo includes all **in-repo** Cursor agent configuration for **Unitem**.
`ARCHITECTURE.md` is the authoritative spec. This file covers the one-time
**dashboard steps** to activate cloud agents, Bugbot, and security automations.

## What is already in this repo

| Path | Purpose |
|------|---------|
| `.cursor/agents/` | orchestrator, scope-checker, classifier, ios-patcher, android-patcher, verifier, security-reviewer |
| `.cursor/skills/` | detect-diff, fast-judge, scope-check, classify-change, generate-fix, run-pipeline |
| `.cursor/MODEL-ROUTING.md` | Model per task + task-switching rules |
| `.cursor/rules/` | unitem (core), swift-ios, kotlin-android |
| `.cursor/BUGBOT.md` | PR review rules |
| `.cursor/environment.json` | Cloud VM install/start commands |
| `.cursor/cloud-agent-prompts.md` | copy-paste prompts for cursor.com/agents |

> The **engine** (`/engine` unitem package) and **sample apps** are built by the
> architecture owner per `ARCHITECTURE.md` §10. The `/UI` review console already
> exists. This config wraps that work — it does not duplicate it.

---

## Step 1 — Connect GitHub (required)

1. Open [cursor.com/dashboard](https://cursor.com/dashboard)
2. **Integrations → GitHub** → install the app on **Thinkr1/Unitem**

---

## Step 2 — Cloud Agent environment

1. Go to [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)
2. **New environment** → link repo `Thinkr1/Unitem`
3. Cursor reads `.cursor/environment.json` automatically (installs the `/UI` app;
   engine command is a placeholder until `/engine` lands).
4. **Secrets** (add in dashboard):
   - `ANTHROPIC_API_KEY` (Claude runner fallback) — the `cursor` runner is the default
   - `GITHUB_TOKEN` (if PR creation needs elevated scope)

---

## Step 3 — Enable Bugbot (REVIEW stage)

1. Dashboard → Bugbot → enable for `Thinkr1/Unitem`
2. Run on: **every push** to PR branches; include draft PRs (hackathon iteration)
3. Bugbot reads `.cursor/BUGBOT.md` automatically

Local pre-push: `/review-bugbot`

---

## Step 4 — Security automations (SECURE stage)

1. [cursor.com/dashboard/automations](https://cursor.com/dashboard/automations)
2. **New automation:** Trigger = PR opened/updated · Action = Security Reviewer · Repo = `Thinkr1/Unitem`
3. Optional cron: Vulnerability Scanner weekly on `main`

Local pre-push: `/review-security`

---

## Step 5 — Pipeline automation (SCALE stage)

| Field | Value |
|-------|-------|
| Name | Unitem Sync |
| Trigger | Push to branch matching `sync/*` OR manual |
| Prompt | See `.cursor/cloud-agent-prompts.md` (full pipeline) |

---

## Step 6 — Run your first cloud agent

1. Open [cursor.com/agents](https://cursor.com/agents) → **New agent** → environment `Unitem`
2. Paste the full-pipeline prompt from `.cursor/cloud-agent-prompts.md`
3. Enable **Auto-create PR**

---

## Step 7 — Local dev

```bash
# UI review console (already built)
cd UI && npm install && npm run dev

# Engine (once /engine exists — ARCHITECTURE.md §10)
cd engine && pip3 install -e . && python3 -m unitem.api   # FastAPI on :8787
```

The `/UI` app talks to the engine per `ARCHITECTURE.md` §7:
`GET /comparison?screen=login`, `POST /findings/{id}/accept`, `POST /findings/{id}/override`.

---

## Step 8 — iOS builds (Mac only)

Linux cloud VMs **cannot** run Xcode. iOS builds stay on Mac:

- **Option A:** Mac teammate runs the simulator + uploads screenshots
- **Option B:** [My Machines](https://cursor.com/docs/cloud-agent/setup.md) self-hosted Mac pool
- **Option C:** Xcode MCP on the local Mac (`xcrun mcpbridge`)

Android patching + PR creation run fully in the cloud.

---

## Agent quick reference

| Invoke | When |
|--------|------|
| `/orchestrator` | Full end-to-end pipeline (audit or diff) |
| `/classifier` | Single change → propagate/hold/flag verdict |
| `/android-patcher` / `/ios-patcher` | Apply the counterpart fix |
| `/verifier` | Build + screenshot check |
| `/review-bugbot` / `/review-security` | Pre-push review |
| `/in-cloud` | Hand the current task to a cloud agent |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bugbot not commenting | Confirm the GitHub app is installed on the repo |
| Move to Cloud loses edits | Commit and push before handoff (cloud sees git state only) |
| iOS build fails in cloud | Expected — use a Mac for iOS |
| Engine endpoints 404 | Engine not built yet — see `ARCHITECTURE.md` §10 |
