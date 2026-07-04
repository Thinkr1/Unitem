"""Transfer mode: whole-screen design transfer, iOS is the source of truth.

The diff pipeline reacts to atomic changes; this stage re-expresses the entire
screen. Two agents with one deterministic gate between them:

  1. reader  — distills a DesignSpec (colors, fonts, per-element styling,
               acceptance criteria) from the SwiftUI source + theme.
  2. writer  — regenerates the Flutter screen + theme from that spec, emitting
               complete file contents as JSON (never editing disk itself).
  3. verify  — deterministic checks on the writer's output: safe paths, brace
               balance, widget class preserved (hard — nothing is written if
               these fail), spec colors/fonts present (soft — reported as
               warnings). One repair round re-prompts the writer with the
               failure list before giving up.

Only after verification do the generated files land on disk, so a bad model
response can never leave the Flutter app broken.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Callable, Optional

from .config import Config
from .runner.base import Runner, RunnerError, run_json
from .schema import DesignSpec, TransferOutput, TransferResult

_READER_TEMPLATE = Path(__file__).parent / "prompts" / "transfer_reader.md"
_WRITER_TEMPLATE = Path(__file__).parent / "prompts" / "transfer_writer.md"

_SAFE_PATH_RE = re.compile(r"^lib/[\w\-/]+\.dart$")
_DEP_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")
_WIDGET_CLASS_RE = re.compile(
    r"class\s+([A-Za-z_]\w*)\s+extends\s+(?:StatelessWidget|StatefulWidget)"
)
_HEX_RE = re.compile(r"^[0-9A-Fa-f]{6}$")

# Pinned versions for packages the writer commonly needs; anything else gets
# `any` (the demo never runs `pub get`; DartPad resolves its own bundle).
_KNOWN_DEP_VERSIONS = {"google_fonts": "^6.2.1"}

OnStage = Callable[[str, str], None]


# ── file resolution ──────────────────────────────────────────────────────────


def resolve_screen_files(cfg: Config, screen: str) -> dict[str, Optional[Path]]:
    """Locate the screen pair (live mapping, examples fallback — same policy
    as api._panel) plus each platform's theme file and the Flutter pubspec."""
    from .discovery import discover
    from .mapping import build_mapping

    found: dict[str, Optional[str]] = {"ios": None, "android": None}
    facts = discover(cfg)
    mapping = build_mapping(cfg, facts["ios"], facts["android"])
    for entry in mapping.screens:
        if entry.feature == screen:
            if entry.ios:
                found["ios"] = entry.ios[0]
            if entry.android:
                found["android"] = entry.android[0]
            break

    def _abs(rel: Optional[str]) -> Optional[Path]:
        if rel is None:
            return None
        path = cfg.root / rel
        return path if path.is_file() else None

    def _first(root: Path, pattern: str) -> Optional[Path]:
        return next(iter(sorted(root.rglob(pattern))), None)

    return {
        "ios_screen": _abs(found["ios"]),
        "flutter_screen": _abs(found["android"]),
        "ios_theme": _first(cfg.ios_root, "Theme.swift"),
        "flutter_theme": _first(cfg.android_root, "theme.dart"),
        "pubspec": _first(cfg.android_root, "pubspec.yaml"),
    }


def _read(path: Optional[Path]) -> str:
    return path.read_text(encoding="utf-8") if path and path.is_file() else "(not found)"


def _rel(cfg: Config, path: Optional[Path]) -> str:
    if path is None:
        return "(unknown)"
    try:
        return str(path.relative_to(cfg.android_root))
    except ValueError:
        return str(path)


# ── prompt building ──────────────────────────────────────────────────────────


def build_reader_prompt(cfg: Config, files: dict[str, Optional[Path]]) -> str:
    template = _READER_TEMPLATE.read_text(encoding="utf-8")
    return (
        template.replace("{ios_screen_code}", _read(files["ios_screen"]))
        .replace("{ios_theme_code}", _read(files["ios_theme"]))
        .replace("{tokens_json}", _read(cfg.tokens_file))
        .replace("{agent_md}", cfg.read_agent_md() or "(no project spec provided)")
    )


def build_writer_prompt(
    cfg: Config,
    spec: DesignSpec,
    files: dict[str, Optional[Path]],
    failures: list[str],
) -> str:
    template = _WRITER_TEMPLATE.read_text(encoding="utf-8")
    failure_block = ""
    if failures:
        failure_block = (
            "## Your previous output failed verification — fix ALL of these:\n\n"
            + "\n".join(f"- {f}" for f in failures)
        )
    return (
        template.replace("{design_spec}", spec.model_dump_json(indent=2))
        .replace("{ios_screen_code}", _read(files["ios_screen"]))
        .replace("{flutter_screen_path}", _rel(cfg, files["flutter_screen"]))
        .replace("{flutter_screen_code}", _read(files["flutter_screen"]))
        .replace("{flutter_theme_path}", _rel(cfg, files["flutter_theme"]))
        .replace("{flutter_theme_code}", _read(files["flutter_theme"]))
        .replace("{pubspec}", _read(files["pubspec"]))
        .replace("{failures}", failure_block)
    )


# ── deterministic verification ───────────────────────────────────────────────


def _balanced(content: str) -> bool:
    return content.count("{") == content.count("}") and content.count("(") == content.count(")")


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def verify_output(
    cfg: Config,
    spec: DesignSpec,
    output: TransferOutput,
    files: dict[str, Optional[Path]],
) -> tuple[list[str], list[str]]:
    """Return (hard failures, soft failures). Hard failures block writing."""
    hard: list[str] = []
    soft: list[str] = []

    if not output.files:
        return (["output contains no files"], [])

    screen_rel = _rel(cfg, files["flutter_screen"])
    paths = [f.path for f in output.files]
    for gen in output.files:
        if not _SAFE_PATH_RE.match(gen.path):
            hard.append(f"unsafe or non-lib path: {gen.path} (must match lib/*.dart)")
        if not gen.content.strip():
            hard.append(f"{gen.path} is empty")
        elif not _balanced(gen.content):
            hard.append(f"{gen.path} has unbalanced braces/parens — incomplete file")
    if screen_rel not in paths:
        hard.append(f"missing the screen file itself ({screen_rel})")

    original_screen = _read(files["flutter_screen"])
    widget = _WIDGET_CLASS_RE.search(original_screen)
    combined = "\n".join(f.content for f in output.files)
    if widget and f"class {widget.group(1)}" not in combined:
        hard.append(f"public widget class {widget.group(1)} was renamed or dropped")

    for dep in output.dependencies:
        if not _DEP_NAME_RE.match(dep):
            hard.append(f"invalid pub package name: {dep}")

    combined_upper = combined.upper()
    for name, value in spec.colors.items():
        hex_value = str(value).lstrip("#").upper()
        if _HEX_RE.match(hex_value) and hex_value not in combined_upper:
            soft.append(f"spec color {name} ({value}) does not appear in the generated code")
    combined_norm = _normalize(combined)
    for family in spec.fonts:
        base = _normalize(str(family).split("-")[0])
        if base and base not in combined_norm:
            soft.append(f"spec font family {family} does not appear in the generated code")

    return hard, soft


# ── apply ────────────────────────────────────────────────────────────────────


def apply_output(cfg: Config, output: TransferOutput) -> list[str]:
    written = []
    for gen in output.files:
        target = cfg.android_root / gen.path
        target.parent.mkdir(parents=True, exist_ok=True)
        content = gen.content if gen.content.endswith("\n") else gen.content + "\n"
        target.write_text(content, encoding="utf-8")
        written.append(str(target.relative_to(cfg.root)))
    return written


def add_dependencies(pubspec: Optional[Path], deps: list[str]) -> list[str]:
    """Insert missing pub packages right under the `dependencies:` key."""
    if pubspec is None or not deps:
        return []
    lines = pubspec.read_text(encoding="utf-8").splitlines(keepends=True)
    added = []
    for dep in deps:
        if dep == "flutter" or any(re.match(rf"^\s{{2}}{re.escape(dep)}\s*:", ln) for ln in lines):
            continue
        for i, line in enumerate(lines):
            if re.match(r"^dependencies\s*:\s*$", line):
                version = _KNOWN_DEP_VERSIONS.get(dep, "any")
                lines.insert(i + 1, f"  {dep}: {version}\n")
                added.append(dep)
                break
    if added:
        pubspec.write_text("".join(lines), encoding="utf-8")
    return added


# ── orchestration ────────────────────────────────────────────────────────────


def run_transfer(
    cfg: Config,
    runner: Runner,
    screen: str | None = None,
    on_stage: OnStage | None = None,
    record_dir: Path | None = None,
) -> TransferResult:
    screen = screen or cfg.screen
    stage = on_stage or (lambda s, d: None)
    # Whole-file generation is a much bigger call than a judge verdict.
    timeout = max(cfg.runner.timeout_s, 600)

    files = resolve_screen_files(cfg, screen)
    if files["ios_screen"] is None:
        return TransferResult(ok=False, error=f"no iOS screen file mapped for '{screen}'")
    if files["flutter_screen"] is None:
        return TransferResult(ok=False, error=f"no Flutter screen file mapped for '{screen}'")

    stage("discover", "reader agent distilling the iOS design spec")
    try:
        spec = run_json(
            runner, build_reader_prompt(cfg, files), DesignSpec,
            key="transfer-reader", timeout_s=timeout,
        )
    except RunnerError as err:
        return TransferResult(ok=False, error=f"reader agent failed: {err}")
    _record(record_dir, "transfer-reader", spec.model_dump_json(indent=2))

    failures: list[str] = []
    hard: list[str] = []
    soft: list[str] = []
    output: TransferOutput | None = None
    attempts = 0
    for attempt in range(2):
        attempts += 1
        detail = (
            "writer agent regenerating the Flutter screen"
            if attempt == 0
            else "writer agent repairing verification failures"
        )
        stage("fix", detail)
        try:
            output = run_json(
                runner, build_writer_prompt(cfg, spec, files, failures), TransferOutput,
                key="transfer-writer", timeout_s=timeout,
            )
        except RunnerError as err:
            return TransferResult(ok=False, error=f"writer agent failed: {err}", attempts=attempts)
        stage("review", "verifying the transferred design against the spec")
        hard, soft = verify_output(cfg, spec, output, files)
        failures = hard + soft
        if not failures:
            break

    if output is None or hard:
        return TransferResult(
            ok=False,
            error="verification failed: " + "; ".join(hard or soft),
            attempts=attempts,
        )
    _record(record_dir, "transfer-writer", output.model_dump_json(indent=2))

    written = apply_output(cfg, output)
    added = add_dependencies(files["pubspec"], output.dependencies)
    return TransferResult(
        ok=True,
        files_written=written,
        dependencies_added=added,
        summary=output.summary or f"transferred iOS {screen} design to Flutter",
        warnings=soft,
        attempts=attempts,
    )


def _record(record_dir: Path | None, key: str, payload: str) -> None:
    if record_dir is None:
        return
    record_dir.mkdir(parents=True, exist_ok=True)
    (record_dir / f"{key}.json").write_text(payload, encoding="utf-8")
