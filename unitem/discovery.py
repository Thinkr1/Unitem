"""Discovery: classify source files by stack and build a UI-screen inventory.

The two codebases are the only input, so screens are inferred from files. We
classify each file into a UI stack, decide whether it is UI-bearing, group
files into screen descriptors by name, and attach deterministic signals.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable, List, Optional

from .config import UnitemConfig
from .extractors import ExtractedSignals, extract_signals
from .schema import (
    Inventory,
    Platform,
    ScreenDescriptor,
    SourceFile,
    Stack,
)

_IGNORE_DIRS = {
    ".git",
    "build",
    "Pods",
    "DerivedData",
    ".gradle",
    "node_modules",
    ".idea",
    ".dart_tool",
    "Carthage",
    "__pycache__",
    ".unitem",
}

# UI-ish name hints used to decide whether a file represents a screen/component.
_UI_NAME_HINTS = (
    "view",
    "screen",
    "page",
    "fragment",
    "activity",
    "component",
    "controller",
    "widget",
    "layout",
    "scaffold",
)

# Names that look like screens (as opposed to small reusable components).
_SCREEN_NAME_HINTS = ("view", "screen", "page", "fragment", "activity", "controller")


def classify_stack(path: Path, sample: str) -> Stack:
    suffix = path.suffix.lower()
    if suffix == ".swift":
        if re.search(r"\b(import\s+SwiftUI|some\s+View|@State|VStack|HStack)\b", sample):
            return Stack.SWIFTUI
        if re.search(r"\b(UIViewController|UIView|UIKit)\b", sample):
            return Stack.UIKIT
        return Stack.SWIFTUI if "View" in path.stem else Stack.UIKIT
    if suffix in (".m", ".mm", ".h"):
        return Stack.OBJC
    if suffix == ".kt":
        if re.search(r"@Composable", sample):
            return Stack.COMPOSE
        return Stack.COMPOSE if "Screen" in path.stem or "Compose" in sample else Stack.COMPOSE
    if suffix == ".java":
        return Stack.ANDROID_XML  # java UI paired with xml layouts
    if suffix == ".xml":
        return Stack.ANDROID_XML
    if suffix == ".dart":
        return Stack.FLUTTER
    return Stack.UNKNOWN


def _platform_for(path: Path, stack: Stack, ios_root: Path, android_root: Path) -> Optional[Platform]:
    try:
        path.relative_to(ios_root)
        return Platform.IOS
    except ValueError:
        pass
    try:
        path.relative_to(android_root)
        return Platform.ANDROID
    except ValueError:
        pass
    return None


def _is_ui_file(path: Path, stack: Stack, sample: str) -> bool:
    if stack in (Stack.UNKNOWN,):
        return False
    stem = path.stem.lower()
    if any(h in stem for h in _UI_NAME_HINTS):
        return True
    if stack == Stack.SWIFTUI and "some View" in sample:
        return True
    if stack == Stack.COMPOSE and "@Composable" in sample:
        return True
    if stack == Stack.ANDROID_XML and path.suffix.lower() == ".xml":
        return "<" in sample and ("Layout" in sample or "androidx" in sample or "android:" in sample)
    if stack == Stack.FLUTTER and ("StatelessWidget" in sample or "StatefulWidget" in sample):
        return True
    return False


def _iter_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if p.is_dir():
            continue
        if any(part in _IGNORE_DIRS for part in p.parts):
            continue
        if p.suffix.lower() in (
            ".swift",
            ".m",
            ".mm",
            ".h",
            ".kt",
            ".java",
            ".xml",
            ".dart",
        ):
            yield p


def _read_sample(path: Path, max_bytes: int) -> str:
    try:
        data = path.read_bytes()[:max_bytes]
        return data.decode("utf-8", errors="ignore")
    except OSError:
        return ""


def _screen_name(path: Path) -> str:
    """Normalize a file stem into a comparable feature name."""

    stem = path.stem
    # Strip common UI suffixes so `SettingsView` ~ `SettingsScreen`.
    name = re.sub(
        r"(View|Screen|Page|Fragment|Activity|Controller|ViewController|Widget|Layout|Binding)$",
        "",
        stem,
    )
    name = re.sub(r"(?<!^)(?=[A-Z])", " ", name).strip()  # camelCase -> words
    name = re.sub(r"[_\-]+", " ", name).strip()
    return name or stem


def build_inventory(cfg: UnitemConfig) -> Inventory:
    files: List[SourceFile] = []
    # feature-name -> descriptor, per platform.
    ios_screens: dict[str, ScreenDescriptor] = {}
    android_screens: dict[str, ScreenDescriptor] = {}

    for root, platform in ((cfg.ios_path, Platform.IOS), (cfg.android_path, Platform.ANDROID)):
        for path in _iter_files(root):
            sample = _read_sample(path, cfg.max_bytes_per_file)
            stack = classify_stack(path, sample)
            is_ui = _is_ui_file(path, stack, sample)
            try:
                size = path.stat().st_size
            except OSError:
                size = 0
            files.append(
                SourceFile(
                    path=str(path),
                    platform=platform,
                    stack=stack,
                    is_ui=is_ui,
                    size_bytes=size,
                )
            )
            if not is_ui:
                continue

            feature = _screen_name(path)
            signals = extract_signals(sample)
            bucket = ios_screens if platform == Platform.IOS else android_screens
            key = feature.lower()
            if key not in bucket:
                bucket[key] = ScreenDescriptor(
                    id=f"{platform.value}:{key}",
                    platform=platform,
                    name=feature,
                    files=[],
                    stacks=[],
                    routes=[],
                    string_keys=[],
                )
            desc = bucket[key]
            desc.files.append(str(path))
            if stack not in desc.stacks:
                desc.stacks.append(stack)
            _merge_into_descriptor(desc, signals)

    return Inventory(
        ios_screens=list(ios_screens.values()),
        android_screens=list(android_screens.values()),
        files=files,
    )


def _merge_into_descriptor(desc: ScreenDescriptor, signals: ExtractedSignals) -> None:
    for r in signals.routes:
        if r not in desc.routes:
            desc.routes.append(r)
    for k in signals.string_keys:
        if k not in desc.string_keys:
            desc.string_keys.append(k)
