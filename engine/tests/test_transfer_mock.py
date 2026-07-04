"""Transfer mode offline: reader/writer fixtures replayed by the mock runner,
generated files verified and applied to a throwaway copy of the sample apps."""
import shutil

from unitem.config import load_config
from unitem.runner import MockRunner
from unitem.transfer import resolve_screen_files, run_transfer

from conftest import REPO_ROOT


def _cfg(tmp_path):
    ios_root = tmp_path / "sample-ios"
    android_root = tmp_path / "sample-flutter"
    shutil.copytree(REPO_ROOT / "sample-ios", ios_root)
    shutil.copytree(REPO_ROOT / "sample-flutter", android_root)
    return load_config(REPO_ROOT / "unitem.yaml").model_copy(
        update={
            "root": tmp_path,
            "ios_root": ios_root,
            "android_root": android_root,
            "tokens_file": REPO_ROOT / "design-tokens" / "tokens.json",
            "agent_md": REPO_ROOT / "examples" / "agent.md",
            "fixtures_dir": REPO_ROOT / "examples" / "fixtures",
            "out_dir": tmp_path / "out",
            "overrides_file": tmp_path / "overrides.jsonl",
        }
    )


def test_transfer_mock_end_to_end(tmp_path):
    cfg = _cfg(tmp_path)
    runner = MockRunner(cfg.fixtures_dir)

    stages = []
    result = run_transfer(cfg, runner, on_stage=lambda s, d: stages.append(s))

    assert result.ok, result.error
    assert result.attempts == 1
    assert not result.warnings, result.warnings
    assert set(result.files_written) == {
        "sample-flutter/lib/login_screen.dart",
        "sample-flutter/lib/theme.dart",
    }
    # the sample pubspec may or may not already carry google_fonts (the live
    # transfer adds it); either way it must be declared exactly once afterwards
    assert {"discover", "fix", "review"} <= set(stages)

    # the transferred screen carries the iOS design, not the Material defaults
    screen = (cfg.android_root / "lib" / "login_screen.dart").read_text()
    theme = (cfg.android_root / "lib" / "theme.dart").read_text()
    assert "OutlineInputBorder" in screen  # rounded filled fields, not underline
    assert "GoogleFonts.spaceGrotesk" in screen
    assert "class LoginScreen" in screen  # public widget preserved
    assert "0xFFE11D48" in theme  # brand rose transferred from iOS Theme.swift

    pubspec = (cfg.android_root / "pubspec.yaml").read_text()
    assert pubspec.count("google_fonts:") == 1

    # idempotent on the pubspec: a second run adds nothing twice
    result2 = run_transfer(cfg, runner)
    assert result2.ok and result2.dependencies_added == []
    assert (cfg.android_root / "pubspec.yaml").read_text().count("google_fonts:") == 1


def test_verify_flags_undeclared_and_unpreviewable_packages(tmp_path):
    from unitem.schema import DesignSpec, GeneratedFile, TransferOutput
    from unitem.transfer import verify_output

    cfg = _cfg(tmp_path)
    files = resolve_screen_files(cfg, "login")
    spec = DesignSpec(colors={}, fonts=[])
    output = TransferOutput(
        files=[
            GeneratedFile(
                path="lib/login_screen.dart",
                content=(
                    "import 'package:google_fonts/google_fonts.dart';\n"
                    "import 'package:lottie/lottie.dart';\n"
                    "class LoginScreen extends StatelessWidget {}\n"
                ),
            )
        ],
        dependencies=["lottie"],
    )
    hard, _ = verify_output(cfg, spec, output, files)
    assert any("google_fonts" in h and "does not declare" in h for h in hard)
    assert any("lottie" in h and "DartPad" in h for h in hard)


def test_preview_compile_source_builds_a_runnable_harness():
    from unitem.schema import GeneratedFile, TransferOutput
    from unitem.transfer import preview_compile_source

    output = TransferOutput(
        files=[
            GeneratedFile(
                path="lib/login_screen.dart",
                content=(
                    "import 'package:flutter/material.dart';\n\nimport 'theme.dart';\n\n"
                    "class LoginScreen extends StatelessWidget {\n"
                    "  Widget build(c) => Image.asset('assets/logo.png');\n}\n"
                ),
            ),
            GeneratedFile(
                path="lib/theme.dart",
                content="import 'package:flutter/material.dart';\nclass AppTheme {}\n",
            ),
        ]
    )
    source = preview_compile_source(output, "lib/login_screen.dart")
    assert source is not None
    assert "import 'theme.dart';" not in source  # inlined
    assert "class AppTheme {}" in source
    assert "FlutterLogo" in source and "Image.asset" not in source
    assert "void main() => runApp(MaterialApp(" in source
    assert "home: LoginScreen()" in source


def test_resolve_screen_files_finds_the_demo_pair(tmp_path):
    cfg = _cfg(tmp_path)
    files = resolve_screen_files(cfg, "login")
    assert files["ios_screen"] and files["ios_screen"].name == "LoginView.swift"
    assert files["flutter_screen"] and files["flutter_screen"].name == "login_screen.dart"
    assert files["ios_theme"] and files["ios_theme"].name == "Theme.swift"
    assert files["pubspec"] and files["pubspec"].name == "pubspec.yaml"
