"""Thin wrapper around the Cursor headless CLI.

Analysis is performed by launching one Cursor agent per section via::

    cursor-agent -p "<prompt>" --output-format json

The ``json`` output format emits a single object whose ``result`` field holds
the agent's final text answer. We ask the agent to answer with strict JSON and
then extract/validate it.

For step-by-step visibility we can instead use ``--output-format stream-json``,
which emits newline-delimited JSON events (assistant messages, tool-call
start/completion). Each event is forwarded to an ``on_event`` callback so the
CLI can print the exact steps an agent takes.

A mock runner mirrors the interface so the full pipeline runs offline (tests,
CI, no ``CURSOR_API_KEY``).
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Protocol

# An agent execution event (a parsed line from stream-json output).
EventCallback = Optional[Callable[[dict], None]]


class CursorError(RuntimeError):
    pass


@dataclass
class RunResult:
    text: str
    raw: Optional[dict] = None


class CursorRunner(Protocol):
    def run(
        self, prompt: str, cwd: Path, on_event: EventCallback = None
    ) -> RunResult:  # pragma: no cover - protocol
        ...


class CliCursorRunner:
    """Runs the real ``cursor-agent`` CLI in headless JSON mode."""

    def __init__(
        self,
        command: str = "cursor-agent",
        model: Optional[str] = None,
        timeout_seconds: int = 900,
        max_retries: int = 2,
        stream: bool = False,
    ) -> None:
        self.command = command
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        # When True, use stream-json so per-step events can be surfaced live.
        self.stream = stream

    def _build_argv(self, prompt: str) -> list[str]:
        fmt = "stream-json" if self.stream else "json"
        argv = [self.command, "-p", prompt, "--output-format", fmt]
        if self.model:
            argv += ["--model", self.model]
        return argv

    def run(self, prompt: str, cwd: Path, on_event: EventCallback = None) -> RunResult:
        last_err: Optional[Exception] = None
        for _ in range(self.max_retries + 1):
            try:
                if self.stream:
                    return self._run_streaming(prompt, cwd, on_event)
                return self._run_blocking(prompt, cwd)
            except (subprocess.TimeoutExpired, CursorError) as exc:
                last_err = exc
                continue
        raise CursorError(f"cursor-agent failed after {self.max_retries + 1} attempts: {last_err}")

    def _run_blocking(self, prompt: str, cwd: Path) -> RunResult:
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

    def _run_streaming(self, prompt: str, cwd: Path, on_event: EventCallback) -> RunResult:
        """Read NDJSON events line-by-line, forwarding each to ``on_event``."""

        proc = subprocess.Popen(
            self._build_argv(prompt),
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        assert proc.stdout is not None
        final_text: Optional[str] = None
        collected: list[str] = []
        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if on_event:
                    on_event(event)
                # A top-level `result` marks the completion event.
                if isinstance(event, dict) and isinstance(event.get("result"), str):
                    final_text = event["result"]
                else:
                    piece = _event_text(event)
                    if piece:
                        collected.append(piece)
            proc.wait(timeout=self.timeout_seconds)
        finally:
            if proc.poll() is None:
                proc.kill()
        if proc.returncode not in (0, None):
            err = (proc.stderr.read() if proc.stderr else "").strip()[:500]
            raise CursorError(f"cursor-agent exited {proc.returncode}: {err}")
        text = final_text if final_text is not None else "".join(collected)
        if not text:
            raise CursorError("No result produced by cursor-agent stream")
        return RunResult(text=text)

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

    def run(self, prompt: str, cwd: Path, on_event: EventCallback = None) -> RunResult:
        # Emit synthetic events so --verbose has something to show offline.
        if on_event:
            on_event({"type": "system", "subtype": "start", "note": "mock agent started"})
        text = self.responder(prompt, cwd)
        if on_event:
            on_event({"type": "assistant", "message": {"content": text}})
            on_event({"type": "result", "result": text})
        return RunResult(text=text)


def _event_text(event: dict) -> str:
    """Best-effort extraction of human-readable text from a stream event."""

    if not isinstance(event, dict):
        return ""
    msg = event.get("message")
    if isinstance(msg, str):
        return msg
    if isinstance(msg, dict):
        content = msg.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [c.get("text", "") for c in content if isinstance(c, dict)]
            return "".join(parts)
    if isinstance(event.get("text"), str):
        return event["text"]
    return ""


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
