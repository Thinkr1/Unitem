# 09 — Live Flow Side Doc

Use this as the side document while running or presenting Unitem. It shows the
pipeline, where agents talk to each other, where lag can appear, and where a
human can steer focus without breaking the core `propagate | hold | flag`
contract.

## Whole project flow

```mermaid
flowchart LR
    subgraph Inputs["Inputs and memory"]
        Git["Git diff, branch, or audit target"]
        IOS["iOS screen slice"]
        Android["Android screen slice"]
        KB["conventions.yaml"]
        Spec["agent.md"]
        Overrides["overrides.jsonl"]
        MappingOverrides["mapping.overrides.yaml"]
    end

    subgraph Engine["Deterministic engine"]
        Discover["1. discover<br/>tree-sitter + regex facts"]
        Map["2. map<br/>path, route, string-key similarity"]
        Retrieve["retrieve only matching slices<br/>counterpart code + matching rules"]
        Validate["schema validation<br/>retry invalid JSON"]
        Dedupe["dedupe + stable ticket IDs"]
    end

    subgraph Agents["Bounded agent work"]
        Mapper["Mapper agent<br/>ambiguous pairs only"]
        JudgePool["Judge fan-out<br/>one classifier per change or section"]
        Critic["Optional critic<br/>low-confidence review"]
        Fixer["Fixer cloud agent<br/>target repo edit + build + PR"]
        Verifier["Verifier<br/>compile + visual check"]
    end

    subgraph Review["Human review console"]
        Tickets["tickets.json<br/>verdict cards"]
        UI["/UI console<br/>iOS code | verdicts | Android code"]
        Human["Human accepts, overrides, or narrows focus"]
        Memory["write override memory<br/>future few-shot precedent"]
    end

    subgraph Outcomes["Outcomes"]
        Propagate["propagate<br/>counterpart PR"]
        Hold["hold<br/>explain correct platform difference"]
        Flag["flag<br/>one-line fix or low-confidence ticket"]
    end

    Git --> Discover
    IOS --> Discover
    Android --> Discover
    KB --> Retrieve
    Spec --> Retrieve
    Overrides --> Retrieve
    MappingOverrides --> Map
    Discover --> Map
    Map -->|ambiguous only| Mapper
    Mapper --> Map
    Map --> Retrieve
    Retrieve --> JudgePool
    JudgePool --> Validate
    Validate -->|invalid| JudgePool
    Validate -->|low confidence| Critic
    Critic --> Validate
    Validate --> Dedupe
    Dedupe --> Tickets
    Tickets --> UI
    UI --> Human
    Human -->|override| Memory
    Memory --> Overrides
    Human -->|accept propagate or flag| Fixer
    Fixer --> Verifier
    Verifier --> Tickets
    JudgePool --> Propagate
    JudgePool --> Hold
    JudgePool --> Flag
    Propagate --> Fixer
    Flag --> Fixer
    Hold --> Tickets

    classDef fast fill:#0f766e,color:#ffffff,stroke:#134e4a,stroke-width:1px;
    classDef watch fill:#f59e0b,color:#111827,stroke:#92400e,stroke-width:2px;
    classDef hot fill:#dc2626,color:#ffffff,stroke:#7f1d1d,stroke-width:2px;
    classDef human fill:#7c3aed,color:#ffffff,stroke:#4c1d95,stroke-width:2px;
    classDef data fill:#2563eb,color:#ffffff,stroke:#1e3a8a,stroke-width:1px;

    class Discover,Retrieve,Validate,Dedupe fast;
    class Map,Mapper,JudgePool,Fixer,Verifier watch;
    class Critic hot;
    class UI,Human,Memory human;
    class Git,IOS,Android,KB,Spec,Overrides,MappingOverrides,Tickets data;
```

Legend:

- Green: deterministic and usually fast.
- Amber: watch for lag because it can fan out, wait on a model, build, or emulator.
- Red: intentional slowdown; only use when confidence is low or a live run is risky.
- Purple: human steering and memory updates.
- Blue: data contracts and context sources.

## Agent conversation map

```mermaid
sequenceDiagram
    autonumber
    participant Human
    participant Orchestrator
    participant Discover as Discover tool
    participant Mapper
    participant Classifier
    participant Generator
    participant Verifier
    participant UI as Review UI
    participant Memory as overrides.jsonl

    Human->>Orchestrator: Run audit or diff for a mapped screen
    Orchestrator->>Discover: Extract facts, changed tokens, strings, routes
    Discover-->>Orchestrator: Atomic facts and file locations
    Orchestrator->>Mapper: Reconcile only ambiguous iOS-Android pairs
    Mapper-->>Orchestrator: mapping.json candidates + confidence
    loop One change or mapped section at a time
        Orchestrator->>Classifier: facts + counterpart slice + KB + project spec + memory
        Classifier->>Classifier: Ask "should this change cross?"
        Classifier->>Classifier: Check convention_refs and confidence
        Classifier-->>Orchestrator: verdict, reason, confidence, convention_refs
    end
    Orchestrator->>UI: Emit tickets.json
    UI-->>Human: Show cards, linked code, reasons
    alt Human overrides
        Human->>Memory: Persist team taste as precedent
        Memory-->>Classifier: Future runs retrieve override first
    else Human accepts propagate or flag
        Human->>Generator: Dispatch fix into target platform repo
        Generator->>Verifier: Minimal edit, build, screenshot or compile check
        Verifier-->>UI: pass or fail status on ticket
    else Human accepts hold
        UI-->>Human: Keep explanation, no code edit
    end
```

## Lag and focus watch points

| Watch point | Why it can lag | What to listen for | Human focus move |
|---|---|---|---|
| `Map` | Similar paths/routes can be ambiguous across platforms. | "Which screen pair am I judging?" | Point the run at one mapped screen, or add `mapping.overrides.yaml`. |
| `Judge fan-out` | One classifier runs per atomic change or section. | "Which rule IDs support this verdict?" | Narrow to one change, cap concurrency, or ask for only low-confidence tickets. |
| `Schema validation` | Invalid agent JSON triggers retries. | "Did the response match `tickets.json`?" | Re-run with the exact schema and ask for JSON only. |
| `Critic` | A second opinion intentionally adds model latency. | "Is this a risky propagation?" | Enable only for low confidence or demo-critical tickets. |
| `Fixer cloud agent` | It edits another repo and waits for build/test loops. | "Which file changed and did it compile?" | Scope the fix to the mapped screen pair and request a minimal diff. |
| `Verifier` | Simulator/emulator or build setup can dominate runtime. | "Did the target platform actually render or build?" | Use mock runner or pre-captured screenshots when live devices are unavailable. |
| `Review UI` | Human review is where the system learns taste. | "Was the verdict accepted or overridden?" | Capture the reason in `overrides.jsonl` so the next run obeys it. |

## Focus feature prompts

Copy one of these when directing agents during a live run:

- **Narrow the room:** "Focus only on Login and only on the current atomic change;
  retrieve the counterpart slice and matching convention rules, not the whole repo."
- **Listen for rules:** "Before deciding, name the `convention_refs` you are using
  and say whether this is propagate, hold, or flag."
- **Expose lag:** "Report which stage is waiting: map, judge, schema retry, fixer,
  verifier, or human review."
- **Protect the demo:** "If confidence is low, return flag with low confidence and
  stop before generating code."
- **Use memory:** "Check `overrides.jsonl` first; if a human already decided a
  similar case, follow that precedent unless the current facts differ."

## Live run status overlay

Use this compact diagram beside terminal logs to mark the active stage.

```mermaid
stateDiagram-v2
    [*] --> Discovering
    Discovering --> Mapping: facts extracted
    Mapping --> Judging: mapped pair selected
    Mapping --> WaitingOnHuman: ambiguous mapping
    Judging --> Retrying: invalid JSON
    Retrying --> Judging: retry with schema
    Judging --> Reviewing: tickets.json emitted
    Reviewing --> Learning: human override
    Learning --> Judging: future precedent
    Reviewing --> Fixing: accept propagate or flag
    Reviewing --> Done: accept hold
    Fixing --> Verifying: edit committed
    Verifying --> Reviewing: build or visual result
    Verifying --> Done: verified PR or ticket
    WaitingOnHuman --> Mapping: override supplied
    Done --> [*]
```

## Side-doc usage

1. Keep this file open next to terminal output and the `/UI` console.
2. Mark the active stage from the status overlay while a run is live.
3. When a stage lags, use the matching row in "Lag and focus watch points."
4. When an agent answer feels vague, ask for the exact verdict, confidence,
   `convention_refs`, and the small code slice it used.
