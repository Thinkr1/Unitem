"""Reconcile stage: turn accepted verdicts into real changes.

Two propagate paths (ARCHITECTURE.md §4):
- token change  -> update design-tokens/tokens.json, re-run Style Dictionary;
                   both platforms' token files regenerate mechanically.
- code edit     -> deterministic substitution (rehearsed flag fixes: replace a
                   hardcoded literal with the token whose value it should be).

generate_fix() previews by running the transformation, capturing a unified
diff, and restoring original bytes (never git-checkout — it must not clobber
uncommitted demo edits). apply_fix() re-runs the transformation and keeps it.
open_pr() pushes a sync/* branch and opens the PR via gh; in mock-runner mode
it short-circuits to a canned URL so the offline pipeline stays offline.
"""
from __future__ import annotations

import difflib
import json
import re
import subprocess
from pathlib import Path

from .config import Config
from .discovery import discover_platform
from .schema import ProposedFix, Ticket

_CANNED_PR_URL = "https://github.com/{repo}/pull/999"


# ── transformations (each returns the paths it touched) ─────────────────────


def _transform_token(ticket: Ticket, cfg: Config) -> list[Path]:
    group, _, token = ticket.change.name.partition(".")
    tokens = json.loads(cfg.tokens_file.read_text(encoding="utf-8"))
    if group not in tokens or token not in tokens[group]:
        raise ValueError(f"token {ticket.change.name} not in {cfg.tokens_file}")
    tokens[group][token]["value"] = ticket.change.after
    cfg.tokens_file.write_text(json.dumps(tokens, indent=2) + "\n", encoding="utf-8")
    subprocess.run(
        ["npx", "-y", "style-dictionary@4", "build", "--config", "design-tokens/config.mjs"],
        cwd=cfg.root,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    generated = [
        cfg.tokens_file,
        cfg.root / "sample-ios/Sources/Theme.swift",
        cfg.root / "sample-android/app/src/main/java/com/unitem/sample/ui/theme/Color.kt",
        cfg.root / "sample-flutter/lib/theme.dart",
    ]
    return [p for p in generated if p.is_file()]


def _transform_substitution(ticket: Ticket, cfg: Config) -> list[Path]:
    """Replace a hardcoded literal with the token whose value it should be."""
    change = ticket.change
    if not ticket.expected:
        raise ValueError("substitution fix needs an expected value")
    platform = change.origin_platform
    facts = discover_platform(cfg, platform)
    # The model may phrase `expected` loosely ("color.textSecondary (#8A8BB3)").
    # Match a token by embedded hex value first, then by embedded token name.
    hex_match = re.search(r"#[0-9A-Fa-f]{6}", ticket.expected)
    wanted_value = (hex_match.group(0) if hex_match else ticket.expected).upper()
    token = next(
        (f for f in facts if f.kind == "token_def" and f.value.upper() == wanted_value),
        None,
    )
    if token is None:
        expected_lower = ticket.expected.lower()
        token = next(
            (
                f
                for f in facts
                if f.kind == "token_def" and f.name and f.name.lower() in expected_lower
            ),
            None,
        )
    if token is None:
        raise ValueError(f"no {platform} token holds expected value {ticket.expected}")

    path = cfg.root / change.location.file
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    idx = change.location.line - 1
    hex_value = change.after.lstrip("#").upper()
    suffix = path.suffix
    if suffix == ".swift":
        old_literal = f'Color(hex: "#{hex_value}")'
        replacement = f"Theme.{token.name}"
    elif suffix == ".dart":
        old_literal = f"Color(0xFF{hex_value})"
        replacement = f"AppTheme.{token.name}"
    else:  # .kt
        old_literal = f"Color(0xFF{hex_value})"
        replacement = token.name or ""
    if old_literal not in lines[idx]:
        raise ValueError(f"literal {old_literal} not found at {path}:{change.location.line}")
    lines[idx] = lines[idx].replace(old_literal, replacement)

    if suffix == ".kt" and token.name:
        import_line = f"import com.unitem.sample.ui.theme.{token.name}\n"
        if import_line not in lines:
            last_import = max(
                i for i, line in enumerate(lines) if line.startswith("import ")
            )
            lines.insert(last_import + 1, import_line)
    path.write_text("".join(lines), encoding="utf-8")
    return [path]


def _transform(ticket: Ticket, cfg: Config) -> list[Path]:
    if ticket.verdict == "propagate" and ticket.change.kind == "token":
        return _transform_token(ticket, cfg)
    if ticket.expected:
        return _transform_substitution(ticket, cfg)
    raise ValueError(f"no fix strategy for {ticket.id} ({ticket.verdict}/{ticket.change.kind})")


# ── preview / apply ──────────────────────────────────────────────────────────


def _unified_diff(path: Path, before: str, after: str, root: Path) -> str:
    rel = path.relative_to(root)
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{rel}",
            tofile=f"b/{rel}",
        )
    )


def _read_text_or_none(path: Path) -> str | None:
    """Best-effort read; returns None for anything that isn't UTF-8 text.

    The ios/android roots may contain non-source artifacts (Xcode
    xcuserdata plists, build output, images, .DS_Store, etc.) that are
    irrelevant to any fix transformation but would otherwise crash the
    snapshot step with a UnicodeDecodeError.
    """
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def generate_fix(ticket: Ticket, cfg: Config) -> ProposedFix | None:
    """Preview the fix as a diff without leaving changes on disk."""
    if ticket.verdict == "hold":
        return None
    candidates = [
        cfg.tokens_file,
        cfg.root / "sample-flutter/lib/theme.dart",
        *cfg.ios_root.rglob("*.swift"),
        *cfg.android_root.rglob("*.kt"),
        *cfg.android_root.rglob("*.dart"),
        cfg.root / ticket.change.location.file,
    ]
    if ticket.change.counterpart_location:
        candidates.append(cfg.root / ticket.change.counterpart_location.file)
    snapshot = {
        p: text
        for p in candidates
        if p.is_file() and (text := _read_text_or_none(p)) is not None
    }
    try:
        touched = _transform(ticket, cfg)
        diff = "".join(
            _unified_diff(p, snapshot.get(p, ""), p.read_text(encoding="utf-8"), cfg.root)
            for p in touched
        )
    except (ValueError, subprocess.SubprocessError) as err:
        return None if ticket.verdict == "flag" else _fail_fix(ticket, str(err))
    finally:
        for path, text in snapshot.items():
            if path.is_file() and path.read_text(encoding="utf-8") != text:
                path.write_text(text, encoding="utf-8")

    target = "android" if ticket.change.origin_platform == "ios" else "ios"
    if ticket.verdict == "flag":
        target = ticket.change.origin_platform  # fix lands where the drift lives
    main_file = next(
        (str(p.relative_to(cfg.root)) for p in touched if _is_platform_file(cfg, p, target)),
        str(touched[0].relative_to(cfg.root)),
    )
    return ProposedFix(target_platform=target, file=main_file, diff=diff)


def _is_platform_file(cfg: Config, path: Path, platform: str) -> bool:
    root = cfg.ios_root if platform == "ios" else cfg.android_root
    return path.is_relative_to(root)


def _fail_fix(ticket: Ticket, err: str) -> None:
    return None


def apply_fix(ticket: Ticket, cfg: Config) -> list[Path]:
    """Run the transformation for real (files stay changed)."""
    return _transform(ticket, cfg)


# ── agentic fixer (ARCHITECTURE.md §6 "Fixer") ───────────────────────────────


def _fix_instruction(ticket: Ticket, cfg: Config) -> str:
    change = ticket.change
    if ticket.verdict == "propagate" and change.kind == "token":
        group, _, token = change.name.partition(".")
        return (
            f"You are Unitem's fixer agent applying an approved design propagation.\n"
            f"Task: the design token {change.name} changed on {change.origin_platform} "
            f"from {change.before} to {change.after}. Apply it to the canonical token "
            f"source and regenerate the platform files:\n"
            f"1. Edit design-tokens/tokens.json: set {group}.{token}.value to \"{change.after}\".\n"
            f"2. Run: npx -y style-dictionary@4 build --config design-tokens/config.mjs\n"
            f"3. Verify the counterpart file "
            f"({change.counterpart_location.file if change.counterpart_location else 'the generated theme'}) "
            f"now contains {change.after}.\n"
            f"Touch NOTHING else. Do not commit. Reply with a one-line summary."
        )
    return (
        f"You are Unitem's fixer agent applying an approved drift fix.\n"
        f"Task: in {change.location.file} line {change.location.line}, the value "
        f"{change.after} is hardcoded. Replace it with the design token whose value is "
        f"{ticket.expected} (look in the same platform's theme file for the token name; "
        f"add the import if that language requires it).\n"
        f"Context: {ticket.reason}\n"
        f"Touch ONLY that file. Do not commit. Reply with a one-line summary."
    )


def _agent_fix_succeeded(ticket: Ticket, cfg: Config) -> bool:
    """Deterministic post-check on the agent's work."""
    change = ticket.change
    if ticket.verdict == "propagate" and change.kind == "token":
        loc = change.counterpart_location
        if loc is None:
            return False
        target = cfg.root / loc.file
        return target.is_file() and change.after.lstrip("#").upper() in target.read_text(
            encoding="utf-8"
        ).upper()
    target = cfg.root / change.location.file
    if not target.is_file():
        return False
    hex_value = change.after.lstrip("#").upper()
    return hex_value not in target.read_text(encoding="utf-8").upper()


def apply_fix_with_agent(ticket: Ticket, cfg: Config) -> list[Path]:
    """Dispatch a cursor-agent into the repo to apply the fix; verify its work
    deterministically and fall back to the mechanical transform on failure."""
    from .runner.cursor import _find_binary, _log_spawn

    try:
        binary = _find_binary()
        model = cfg.runner.model
        _log_spawn(f"fixer:{ticket.id}", model)
        cmd = [binary, "-p", _fix_instruction(ticket, cfg), "--output-format", "json", "--trust"]
        if model and model != "auto":
            cmd += ["--model", model]
        subprocess.run(
            cmd,
            cwd=cfg.root,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if _agent_fix_succeeded(ticket, cfg):
            touched = [cfg.root / ticket.change.location.file]
            if ticket.change.counterpart_location:
                touched.append(cfg.root / ticket.change.counterpart_location.file)
            if ticket.change.kind == "token":
                touched.append(cfg.tokens_file)
            return [p for p in touched if p.is_file()]
    except Exception:
        pass  # fall through to the mechanical path
    return _transform(ticket, cfg)


# ── PR flow ──────────────────────────────────────────────────────────────────


def _run(cfg: Config, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cfg.root, capture_output=True, text=True, timeout=120)


def open_pr(ticket: Ticket, cfg: Config, touched: list[Path]) -> str | None:
    """sync/<id>-<slug> branch -> push -> gh pr create. None on any failure."""
    slug = re.sub(r"[^a-z0-9]+", "-", ticket.change.name.lower()).strip("-")[:40]
    branch = f"sync/{ticket.id.lower()}-{slug}"
    current = _run(cfg, "git", "rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"
    body = (
        f"Automated by Unitem — verdict **{ticket.verdict}** "
        f"(confidence {ticket.confidence:.2f}).\n\n{ticket.reason}\n\n"
        f"Convention rules: {', '.join(ticket.convention_refs) or '—'}\n"
        f"Origin: {ticket.change.origin_platform} "
        f"`{ticket.change.location.file}:{ticket.change.location.line}`"
    )
    try:
        if _run(cfg, "git", "checkout", "-b", branch).returncode != 0:
            return None
        rels = [str(p.relative_to(cfg.root)) for p in touched]
        if _run(cfg, "git", "add", "--", *rels).returncode != 0:
            return None
        title = f"Unitem {ticket.id}: {ticket.verdict} {ticket.change.name}"
        if _run(cfg, "git", "commit", "-m", f"{title}\n\n{ticket.reason}").returncode != 0:
            return None
        if _run(cfg, "git", "push", "-u", cfg.repo.remote, branch).returncode != 0:
            return None
        pr = _run(
            cfg,
            "gh",
            "pr",
            "create",
            "--title",
            title,
            "--body",
            body,
            "--base",
            cfg.repo.pr_base_branch,
            "--head",
            branch,
        )
        url = pr.stdout.strip().splitlines()[-1] if pr.returncode == 0 and pr.stdout else None
        return url if url and url.startswith("http") else None
    finally:
        _run(cfg, "git", "checkout", current)


def apply_and_pr(ticket: Ticket, cfg: Config, runner_name: str | None = None) -> None:
    """Called by the accept endpoint. Mutates ticket (proposed_fix, pr_url).

    Fixer selection (cfg.fixer): "agent" -> cursor-agent applies the edit in
    the repo (verified, mechanical fallback); "deterministic" -> mechanical
    transform; "auto" -> agent when the live runner is configured, mechanical
    under mock (keeps tests and offline mode hermetic).
    """
    if ticket.verdict == "hold":
        return
    runner_name = runner_name or cfg.runner.name
    use_agent = cfg.fixer == "agent" or (cfg.fixer == "auto" and runner_name == "cursor")
    touched = apply_fix_with_agent(ticket, cfg) if use_agent else apply_fix(ticket, cfg)
    if ticket.proposed_fix is None:
        diff = "".join(
            _unified_diff(p, "", p.read_text(encoding="utf-8"), cfg.root) for p in touched
        )
        ticket.proposed_fix = ProposedFix(
            target_platform=ticket.change.origin_platform, file=str(touched[0]), diff=diff
        )
    if ticket.verdict == "propagate" and cfg.repo.open_prs:
        if runner_name == "mock":
            ticket.pr_url = _CANNED_PR_URL.format(repo=cfg.repo.github_repo)
        else:
            ticket.pr_url = open_pr(ticket, cfg, touched)
