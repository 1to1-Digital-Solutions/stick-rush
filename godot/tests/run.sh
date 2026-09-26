#!/usr/bin/env bash
#
# La suite de Stick Rush dentro del motor, entera:
#
#   GODOT=… godot/tests/run.sh        (desde la raíz del repo; `npm run godot:test`)
#
# 1. El build del kit con los tests (`npm run godot:build -- --tests`) y la importación.
# 2. Los tests de dominio: los de `src/lib` que entran en el motor, los del kit (guardado,
#    interfaz, gramática del visor) y los del port (`scene/**/*.motor.test.ts`: la partida contra
#    el store de la web, la tanda contra `Stick.tsx`, el mundo, los paneles medidos con el
#    instrumento de la web y pulsados con el ratón).
# 3. Cada escena de test de `games/stick-rush/tests/` (la partida automática hasta el final y el
#    reto del salón, el menú y los palos con el ratón en la escena de verdad, dos partidas cogiendo
#    palos con la mano con visor simulado), con `--fixed-fps 72`, como el jugador automático.
#
# `--xr-mode off`: sin runtime de OpenXR (cualquier Mac) el motor se quedaría esperando.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PROJECT/.." && pwd)"
GODOT_BIN="${GODOT:-$(command -v godot || true)}"
if [ -z "$GODOT_BIN" ]; then
  echo "No encuentro Godot: exporta \$GODOT con el editor compilado con GodotJS." >&2
  exit 1
fi

(cd "$REPO" && npm run --silent godot:build -- --tests)
"$GODOT_BIN" --headless --xr-mode off --path "$PROJECT" --import >/dev/null 2>&1 || true

fallos=0
correr() {
  local escena="$1"
  local salida
  if salida="$("$GODOT_BIN" --headless --xr-mode off --fixed-fps 72 --path "$PROJECT" "$escena" 2>&1)"; then
    echo "$salida" | grep -E '^[A-Z-]+ (ok|files=)|DOMAIN-TESTS|^PARTIDA-AUTO|^XR-MANDO caso' || echo "ok $escena"
  else
    echo "$salida" | grep -E 'FAIL|CRASH|ERROR|DOMAIN-TESTS' | head -40
    echo "FALLA $escena" >&2
    fallos=$((fallos + 1))
  fi
}

correr res://games/stick-rush/tests/domain_tests.tscn
for escena in "$PROJECT"/games/stick-rush/tests/*.tscn; do
  nombre="$(basename "$escena")"
  [ "$nombre" = domain_tests.tscn ] && continue
  correr "res://games/stick-rush/tests/$nombre"
done

exit $((fallos > 0))
