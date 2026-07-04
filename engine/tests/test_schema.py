import pytest
from pydantic import ValidationError

from unitem.schema import AtomicChange, JudgeResponse, Location


def test_judge_response_rejects_extra_keys():
    with pytest.raises(ValidationError):
        JudgeResponse.model_validate(
            {
                "verdict": "flag",
                "severity": "low",
                "confidence": 0.5,
                "reason": "x",
                "convention_refs": [],
                "hallucinated_field": True,
            }
        )


def test_judge_response_confidence_bounds():
    with pytest.raises(ValidationError):
        JudgeResponse.model_validate(
            {
                "verdict": "flag",
                "severity": "low",
                "confidence": 1.4,
                "reason": "x",
                "convention_refs": [],
            }
        )


def test_atomic_change_gets_stable_content_id():
    kwargs = dict(
        kind="token",
        category="color",
        name="color.brandPrimary",
        before="#4F46E5",
        after="#6366F1",
        origin_platform="ios",
        location=Location(file="Theme.swift", line=15),
    )
    a, b = AtomicChange(**kwargs), AtomicChange(**kwargs)
    assert a.id == b.id and a.id.startswith("chg-")
    different = AtomicChange(**{**kwargs, "after": "#000000"})
    assert different.id != a.id
