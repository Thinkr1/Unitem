# Unitem — Design Diplomat

AI reasoning layer that keeps **iOS (Swift)** and **Android (Kotlin)** in sync: **propagate**, **hold**, or **flag** each change.

## Quick start

```bash
# Engine API
cd engine && pip3 install -r requirements.txt && python3 -m uvicorn main:app --reload --port 8000

# Dashboard (separate terminal)
cd dashboard && npm install && npm run dev
```

Open http://localhost:3000 and click **Run pipeline**.

## Cloud agents

All Cursor agent config lives in `.cursor/`. **Dashboard activation steps:** [docs/08-cloud-agents-setup.md](docs/08-cloud-agents-setup.md)

| Stage | Config |
|-------|--------|
| PLAN | Plan mode + `docs/04-scope-plan-risks.md` |
| DESIGN | `dashboard/` side-by-side console |
| BUILD | `.cursor/agents/orchestrator.md` + `engine/` |
| SCALE | Cloud agents + `run-pipeline` skill |
| REVIEW | `.cursor/BUGBOT.md` |
| SECURE | `security-reviewer` agent |

## Docs

- [Project overview](docs/02-project-overview.md)
- [Architecture](docs/03-architecture.md)
- [Team setup](docs/05-team-setup.md)
- [Convention KB](docs/06-convention-knowledge-base.md)
- [Cloud agents setup](docs/08-cloud-agents-setup.md)

## Demo scope

One screen (Settings), three scenarios: propagate / hold / flag. See `engine/screen-map.json`.
