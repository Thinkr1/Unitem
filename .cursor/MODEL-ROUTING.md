# Model routing & task switching

> Research-backed routing for Unitem agents. Cursor subagent `model:` in frontmatter is the
> source of truth; parent agents must **delegate** with the matching subagent name so routing applies.
> Known Cursor bug: parent may override subagent model — workarounds below.

## Routing table

| Task | Subagent / skill | Model | Why |
|------|------------------|-------|-----|
| Pipeline orchestration | `/orchestrator` | `claude-4.6-sonnet-high-thinking` | Multi-step planning, verdict routing |
| Scope gate | `scope-check` | **No LLM** (deterministic) | Product/file alignment |
| Discover / diff | `detect-diff` | **No LLM** | tree-sitter + regex |
| Fast verdict | `fast-judge` | **No LLM** | Convention rule match |
| Ambiguous judgment | `/classifier` | `claude-4.6-sonnet-high-thinking` | Taste / hold explanations |
| Swift patch | `/ios-patcher` | `composer-2.5` | Fast code gen |
| Kotlin patch | `/android-patcher` | `composer-2.5` | Fast code gen |
| Build verify | `/verifier` | `composer-2.5` | Shell + structured report |
| Repo exploration | Task `explore` | `fast` (built-in) | Parallel search |
| PR review | `/review-bugbot`, security | inherit or fast | Checklist-driven |

## Task-switching rules (orchestrator MUST follow)

```
1. scope-check          → if !aligned, STOP and report flags
2. detect-diff          → atomic_changes[]
3. FOR EACH change:
     fast-judge         → if resolved, SKIP classifier
     ELSE /classifier   → one call per unresolved change
4. PARALLEL reconcile:
     propagate/flag     → patcher (ios OR android, not both unless needed)
     hold               → NO patcher
5. /verifier            → after each applied patch
6. emit tickets.json    → UI / examples/login-demo-full-flow.json shape
```

**Never** use the thinking model for: file search, gradle build, deterministic rule lookup.

**Never** use composer for: hold-reason prose that needs HIG/Material taste (classifier only).

## Parallelism

- Classifier fan-out: parallel only for changes where `fast-judge` returned `needs_llm`
- Patchers: parallel only when iOS and Android both need independent fixes (rare in demo)

## Cursor workarounds (F6)

From Cursor docs + community reports (July 2026):

1. Set `model:` explicitly in `.cursor/agents/*.md` frontmatter (done).
2. Parent orchestrator should invoke subagents **by name** (`/classifier`, not generic Task).
3. If model is ignored: omit `model:` to inherit parent, or enable Max Mode on parent chat.
4. For cheap exploration: use built-in `explore` subagent with `model: fast`.
5. Log which model ran in ticket metadata when debugging cost.

## Inject into every orchestrator run

When spawning subagents, include in the handoff prompt:

```
Model routing: fast-judge BEFORE classifier. Classifier ONLY for unresolved changes.
Patcher: composer-2.5. Do not re-classify fast-judge resolved items.
```

## Research basis

- **Deterministic routing before LLM** — BSWEN 2026, MLflow agents 2026, OpenClaw Lobster pattern
- **Subagent model per task** — Cursor docs: inherit vs specific model ID; faster models for isolated subtasks
- **Compiled vs interpreted** — resolve rules in code/YAML first; LLM only for ambiguity (arxiv Compiled AI 2026)
