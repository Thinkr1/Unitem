#!/usr/bin/env python3
"""Apply (or reset) the three rehearsed demo changes on the sample apps.

  python3 scripts/demo_edits.py 1      # propagate: brandPrimary #4F46E5 -> #6366F1 on iOS
  python3 scripts/demo_edits.py 2      # hold: restyle the iOS toggle natively
  python3 scripts/demo_edits.py 3      # flag: (already seeded) prints where the drift lives
  python3 scripts/demo_edits.py reset  # git checkout the sample dirs

Run from the repo root. After an edit:  unitem diff --runner mock|cursor
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "sample-ios/Sources/Theme.swift"
LOGIN_IOS = ROOT / "sample-ios/Sources/LoginView.swift"
LOGIN_ANDROID = ROOT / "sample-android/app/src/main/java/com/unitem/sample/login/LoginScreen.kt"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"already applied in {path.name}")
        return
    if old not in text:
        sys.exit(f"ERROR: expected snippet not found in {path} — was the file changed?")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"edited {path.relative_to(ROOT)}")


def edit_1_propagate() -> None:
    replace_once(
        THEME,
        'static let brandPrimary = Color(hex: "#4F46E5")',
        'static let brandPrimary = Color(hex: "#6366F1")',
    )
    print("scenario 1 (propagate): brand primary changed on iOS — Android is now stale.")


def edit_2_hold() -> None:
    replace_once(
        LOGIN_IOS,
        'Toggle("Remember me", isOn: $rememberMe)',
        'Toggle("Remember me", isOn: $rememberMe)\n'
        "                .toggleStyle(.switch)\n"
        "                .tint(Theme.brandPrimary)",
    )
    print("scenario 2 (hold): iOS toggle restyled natively — Android should keep Material Switch.")


def edit_3_flag() -> None:
    line_no = next(
        i
        for i, line in enumerate(LOGIN_ANDROID.read_text(encoding="utf-8").splitlines(), 1)
        if "0xFF5A55F2" in line
    )
    print(
        "scenario 3 (flag) is pre-seeded drift: hardcoded stale hex Color(0xFF5A55F2)\n"
        f"at {LOGIN_ANDROID.relative_to(ROOT)}:{line_no} — surfaced by the screen cross-check."
    )


def reset() -> None:
    subprocess.run(
        ["git", "checkout", "--", "sample-ios", "sample-android", "design-tokens"],
        cwd=ROOT,
        check=True,
    )
    print("sample apps reset to HEAD.")


ACTIONS = {"1": edit_1_propagate, "2": edit_2_hold, "3": edit_3_flag, "reset": reset}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ACTIONS:
        sys.exit(__doc__)
    ACTIONS[sys.argv[1]]()
