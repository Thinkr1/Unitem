"""Runner abstraction: every LLM call goes through Runner.complete().

run_json() adds the reliability layer — fence stripping, JSON parsing,
pydantic validation, and a corrective re-prompt on failure — so callers
always get a validated model or a RunnerError, never raw text.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class RunnerError(Exception):
    pass


class Runner(ABC):
    name: str = "base"

    @abstractmethod
    def complete(self, prompt: str, *, key: str | None = None, timeout_s: int = 120) -> str:
        """Return the model's raw text for the prompt.

        `key` is a stable identity for the request (e.g. the atomic-change id);
        the mock runner uses it to look up recorded fixtures.
        """


def extract_json_block(text: str) -> str:
    """Pull the first JSON object out of model text (fences, prose, whatever)."""
    text = text.strip()
    if text.startswith("```"):
        first_nl = text.index("\n") if "\n" in text else 0
        end = text.rfind("```")
        if end > first_nl:
            text = text[first_nl + 1 : end].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found in model output")
    return text[start : end + 1]


def run_json(
    runner: Runner,
    prompt: str,
    model_cls: type[T],
    *,
    key: str | None = None,
    timeout_s: int = 120,
    retries: int = 2,
) -> T:
    last_err: Exception | None = None
    attempt_prompt = prompt
    for _ in range(retries + 1):
        text = runner.complete(attempt_prompt, key=key, timeout_s=timeout_s)
        try:
            return model_cls.model_validate(json.loads(extract_json_block(text)))
        except (ValueError, ValidationError) as err:
            last_err = err
            attempt_prompt = (
                prompt
                + f"\n\nYour previous output failed validation: {err}\n"
                "Output ONLY the JSON object, matching the schema exactly."
            )
    raise RunnerError(f"{runner.name}: invalid output after {retries + 1} attempts: {last_err}")
