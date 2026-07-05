#!/usr/bin/env python3
"""Apply (or reset) the three rehearsed demo changes on the sample apps.

  python3 scripts/demo_edits.py 1      # propagate: brandPrimary indigo -> rose on iOS
  python3 scripts/demo_edits.py 2      # hold: restyle the iOS toggle natively
  python3 scripts/demo_edits.py 3      # flag: (already seeded) prints where the drift lives
  python3 scripts/demo_edits.py reset  # restore the propagate-demo baseline (both indigo)

Run from the repo root. After an edit:  unitem diff --runner cursor

Note: `git checkout` alone is not enough — HEAD may already have rose on iOS from a
prior transfer pass. `reset` explicitly puts both platforms back on indigo so
scenario 1 creates a git diff the engine can detect.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_IOS = ROOT / "sample-ios/Sources/Theme.swift"
THEME_ANDROID = ROOT / "sample-flutter/lib/theme.dart"
LOGIN_IOS = ROOT / "sample-ios/Sources/LoginView.swift"
LOGIN_ANDROID = ROOT / "sample-flutter/lib/login_screen.dart"

INDIGO = "#4F46E5"
ROSE = "#E11D48"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"already applied in {path.name}")
        return
    if old not in text:
        sys.exit(f"ERROR: expected snippet not found in {path} — run `python3 scripts/demo_edits.py reset` first.")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"edited {path.relative_to(ROOT)}")


def _set_swift_brand(hex_color: str) -> None:
    text = THEME_IOS.read_text(encoding="utf-8")
    updated, n = re.subn(
        r'static let brandPrimary = Color\(hex: "#[0-9A-Fa-f]{6}"\)',
        f'static let brandPrimary = Color(hex: "{hex_color}")',
        text,
        count=1,
    )
    if n != 1:
        sys.exit(f"ERROR: could not set iOS brandPrimary in {THEME_IOS}")
    THEME_IOS.write_text(updated, encoding="utf-8")


def _set_dart_brand(hex_color: str) -> None:
    """hex_color like #4F46E5 -> Color(0xFF4F46E5)."""
    dart = f"0xFF{hex_color.lstrip('#').upper()}"
    text = THEME_ANDROID.read_text(encoding="utf-8")
    updated, n = re.subn(
        r"static const Color brandPrimary = Color\(0x[0-9A-Fa-f]{8}\)",
        f"static const Color brandPrimary = Color({dart})",
        text,
        count=1,
    )
    if n != 1:
        sys.exit(f"ERROR: could not set Android brandPrimary in {THEME_ANDROID}")
    THEME_ANDROID.write_text(updated, encoding="utf-8")


def _undo_toggle_style() -> None:
    text = LOGIN_IOS.read_text(encoding="utf-8")
    if ".toggleStyle(.switch)" not in text:
        return
    LOGIN_IOS.write_text(text.replace("\n                .toggleStyle(.switch)", ""), encoding="utf-8")
    print(f"removed .toggleStyle from {LOGIN_IOS.relative_to(ROOT)}")


def reset() -> None:
    subprocess.run(
        ["git", "checkout", "--", "sample-ios", "sample-android", "sample-flutter", "design-tokens"],
        cwd=ROOT,
        check=True,
    )
    # HEAD may already have rose on iOS (post-transfer) — force the propagate baseline:
    # both platforms on indigo so scenario 1 creates a real git diff.
    _set_swift_brand(INDIGO)
    _set_dart_brand(INDIGO)
    _undo_toggle_style()
    print("propagate-demo baseline restored: iOS + Android brandPrimary = indigo (#4F46E5)")
    print("next: python3 scripts/demo_edits.py 1  &&  unitem diff --runner cursor")


def edit_1_propagate() -> None:
    text = THEME_IOS.read_text(encoding="utf-8")
    if ROSE in text and f'Color(hex: "{INDIGO}")' not in text:
        sys.exit(
            "ERROR: iOS brandPrimary is already rose — run `python3 scripts/demo_edits.py reset` first "
            "to restore the indigo baseline, then run scenario 1 again."
        )
    replace_once(
        THEME_IOS,
        f'static let brandPrimary = Color(hex: "{INDIGO}")',
        f'static let brandPrimary = Color(hex: "{ROSE}")',
    )
    print("scenario 1 (propagate): brand primary indigo -> rose on iOS — Android is now stale.")


def edit_2_hold() -> None:
    replace_once(
        LOGIN_IOS,
        'Toggle("Remember me", isOn: $rememberMe)',
        'Toggle("Remember me", isOn: $rememberMe)\n'
        "                .toggleStyle(.switch)",
    )
    print("scenario 2 (hold): iOS toggle restyled natively — Android should keep Material Switch.")


def edit_3_flag() -> None:
    text = LOGIN_ANDROID.read_text(encoding="utf-8")
    if "0xFF22C55E" not in text:
        print(
            "scenario 3 (flag): no hardcoded green drift seeded in the current login_screen.dart.\n"
            "  The cross-check still surfaces other hardcoded literals when present.\n"
            "  Try `unitem diff --runner cursor` after reset — or inspect legacy-android/."
        )
        return
    line_no = next(
        i for i, line in enumerate(text.splitlines(), 1) if "0xFF22C55E" in line
    )
    print(
        "scenario 3 (flag) is pre-seeded drift: hardcoded green Color(0xFF22C55E)\n"
        f"at {LOGIN_ANDROID.relative_to(ROOT)}:{line_no} — surfaced by the screen cross-check."
    )


ACTIONS = {"1": edit_1_propagate, "2": edit_2_hold, "3": edit_3_flag, "reset": reset}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ACTIONS:
        sys.exit(__doc__)
    ACTIONS[sys.argv[1]]()
