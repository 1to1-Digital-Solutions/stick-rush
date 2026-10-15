#!/usr/bin/env bash
#
# The Stick Rush suite inside the engine, whole:
#
#   GODOT=… godot/tests/run.sh        (from the root of the repo; `npm run godot:test`)
#
# 1. The kit's build with the tests (`npm run godot:build -- --tests`) and the import.
# 2. The domain tests: those of `src/lib` that go into the engine, those of the kit (save, ui,
#    headset grammar) and those of the port (`scene/**/*.engine.test.ts`: the run against the
#    web's store, the round against `Stick.tsx`, the world, the panels measured with the web's
#    instrument and pressed with the mouse).
# 3. Each test scene of `games/stick-rush/tests/` (the automatic run to the end and the hall
#    challenge, the menu and the sticks with the mouse in the real scene, two runs catching sticks
#    with the hand with a simulated headset), with `--fixed-fps 72`, like the automatic player.
#
# `--xr-mode off`: without an OpenXR runtime (any Mac) the engine would stay waiting.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PROJECT/.." && pwd)"
GODOT_BIN="${GODOT:-$(command -v godot || true)}"
if [ -z "$GODOT_BIN" ]; then
  echo "Cannot find Godot: export \$GODOT with the editor built with GodotJS." >&2
  exit 1
fi
# The cap of each run of the engine (a hung engine is a failure and not a round that does not end)
# and the search for script errors in its output (one at run time does not stop the engine, and the
# test came out green): common to all the games, in the kit.
KIT_RUNNER="$REPO/../xrcade/godot-kit/runner/timeout.sh"
if [ ! -f "$KIT_RUNNER" ]; then
  echo "This script needs $KIT_RUNNER, which is not there: the xrcade hub (a private repository) has to be checked out next to this one." >&2
  exit 1
fi
source "$KIT_RUNNER"

(cd "$REPO" && npm run --silent godot:build -- --tests)
con_tope "$TOPE_GODOT" "$GODOT_BIN" --headless --xr-mode off --path "$PROJECT" --import >/dev/null 2>&1 || true

failures=0
run_scene() {
  local scene="$1"
  local output status=0
  output="$(con_tope "$TOPE_GODOT" "$GODOT_BIN" --headless --xr-mode off --fixed-fps 72 --path "$PROJECT" "$scene" 2>&1)" || status=$?
  if [ "$status" -eq 0 ] && errores_de_script "$output"; then
    echo "$output" | grep -E '^[A-Z-]+ (ok|files=)|DOMAIN-TESTS|^AUTO-RUN|^XR-CONTROLLER case' || echo "ok $scene"
  else
    # If it exited with 0, what failed are the script errors, which `errores_de_script` already showed.
    if [ "$status" -ne 0 ]; then echo "$output" | grep -E 'FAIL|CRASH|ERROR|DOMAIN-TESTS|✗' | head -40; fi
    echo "FAILS $scene" >&2
    failures=$((failures + 1))
  fi
}

run_scene res://games/stick-rush/tests/domain_tests.tscn
for scene in "$PROJECT"/games/stick-rush/tests/*.tscn; do
  name="$(basename "$scene")"
  [ "$name" = domain_tests.tscn ] && continue
  run_scene "res://games/stick-rush/tests/$name"
done

exit $((failures > 0))
