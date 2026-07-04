# Cloud Agents & Cursor Automations Setup

This repo includes all **in-repo** Cursor agent configuration. Complete these **dashboard steps** once to activate cloud agents, Bugbot, and security automations.

## What is already in this repo

| Path | Purpose |
|------|---------|
| `.cursor/agents/` | orchestrator, classifier, ios-patcher, android-patcher, verifier, security-reviewer |
| `.cursor/skills/` | detect-diff, classify-change, generate-fix, run-pipeline |
| `.cursor/rules/` | design-diplomat, swift-ios, kotlin-android |
| `.cursor/BUGBOT.md` | PR review rules |
| `.cursor/environment.json` | Cloud VM install/start commands |
| `engine/` | Detect + classify API |
| `dashboard/` | Verdict console UI |

---

## Step 1 — Connect GitHub (required)

1. Open [cursor.com/dashboard](https://cursor.com/dashboard)
2. **Integrations → GitHub** → install app on **Thinkr1/Unitem**
3. Grant access to the repo

---

## Step 2 — Cloud Agent environment

1. Go to [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)
2. **New environment** → link repo `Thinkr1/Unitem`
3. Cursor reads `.cursor/environment.json` automatically
4. **Secrets** (add in dashboard):
   - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (for classifier LLM calls)
   - `GITHUB_TOKEN` (if PR creation needs elevated scope)

### Multi-repo (when sample apps split to separate repos)

Add both repos to one environment:
- `Thinkr1/Unitem` (monorepo today)
- Later: `Thinkr1/unitem-ios` + `Thinkr1/unitem-android`

---

## Step 3 — Enable Bugbot (REVIEW stage)

1. [cursor.com/dashboard/bugbot](https://cursor.com/dashboard) → enable for `Thinkr1/Unitem`
2. Settings:
   - Run on: **every push** to PR branches
   - Include draft PRs: **yes** (for hackathon iteration)
3. Bugbot reads `.cursor/BUGBOT.md` automatically

**Local pre-push (optional):**
```
/review-bugbot
```

---

## Step 4 — Security automations (SECURE stage)

1. [cursor.com/dashboard/automations](https://cursor.com/dashboard/automations)
2. **New automation:**
   - **Trigger:** Pull request opened or updated
   - **Action:** Security Reviewer
   - **Repos:** `Thinkr1/Unitem`
3. Optional cron: Vulnerability Scanner weekly on `main`

**Local pre-push:**
```
/review-security
```

---

## Step 5 — Pipeline automation (SCALE stage)

Create an automation for the propagate demo:

| Field | Value |
|-------|-------|
| Name | Design Diplomat Sync |
| Trigger | Push to branch matching `sync/*` OR manual |
| Prompt | See below |

**Automation prompt (copy-paste):**

```
Run the Design Diplomat pipeline for the Settings screen.

1. Read engine/screen-map.json and knowledge-base/conventions.yaml
2. Invoke orchestrator subagent
3. Detect atomic changes from git diff on sample-ios/ or sample-android/
4. Classify each change (classifier subagent)
5. For propagate/flag verdicts, apply patch via android-patcher or ios-patcher
6. Invoke verifier subagent
7. Open PR with ticket JSON in description
8. Do not edit files outside screen-map.json

Branch: sync/propagate-* or sync/flag-*
```

---

## Step 6 — Run your first cloud agent manually

1. Open [cursor.com/agents](https://cursor.com/agents)
2. **New agent** → select environment `Unitem`
3. Paste:

```
/run-pipeline

Run Design Diplomat token pipeline for Settings screen.
Call POST /api/pipeline after starting engine, or run:
cd engine && pip install -r requirements.txt && python -m engine.detect --screen Settings

Classify results with classifier subagent.
For propagate verdict on brand.primary color, generate Android patch and open PR.
```

4. Enable **Auto-create PR**

---

## Step 7 — Local dev (BUILD stage)

```bash
# Terminal 1 — engine
cd engine && pip3 install -r requirements.txt && python3 -m uvicorn main:app --reload --port 8000

# Terminal 2 — dashboard
cd dashboard && npm install && npm run dev
```

Open http://localhost:3000 → **Run pipeline**

---

## Step 8 — iOS (Mac teammate)

Cloud agents on Linux **cannot** run Xcode. iOS builds stay on Mac:

- **Option A:** Mac teammate runs simulator + uploads screenshots to `dashboard/public/screenshots/ios/`
- **Option B:** [My Machines](https://cursor.com/docs/cloud-agent/setup.md) self-hosted Mac pool (if available on your plan)
- **Option C:** Xcode MCP on local Mac (`xcrun mcpbridge`)

---

## Agent quick reference

| Invoke | When |
|--------|------|
| `/orchestrator` | Full end-to-end pipeline |
| `/classifier` | Single atomic change verdict |
| `/android-patcher` | Apply Kotlin fix after propagate |
| `/ios-patcher` | Apply Swift fix after propagate |
| `/verifier` | Build + screenshot check |
| `/review-bugbot` | Pre-push review |
| `/review-security` | Pre-push security |
| `/in-cloud` | Hand current task to cloud agent |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Cloud agent can't find engine | Check `.cursor/environment.json` install command |
| Bugbot not commenting | Confirm GitHub app installed on repo |
| Dashboard API error | Start engine on port 8000 |
| iOS build fails in cloud | Expected — use Mac for iOS |
| Move to Cloud loses edits | Commit and push before handoff |
