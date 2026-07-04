import pytest

from unitem.judge import contrast_ratio, on_scale


def test_contrast_white_on_brand_indigo():
    # #4F46E5 vs white ≈ 6.3:1 (passes AA body text)
    assert contrast_ratio("#FFFFFF", "#4F46E5") == pytest.approx(6.29, abs=0.1)


def test_contrast_is_symmetric():
    assert contrast_ratio("#000000", "#FFFFFF") == pytest.approx(21.0, abs=0.01)
    assert contrast_ratio("#FFFFFF", "#000000") == pytest.approx(21.0, abs=0.01)


def test_low_contrast_secondary_text():
    # #8A8BB3 on white is below the 4.5 AA threshold for body text
    assert contrast_ratio("#8A8BB3", "#FFFFFF") < 4.5


def test_on_scale():
    scale = [4, 8, 12, 16, 24, 32]
    assert on_scale(16, scale)
    assert not on_scale(18, scale)
