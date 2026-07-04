#!/usr/bin/env bash
# Build the Unitem sample login screen and run it for real in the iOS
# Simulator: generate the Xcode project, boot the simulator (real window),
# build, install, and launch — end to end, one command.
#
# Usage: ./run.sh ["iPhone 15"]
set -euo pipefail

DEVICE_NAME="${1:-iPhone 15}"
SCHEME="SampleLogin"
BUNDLE_ID="com.unitem.sample.login"

cd "$(dirname "$0")"

command -v xcodegen >/dev/null 2>&1 || {
  echo "error: xcodegen not found. Install it with: brew install xcodegen" >&2
  exit 1
}
command -v xcodebuild >/dev/null 2>&1 || {
  echo "error: xcodebuild not found. Install Xcode + the Command Line Tools." >&2
  exit 1
}
[[ "$(uname)" == "Darwin" ]] || {
  echo "error: the iOS Simulator only exists on macOS." >&2
  exit 1
}

echo "==> Generating Xcode project from project.yml"
xcodegen generate

echo "==> Resolving simulator UDID for '$DEVICE_NAME'"
UDID=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
data = json.load(sys.stdin)
name = '$DEVICE_NAME'
for devices in data['devices'].values():
    for d in devices:
        if d['name'] == name:
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
") || {
  echo "error: no available simulator named '$DEVICE_NAME'." >&2
  echo "       List options with: xcrun simctl list devices available" >&2
  exit 1
}

echo "==> Booting $DEVICE_NAME ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"

DERIVED_DATA="$(pwd)/build"
echo "==> Building $SCHEME for the simulator (this can take a minute the first time)"
xcodebuild \
  -project "$SCHEME.xcodeproj" \
  -scheme "$SCHEME" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/$SCHEME.app"

echo "==> Installing $APP_PATH"
xcrun simctl install "$UDID" "$APP_PATH"

echo "==> Launching $BUNDLE_ID"
xcrun simctl launch "$UDID" "$BUNDLE_ID"

echo "==> Done. The real Login screen is now running in Simulator.app."
