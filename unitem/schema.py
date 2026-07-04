"""Pydantic models: the contracts shared across the pipeline.

These models define the artifacts that flow between stages (inventory ->
mapping -> findings -> tickets). ``tickets.json`` in particular is the handoff
contract consumed by the downstream PR-dispatch phase, so keep it stable and
additive.
"""

from __future__ import annotations

import hashlib
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Platform(str, Enum):
    IOS = "ios"
    ANDROID = "android"


class Stack(str, Enum):
    """UI technology a file belongs to."""

    SWIFTUI = "swiftui"
    UIKIT = "uikit"
    OBJC = "objc"
    COMPOSE = "compose"
    ANDROID_XML = "android_xml"
    FLUTTER = "flutter"
    UNKNOWN = "unknown"


PLATFORM_OF_STACK = {
    Stack.SWIFTUI: Platform.IOS,
    Stack.UIKIT: Platform.IOS,
    Stack.OBJC: Platform.IOS,
    Stack.COMPOSE: Platform.ANDROID,
    Stack.ANDROID_XML: Platform.ANDROID,
    # Flutter is cross-platform; it is assigned to whichever tree it is found in.
    Stack.FLUTTER: None,
}


class Category(str, Enum):
    SPACING = "spacing"
    LAYOUT = "layout"
    TYPOGRAPHY = "typography"
    COLOR = "color"
    COMPONENT = "component"
    NAVIGATION = "navigation"
    CONTENT = "content"
    ACCESSIBILITY = "accessibility"
    MISSING_SCREEN = "missing-screen"
    OTHER = "other"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingKind(str, Enum):
    """Whether a difference is a defect or an accepted platform divergence."""

    INCONSISTENCY = "inconsistency"
    EXPECTED_NATIVE = "expected-native"


class TicketStatus(str, Enum):
    OPEN = "open"
    TRIAGED = "triaged"
    DISMISSED = "dismissed"
    DISPATCHED = "dispatched"


class SourceFile(BaseModel):
    path: str
    platform: Platform
    stack: Stack
    is_ui: bool = False
    size_bytes: int = 0


class ScreenDescriptor(BaseModel):
    """A single UI screen/component discovered on one platform."""

    id: str
    platform: Platform
    name: str
    files: List[str] = Field(default_factory=list)
    stacks: List[Stack] = Field(default_factory=list)
    routes: List[str] = Field(default_factory=list)
    string_keys: List[str] = Field(default_factory=list)
    summary: Optional[str] = None


class Inventory(BaseModel):
    ios_screens: List[ScreenDescriptor] = Field(default_factory=list)
    android_screens: List[ScreenDescriptor] = Field(default_factory=list)
    files: List[SourceFile] = Field(default_factory=list)


class MappingEntry(BaseModel):
    """A correspondence between an iOS screen and an Android screen."""

    feature: str
    ios: List[str] = Field(default_factory=list, description="iOS file paths/globs")
    android: List[str] = Field(default_factory=list, description="Android file paths/globs")
    confidence: float = 0.0
    status: str = "auto"  # auto | override | unmatched
    note: Optional[str] = None


class Mapping(BaseModel):
    entries: List[MappingEntry] = Field(default_factory=list)
    unmatched_ios: List[str] = Field(default_factory=list)
    unmatched_android: List[str] = Field(default_factory=list)


class Location(BaseModel):
    platform: Platform
    file: str
    line: Optional[int] = None
    snippet: Optional[str] = None


class Finding(BaseModel):
    """A single raw observation emitted by an analysis agent."""

    feature: str
    category: Category
    severity: Severity
    kind: FindingKind
    title: str
    description: str
    rationale: Optional[str] = None
    suggested_fix: Optional[str] = None
    platforms: List[Platform] = Field(default_factory=list)
    locations: List[Location] = Field(default_factory=list)
    confidence: float = 0.5


class Ticket(BaseModel):
    """Deduplicated, stable-identified inconsistency ready for PR dispatch."""

    id: str
    feature: str
    category: Category
    severity: Severity
    title: str
    description: str
    rationale: Optional[str] = None
    suggested_fix: Optional[str] = None
    platforms: List[Platform] = Field(default_factory=list)
    locations: List[Location] = Field(default_factory=list)
    confidence: float = 0.5
    status: TicketStatus = TicketStatus.OPEN
    source_count: int = 1

    @staticmethod
    def make_id(feature: str, category: Category, title: str) -> str:
        digest = hashlib.sha1(
            f"{feature}|{category.value}|{title}".lower().encode("utf-8")
        ).hexdigest()[:8]
        return f"UNI-{digest}"


class TicketReport(BaseModel):
    tool_version: str
    ios_path: str
    android_path: str
    agent_md_path: str
    generated_at: str
    tickets: List[Ticket] = Field(default_factory=list)
    expected_native_count: int = 0
    stats: dict = Field(default_factory=dict)
