#!/usr/bin/env python3
"""CLI entrypoint for Design Diplomat detect step."""

import argparse
import json

from engine.detect import detect


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect atomic UI changes")
    parser.add_argument("--screen", default="Settings")
    parser.add_argument("--mode", default="token", choices=["token", "code"])
    args = parser.parse_args()
    result = detect(screen=args.screen, mode=args.mode)
    print(json.dumps({"atomic_changes": result}, indent=2))


if __name__ == "__main__":
    main()
