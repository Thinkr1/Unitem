"""Thin wrapper around the Cursor headless CLI.

Analysis is performed by launching one Cursor agent per section via::

    cursor-agent -p "<prompt>" --output-format json

The ``json`` output format emits a single object whose ``result`` field holds
the agent's final text answer. We ask the agent to answer with strict JSON and
then extract/validate it. A mock runner mirrors the interface so the full
pipeline runs offline (tests, CI, no ``CURSOR_API_KEY``).
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Protocol


class CursorError(RuntimeError):
    pass


@dataclass
class RunResult:
    text: str
    raw: Optional[dict] = None


class CursorRunner(Protocol):
    def run(self, prompt: str, cwd: Path) -> RunResult:  # pragma: no cover - protocol
        ...


class CliCursorRunner:
    """Runs the real ``cursor-agent`` CLI in headless JSON mode."""

    def __init__(
        self,
        command: str = "cursor-agent",
        model: Optional[str] = None,
        timeout_seconds: int = 900,
        max_retries: int = 2,
    ) -> None:
        self.command = command
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    def _build_argv(self, prompt: str) -> list[str]:
        argv = [self.command, "-p", prompt, "--output-format", "json"]
        if self.model:
            argv += ["--model", self.model]
        return argv

    def run(self, prompt: str, cwd: Path) -> RunResult:
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                proc = subprocess.run(
                    self._build_argv(prompt),
                    cwd=str(cwd),
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                )
                if proc.returncode != 0:
                    raise CursorError(
                        f"cursor-agent exited {proc.returncode}: {proc.stderr.strip()[:500]}"
                    )
                return self._parse(proc.stdout)
            except (subprocess.TimeoutExpired, CursorError) as exc:
                last_err = exc
                continue
        raise CursorError(f"cursor-agent failed after {self.max_retries + 1} attempts: {last_err}")

    @staticmethod
    def _parse(stdout: str) -> RunResult:
        stdout = stdout.strip()
        if not stdout:
            raise CursorError("Empty output from cursor-agent")
        try:
            obj = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise CursorError(f"Could not parse cursor-agent JSON envelope: {exc}")
        # The envelope typically holds the final text under `result`.
        text = obj.get("result") if isinstance(obj, dict) else None
        if text is None:
            text = stdout
        return RunResult(text=text, raw=obj if isinstance(obj, dict) else None)


class MockCursorRunner:
    """Deterministic offline runner.

    Accepts a callback that maps a prompt to a final-answer string, letting
    tests and demos drive the pipeline without network/API access.
    """

    def __init__(self, responder: Callable[[str, Path], str]) -> None:
        self.responder = responder

    def run(self, prompt: str, cwd: Path) -> RunResult:
        return RunResult(text=self.responder(prompt, cwd))


_JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


def extract_json(text: str):
    """Best-effort extraction of a JSON value from an agent's text answer."""

    text = (text or "").strip()
    if not text:
        raise CursorError("No text to extract JSON from")

    # 1) Fenced code block.
    m = _JSON_BLOCK.search(text)
    if m:
        return json.loads(m.group(1))

    # 2) Whole string is JSON.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3) First balanced object/array in the text.
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == opener:
                depth += 1
            elif text[i] == closer:
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break
    raise CursorError("Could not extract JSON from agent output")
