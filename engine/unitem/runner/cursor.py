"""cursor-agent headless runner (authenticated via the team's Cursor subscription).

The JSON envelope of `cursor-agent -p --output-format json` is probed at
install time (M6); the parser below tolerates several field names and falls
back to treating stdout as raw model text.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from .base import Runner, RunnerError

_TEXT_FIELDS = ("result", "text", "response", "content", "message", "output")


def _find_binary() -> str:
    found = shutil.which("cursor-agent")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / "cursor-agent"
    if local.is_file():
        return str(local)
    raise RunnerError(
        "cursor-agent not found. Install it with:\n"
        "  curl https://cursor.com/install -fsS | bash\n"
        "then log in with the team's Cursor subscription (cursor-agent login)."
    )


class CursorRunner(Runner):
    name = "cursor"

    def __init__(self, model: str = "auto", timeout_s: int = 120):
        self.binary = _find_binary()
        self.model = model
        self.timeout_s = timeout_s

    def complete(self, prompt: str, *, key: str | None = None, timeout_s: int = 120) -> str:
        # --trust: headless runs must not stop at the workspace-trust prompt
        cmd = [self.binary, "-p", prompt, "--output-format", "json", "--trust"]
        if self.model and self.model != "auto":
            cmd += ["--model", self.model]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_s or self.timeout_s,
            )
        except subprocess.TimeoutExpired as err:
            raise RunnerError(f"cursor-agent timed out after {timeout_s}s") from err
        if proc.returncode != 0:
            raise RunnerError(
                f"cursor-agent exited {proc.returncode}: {proc.stderr.strip()[:500]}"
            )
        return _extract_text(proc.stdout)


def _extract_text(stdout: str) -> str:
    stdout = stdout.strip()
    try:
        envelope = json.loads(stdout)
    except json.JSONDecodeError:
        return stdout  # raw text mode — let run_json's extractor deal with it
    if isinstance(envelope, dict):
        for field in _TEXT_FIELDS:
            value = envelope.get(field)
            if isinstance(value, str) and value.strip():
                return value
    return stdout
