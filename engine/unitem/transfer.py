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

import json
import re
import urllib.error
import urllib.request
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

# The UI's Android panel renders through DartPad, which bundles a fixed set of
# packages. Anything outside this set compiles locally but breaks the preview.
_DARTPAD_PACKAGES = {
    "google_fonts",
    "http",
    "provider",
    "shared_preferences",
    "collection",
    "intl",
    "vector_math",
    "characters",
    "flutter_riverpod",
    "flutter_bloc",
    "bloc",
    "url_launcher",
}

_COMPILE_API = "https://stable.api.dartpad.dev/api/v3/compileDDC"
_PACKAGE_IMPORT_RE = re.compile(r"import\s+'package:([a-z0-9_]+)/")

# DartPad has no asset bundle, so previews swap Image.asset for this stand-in.
# It must match the iOS preview's asset placeholder (SwiftPreview's glyph tile:
# indigo gradient, rounded corners, image glyph) so the two panels agree.
LOGO_PLACEHOLDER_DART = (
    "Container(width: 96, height: 96, alignment: Alignment.center, "
    "decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), "
    "gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, "
    "colors: [Color(0xFF1A1B4B), Color(0xFF3A3C7E)])), "
    "child: const Icon(Icons.image_outlined, size: 43, color: Colors.white70))"
)
_IMAGE_ASSET_RE = re.compile(r"(?:const\s+)?Image\.asset\([^)]*\)")

# User-visible string literals in SwiftUI: the first string arg of a copy-bearing
# view. Excludes Image("asset"), .font(.custom("Family")), Color("name"), etc.,
# because those are identifiers, not copy. This is GROUND TRUTH for text — the
# transfer must reproduce these verbatim, so we extract them deterministically
# instead of trusting an LLM to transcribe (LLMs "auto-correct" odd-looking copy).
_VISIBLE_COPY_RE = re.compile(
    r'\b(?:Text|Button|TextField|SecureField|Toggle|Label|Link|Menu|NavigationLink|Section)'
    r'\s*\(\s*"((?:[^"\\]|\\.)*)"'
)


def extract_ios_copy(ios_code: str) -> list[str]:
    """Deterministically pull user-visible copy from SwiftUI source, in order,
    deduplicated. Empty strings are skipped."""
    seen: list[str] = []
    for match in _VISIBLE_COPY_RE.finditer(ios_code):
        literal = match.group(1)
        if literal and literal not in seen:
            seen.append(literal)
    return seen


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


def build_reader_prompt(
    cfg: Config,
    files: dict[str, Optional[Path]],
    ios_code: str | None = None,
    ios_theme_code: str | None = None,
) -> str:
    template = _READER_TEMPLATE.read_text(encoding="utf-8")
    ios_screen = ios_code if ios_code is not None else _read(files["ios_screen"])
    ios_theme = ios_theme_code if ios_theme_code is not None else _read(files["ios_theme"])
    return (
        template.replace("{ios_screen_code}", ios_screen)
        .replace("{ios_theme_code}", ios_theme)
        .replace("{tokens_json}", _read(cfg.tokens_file))
        .replace("{agent_md}", cfg.read_agent_md() or "(no project spec provided)")
    )


def build_writer_prompt(
    cfg: Config,
    spec: DesignSpec,
    files: dict[str, Optional[Path]],
    failures: list[str],
    ios_code: str | None = None,
) -> str:
    template = _WRITER_TEMPLATE.read_text(encoding="utf-8")
    failure_block = ""
    if failures:
        failure_block = (
            "## Your previous output failed verification — fix ALL of these:\n\n"
            + "\n".join(f"- {f}" for f in failures)
        )
    ios_screen = ios_code if ios_code is not None else _read(files["ios_screen"])
    ios_copy = extract_ios_copy(ios_screen)
    ios_copy_block = "\n".join(f'- "{s}"' for s in ios_copy) or "(none found)"
    return (
        template.replace("{design_spec}", spec.model_dump_json(indent=2))
        .replace("{ios_screen_code}", ios_screen)
        .replace("{ios_copy}", ios_copy_block)
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
    ios_code: str | None = None,
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

    # every package import must be declared AND previewable in DartPad
    for gen in output.files:
        for pkg in _PACKAGE_IMPORT_RE.findall(gen.content):
            if pkg == "flutter":
                continue
            if pkg not in output.dependencies:
                hard.append(f"{gen.path} imports package:{pkg} but does not declare it in dependencies")
            elif pkg not in _DARTPAD_PACKAGES:
                hard.append(
                    f"{gen.path} imports package:{pkg}, which DartPad does not bundle — "
                    f"the preview cannot render it; use only: {', '.join(sorted(_DARTPAD_PACKAGES))}"
                )

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

    # text parity against GROUND TRUTH — the iOS source's own string literals,
    # NOT the reader's spec (the reader may "auto-correct" odd-looking copy).
    # Every visible iOS string must appear verbatim in the generated screen;
    # a miss feeds the repair round. Exact substring (quote-agnostic) so
    # "exact change" means exact.
    ios_screen_code = ios_code if ios_code is not None else _read(files["ios_screen"])
    for literal in extract_ios_copy(ios_screen_code):
        if literal not in combined:
            soft.append(
                f'iOS copy "{literal}" is missing from the generated screen — '
                "reproduce it verbatim (do not normalize or correct it)"
            )

    return hard, soft


# ── render-readiness (the preview is DartPad; prove the code compiles) ──────


def preview_compile_source(output: TransferOutput, screen_rel: str) -> str | None:
    """Rebuild exactly what the UI ships to DartPad: the screen with local
    imports inlined, assets swapped, and a main() harness appended."""
    files = {f.path: f.content for f in output.files}
    source = files.get(screen_rel)
    if source is None:
        return None
    for rel, body in files.items():
        if rel == screen_rel:
            continue
        name = rel.rsplit("/", 1)[-1]
        import_re = re.compile(rf"import\s+'{re.escape(name)}';\n?")
        if import_re.search(source):
            body = re.sub(r"import\s+'package:flutter/[^']+';\n?", "", body)
            source = import_re.sub("", source)
            source = source.rstrip() + "\n\n// ── inlined for preview ──\n" + body.strip() + "\n"
    source = _IMAGE_ASSET_RE.sub(LOGO_PLACEHOLDER_DART, source)
    if not re.search(r"\bvoid\s+main\s*\(", source):
        widget = _WIDGET_CLASS_RE.search(source)
        home = f"{widget.group(1)}()" if widget else "const SizedBox()"
        # same scaled 375x812 virtual device the UI harness uses, so the
        # compile gate proves exactly what the panel will render
        source += (
            "\n\nvoid main() => runApp(MaterialApp("
            "debugShowCheckedModeBanner: false, "
            "home: Scaffold(body: Center(child: FittedBox(fit: BoxFit.contain, "
            f"child: SizedBox(width: 375, height: 812, child: {home}))))));\n"
        )
    return source


def dartpad_compile_error(source: str, timeout: int = 150) -> str | None:
    """Compile through DartPad's own compiler. None = compiles clean;
    '__offline__' = service unreachable; anything else = compiler output."""
    body = json.dumps({"source": source}).encode()
    req = urllib.request.Request(
        _COMPILE_API, data=body, headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            json.load(res)
        return None
    except urllib.error.HTTPError as err:
        try:
            detail = json.loads(err.read().decode()).get("message", "")
        except Exception:
            detail = ""
        return (detail or f"HTTP {err.code}").strip()[:800]
    except Exception:
        return "__offline__"


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
    ios_source: str | None = None,
    ios_theme_source: str | None = None,
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

    # iOS is the source of truth. When the console sends edited iOS code, that
    # in-memory string is authoritative — the disk file is never read or written,
    # so the transfer reflects the user's edits without mutating their iOS source.
    ios_code = ios_source if ios_source is not None else _read(files["ios_screen"])
    ios_theme_code = (
        ios_theme_source if ios_theme_source is not None else _read(files["ios_theme"])
    )

    stage("discover", "reader agent distilling the iOS design spec")
    try:
        spec = run_json(
            runner, build_reader_prompt(cfg, files, ios_code, ios_theme_code), DesignSpec,
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
                runner, build_writer_prompt(cfg, spec, files, failures, ios_code), TransferOutput,
                key="transfer-writer", timeout_s=timeout,
            )
        except RunnerError as err:
            return TransferResult(ok=False, error=f"writer agent failed: {err}", attempts=attempts)
        stage("review", "verifying the transferred design against the spec")
        hard, soft = verify_output(cfg, spec, output, files, ios_code)
        # render-readiness: compile the exact preview source through DartPad's
        # compiler so the writer's code is proven renderable before it lands.
        # (skipped under the mock runner to keep offline replay hermetic)
        if not hard and runner.name != "mock":
            stage("review", "compiling the preview through DartPad to prove it renders")
            source = preview_compile_source(output, _rel(cfg, files["flutter_screen"]))
            compile_err = dartpad_compile_error(source) if source else "no screen file in output"
            if compile_err == "__offline__":
                soft.append("DartPad compile check skipped: compiler service unreachable")
                compile_err = None
            if compile_err:
                hard.append(f"the preview does not compile in DartPad:\n{compile_err}")
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
