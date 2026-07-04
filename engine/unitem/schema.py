"""Pydantic models — the single source of truth for every data shape in Unitem.

Everything that crosses a boundary (LLM output, tickets.json, mapping.json,
overrides.jsonl, the UI API) is one of these models. Adapters live at the
edges (api.py); nothing else redefines shapes.
"""
from __future__ import annotations

import hashlib
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Verdict = Literal["propagate", "hold", "flag"]
Platform = Literal["ios", "android"]
ChangeKind = Literal["token", "component", "style", "screen", "copy"]
Category = Literal[
    "color",
    "spacing",
    "typography",
    "layout",
    "component",
    "navigation",
    "content",
    "accessibility",
    "missing-screen",
]
Severity = Literal["high", "medium", "low"]
TicketStatus = Literal["pending", "accepted", "overridden"]


class Location(BaseModel):
    file: str
    line: int


class AtomicChange(BaseModel):
    """One design-relevant change (diff mode) or cross-platform difference (audit mode)."""

    id: str = ""
    kind: ChangeKind
    category: Category
    name: str  # e.g. "color.brandPrimary"
    before: Optional[str] = None
    after: str
    origin_platform: Platform
    location: Location  # on the origin platform
    counterpart_location: Optional[Location] = None  # same fact on the other platform
    snippet: str = ""  # a few lines of origin code around the change

    def model_post_init(self, __context) -> None:
        if not self.id:
            raw = f"{self.kind}|{self.name}|{self.before}|{self.after}|{self.origin_platform}"
            self.id = "chg-" + hashlib.sha1(raw.encode()).hexdigest()[:8]


class ProposedFix(BaseModel):
    target_platform: Platform
    file: str
    diff: str  # unified diff text


class JudgeResponse(BaseModel):
    """Exactly what the LLM must emit — nothing more (extra keys are rejected)."""

    model_config = ConfigDict(extra="forbid")

    verdict: Verdict
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str
    convention_refs: list[str]
    expected: Optional[str] = None  # flag only: the correct value per the rulebook


class Ticket(BaseModel):
    """Canonical engine record — one per finding (ARCHITECTURE.md §7 tickets.json)."""

    id: str  # "UNI-001" — stable across re-runs (aggregate.assign_ids)
    mode: Literal["audit", "diff"]
    category: Category
    change: AtomicChange
    verdict: Verdict
    severity: Severity
    confidence: float
    reason: str
    convention_refs: list[str]
    expected: Optional[str] = None
    proposed_fix: Optional[ProposedFix] = None
    status: TicketStatus = "pending"
    pr_url: Optional[str] = None


class TicketFile(BaseModel):
    run_id: str
    mode: Literal["audit", "diff"]
    screen: str
    tickets: list[Ticket]


class ScreenMapping(BaseModel):
    feature: str
    ios: list[str]
    android: list[str]
    confidence: float = 1.0
    status: Literal["auto", "confirmed", "overridden"] = "auto"
    one_sided: bool = False


class Mapping(BaseModel):
    screens: list[ScreenMapping]


class OverrideRecord(BaseModel):
    """One human correction — appended to overrides.jsonl, replayed as precedent."""

    ticket_id: str
    change_name: str
    category: Category
    engine_verdict: Verdict
    human_verdict: Verdict
    note: Optional[str] = None
    timestamp: str


class Rule(BaseModel):
    """One convention-KB entry (conventions/conventions.yaml)."""

    id: str
    verdict: Verdict
    applies_to: list[str]
    when: str
    why: str
    examples: list[str] = []
