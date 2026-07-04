"""Claude Code CLI headless runner (authenticated via the user's Claude subscription).

Same contract as CursorRunner: judges run in an empty sandbox (read-only by
construction), the envelope's `result` field carries the model text. Switch
runners in unitem.yaml (runner.name: claude) to A/B against Cursor.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from .base import Runner, RunnerError
from .cursor import _extract_text, _log_spawn


def _find_claude() -> str:
    found = shutil.which("claude")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / "claude"
    if local.is_file():
        return str(local)
    raise RunnerError(
        "claude CLI not found. Install Claude Code and log in with your "
        "Claude subscription (https://claude.com/claude-code)."
    )


class ClaudeRunner(Runner):
    name = "claude"

    def __init__(self, model: str = "auto", timeout_s: int = 120):
        self.binary = _find_claude()
        self.model = model
        self.timeout_s = timeout_s
        self.sandbox = Path(tempfile.mkdtemp(prefix="unitem-judge-"))

    def complete(self, prompt: str, *, key: str | None = None, timeout_s: int = 120) -> str:
        _log_spawn(key, f"claude:{self.model}")
        cmd = [self.binary, "-p", prompt, "--output-format", "json"]
        if self.model and self.model != "auto":
            cmd += ["--model", self.model]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_s or self.timeout_s,
                cwd=self.sandbox,
            )
        except subprocess.TimeoutExpired as err:
            raise RunnerError(f"claude timed out after {timeout_s}s") from err
        if proc.returncode != 0:
            raise RunnerError(f"claude exited {proc.returncode}: {proc.stderr.strip()[:500]}")
        return _extract_text(proc.stdout)
