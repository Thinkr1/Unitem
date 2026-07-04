#!/usr/bin/env bash
# One-command verification of the whole "real simulator" feature set: UI
# build/lint, the Electron device-bridge syntax, and (where the platform
# tooling exists) actually booting a real iOS Simulator + building/
# installing/launching sample-ios, and booting a real Android emulator.
#
# Run from anywhere: ./scripts/verify-simulators.sh
#
# Each check prints PASS / FAIL / SKIP. Sections that need tooling this
# machine doesn't have (e.g. Xcode on Linux, an Android SDK with no AVDs)
# are SKIPped rather than failed. Exits non-zero if anything actually FAILed.
#
# This exists because a cloud agent without macOS/Android SDK/KVM access can
# verify the build + the device-bridge's error handling, but literally cannot
# execute `xcrun`/`emulator` itself — this script is what you run locally to
# cover the rest.
set +e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
SKIP=0

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1${2:+ — $2}"; FAIL=$((FAIL + 1)); }
skip() { echo "  SKIP  $1${2:+ — $2}"; SKIP=$((SKIP + 1)); }
section() { echo; echo "== $1 =="; }

# ── UI build / lint / syntax ─────────────────────────────────────────────────
section "UI (build + lint + syntax)"
if [[ -d "$REPO_ROOT/UI" ]]; then
  (cd "$REPO_ROOT/UI" && npm install --silent) >/tmp/verify-ui-install.log 2>&1 &&
    pass "npm install" || fail "npm install" "see /tmp/verify-ui-install.log"
  (cd "$REPO_ROOT/UI" && npm run build) >/tmp/verify-ui-build.log 2>&1 &&
    pass "npm run build" || fail "npm run build" "see /tmp/verify-ui-build.log"
  (cd "$REPO_ROOT/UI" && npm run lint) >/tmp/verify-ui-lint.log 2>&1 &&
    pass "npm run lint" || fail "npm run lint" "see /tmp/verify-ui-lint.log"
  for f in electron/deviceBridge.cjs electron/main.cjs electron/preload.cjs; do
    node --check "$REPO_ROOT/UI/$f" >/tmp/verify-syntax.log 2>&1 &&
      pass "node --check $f" || fail "node --check $f" "see /tmp/verify-syntax.log"
  done
else
  fail "UI/ directory" "not found at $REPO_ROOT/UI"
fi

# ── iOS Simulator (macOS + Xcode only) ───────────────────────────────────────
section "iOS Simulator"
if [[ "$(uname)" != "Darwin" ]]; then
  skip "iOS Simulator checks" "not macOS"
elif ! command -v xcrun >/dev/null 2>&1; then
  skip "iOS Simulator checks" "xcrun not found — install Xcode + Command Line Tools"
else
  pass "xcrun present"

  UDID=$(xcrun simctl list devices available -j 2>/dev/null | python3 -c '
import json, sys
data = json.load(sys.stdin)
for devices in data["devices"].values():
    for d in devices:
        print(d["udid"])
        sys.exit(0)
sys.exit(1)
' 2>/dev/null)

  if [[ -z "$UDID" ]]; then
    fail "find an available simulator" "none found — install a runtime via Xcode > Settings > Platforms"
  else
    pass "found simulator ($UDID)"

    xcrun simctl boot "$UDID" >/tmp/verify-ios-boot.log 2>&1
    if [[ $? -eq 0 ]] || grep -qi "already booted" /tmp/verify-ios-boot.log; then
      pass "xcrun simctl boot"
    else
      fail "xcrun simctl boot" "see /tmp/verify-ios-boot.log"
    fi

    open -a Simulator --args -CurrentDeviceUDID "$UDID" >/tmp/verify-ios-open.log 2>&1 &&
      pass "open -a Simulator (real window)" || fail "open -a Simulator (real window)" "see /tmp/verify-ios-open.log"

    sleep 3
    STATE=$(xcrun simctl list devices -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for devices in data['devices'].values():
    for d in devices:
        if d['udid'] == '$UDID':
            print(d['state'])
            sys.exit(0)
")
    [[ "$STATE" == "Booted" ]] &&
      pass "device state is Booted" || fail "device state is Booted" "was: '$STATE'"

    if command -v xcodegen >/dev/null 2>&1; then
      pass "xcodegen present"

      (cd "$REPO_ROOT/sample-ios" && xcodegen generate) >/tmp/verify-ios-xcodegen.log 2>&1 &&
        pass "xcodegen generate" || fail "xcodegen generate" "see /tmp/verify-ios-xcodegen.log"

      (cd "$REPO_ROOT/sample-ios" && xcodebuild -project SampleLogin.xcodeproj -scheme SampleLogin \
        -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
        -derivedDataPath build build) >/tmp/verify-ios-xcodebuild.log 2>&1
      BUILD_RC=$?
      APP_PATH="$REPO_ROOT/sample-ios/build/Build/Products/Debug-iphonesimulator/SampleLogin.app"
      if [[ $BUILD_RC -eq 0 && -d "$APP_PATH" ]]; then
        pass "xcodebuild sample-ios (produces $APP_PATH)"
      else
        fail "xcodebuild sample-ios" "see /tmp/verify-ios-xcodebuild.log"
      fi

      if [[ -d "$APP_PATH" ]]; then
        xcrun simctl install "$UDID" "$APP_PATH" >/tmp/verify-ios-install.log 2>&1 &&
          pass "simctl install" || fail "simctl install" "see /tmp/verify-ios-install.log"

        LAUNCH_OUT=$(xcrun simctl launch "$UDID" com.unitem.sample.login 2>/tmp/verify-ios-launch.log)
        if [[ $? -eq 0 ]]; then
          PID=$(echo "$LAUNCH_OUT" | awk -F: '{print $2}' | tr -d ' ')
          pass "simctl launch (pid $PID)"
          sleep 1
          if xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "com.unitem.sample.login"; then
            pass "app process confirmed running on device"
          else
            fail "app process confirmed running on device" "not found via launchctl list"
          fi
        else
          fail "simctl launch" "see /tmp/verify-ios-launch.log"
        fi
      fi
    else
      skip "sample-ios build/install/launch" "xcodegen not found — brew install xcodegen"
    fi
  fi
fi

# ── Android emulator ──────────────────────────────────────────────────────────
section "Android Emulator"

EMULATOR_BIN="emulator"
ADB_BIN="adb"
for root in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
  [[ -n "$root" && -x "$root/emulator/emulator" ]] && EMULATOR_BIN="$root/emulator/emulator"
  [[ -n "$root" && -x "$root/platform-tools/adb" ]] && ADB_BIN="$root/platform-tools/adb"
done

if ! command -v "$EMULATOR_BIN" >/dev/null 2>&1; then
  skip "Android emulator checks" "no emulator binary found on PATH, \$ANDROID_HOME, or \$ANDROID_SDK_ROOT"
else
  pass "emulator binary found ($EMULATOR_BIN)"

  AVD=$("$EMULATOR_BIN" -list-avds 2>/tmp/verify-android-avds.log | head -n1)
  if [[ -z "$AVD" ]]; then
    fail "find an AVD" "none found — create one in Android Studio's Device Manager"
  else
    pass "found AVD ($AVD)"

    "$EMULATOR_BIN" -avd "$AVD" -netdelay none -netspeed full >/tmp/verify-android-emulator.log 2>&1 &
    EMU_PID=$!
    sleep 2
    if kill -0 "$EMU_PID" 2>/dev/null; then
      pass "emulator process started (pid $EMU_PID)"
    else
      fail "emulator process started" "exited immediately — see /tmp/verify-android-emulator.log"
    fi

    echo "  waiting up to 120s for boot_completed…"
    BOOTED=0
    SERIAL=""
    for _ in $(seq 1 40); do
      SERIAL=$("$ADB_BIN" devices 2>/dev/null | awk '/^emulator-/{print $1; exit}')
      if [[ -n "$SERIAL" ]]; then
        RESULT=$("$ADB_BIN" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
        if [[ "$RESULT" == "1" ]]; then
          BOOTED=1
          break
        fi
      fi
      sleep 3
    done
    [[ $BOOTED -eq 1 ]] &&
      pass "emulator fully booted ($SERIAL)" || fail "emulator fully booted" "timed out after 120s"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
section "Summary"
echo "  $PASS passed, $FAIL failed, $SKIP skipped"
if [[ $FAIL -eq 0 ]]; then
  echo "  Overall: PASS"
else
  echo "  Overall: FAIL"
fi
exit "$FAIL"
