'use client'

import { useXR } from '@react-three/xr'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  MAX_STICKS,
  MIN_STICKS,
  STICK_COLOR,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import {
  XR_DIFFICULTY_SPACING,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_POSITION,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_PICKER_SPACING,
} from '@/lib/xrLayout'
import {
  PANEL_COLOR,
  XRBackIcon,
  XRPanel,
  XRPassthroughIcon,
  XRPlayIcon,
  XRPressable,
  XRSceneIcon,
} from './XRUi'

/**
 * Menú de partida para sesiones inmersivas.
 *
 * En VR/AR no hay DOM, así que la pantalla de inicio no se ve: antes la sesión
 * arrancaba una partida sola y el jugador no podía elegir nada. Este menú la
 * sustituye con geometría, delante del jugador y a la altura de los ojos.
 *
 * **Sin una sola letra, a propósito.** `<Text>` de drei descarga las fuentes de
 * un CDN (troika las resuelve contra jsDelivr) y el juego debe funcionar en un
 * visor sin salida a internet —además, la CSP lo bloquea—. Así que cada ajuste
 * se representa por lo que significa: el número de palos, con los propios
 * palos; la dificultad, con barras que crecen y el color que ya usa el menú de
 * escritorio. Cada estado se distingue por forma *y* color, nunca solo color.
 */

// El layout vive en `@/lib/xrLayout` para que los tests de sesión inmersiva
// apunten el mando exactamente a estos mismos puntos.
const STICK_PICKER_SPACING = XR_STICK_PICKER_SPACING
const DIFFICULTY_SPACING = XR_DIFFICULTY_SPACING

/**
 * Selector del número de palos: una fila con los 13 posibles, encendidos hasta
 * el elegido. Se lee contando y es literalmente lo que colgará de la máquina.
 * Tocar uno selecciona ese número (el store recorta al rango permitido).
 */
function StickPicker() {
  const { stickCount, setStickCount } = useGame()
  const width = (MAX_STICKS - 1) * STICK_PICKER_SPACING

  return (
    <group position={[0, 0.16, 0]}>
      {Array.from({ length: MAX_STICKS }, (_, index) => {
        const count = index + 1
        const on = count <= stickCount
        const selectable = count >= MIN_STICKS
        return (
          <XRPressable
            key={count}
            position={[index * STICK_PICKER_SPACING - width / 2, 0, 0]}
            onSelect={() => setStickCount(count)}
            disabled={!selectable}
            hitSize={[STICK_PICKER_SPACING, 0.16, 0.05]}
          >
            {/* Un palo en miniatura: encendido si entra en la selección. */}
            <mesh position={[0, on ? 0.008 : 0, 0]}>
              <cylinderGeometry
                args={[0.008, 0.008, on ? 0.11 : 0.075, 8]}
              />
              <meshStandardMaterial
                color={on ? STICK_COLOR : '#3d4654'}
                emissive={STICK_COLOR}
                emissiveIntensity={on ? 0.55 : 0}
                roughness={0.6}
              />
            </mesh>
          </XRPressable>
        )
      })}
    </group>
  )
}

/**
 * Selector de dificultad: cinco fichas con 1 a 5 barras crecientes, del verde
 * al rojo. La elegida se adelanta y se ilumina, así que no depende del color.
 */
function DifficultyPicker() {
  const { difficulty, setDifficulty } = useGame()
  const width = (DIFFICULTY_ORDER.length - 1) * DIFFICULTY_SPACING

  return (
    <group position={[0, -0.04, 0]}>
      {DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === difficulty
        const color = DIFFICULTY_COLORS[level]
        return (
          <XRPressable
            key={level}
            position={[index * DIFFICULTY_SPACING - width / 2, 0, selected ? 0.022 : 0]}
            onSelect={() => setDifficulty(level)}
            hitSize={[DIFFICULTY_SPACING * 0.92, 0.15, 0.05]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[DIFFICULTY_SPACING * 0.82, 0.13, 0.012]} />
              <meshStandardMaterial
                color={selected ? color : '#1c2634'}
                emissive={color}
                emissiveIntensity={selected ? 0.5 : 0.06}
                roughness={0.55}
              />
            </mesh>
            {/* Barras: tantas como nivel, cada una más alta que la anterior. */}
            {Array.from({ length: index + 1 }, (_, bar) => {
              const height = 0.028 + bar * 0.017
              return (
                <mesh
                  key={bar}
                  position={[
                    (bar - index / 2) * 0.022,
                    -0.04 + height / 2,
                    0.004,
                  ]}
                >
                  <boxGeometry args={[0.013, height, 0.008]} />
                  <meshStandardMaterial
                    color={selected ? '#ffffff' : color}
                    emissive={selected ? '#ffffff' : color}
                    emissiveIntensity={selected ? 0.7 : 0.25}
                    toneMapped={false}
                  />
                </mesh>
              )
            })}
          </XRPressable>
        )
      })}
    </group>
  )
}

/**
 * Escenario o habitación real, sin salir de la sesión.
 *
 * En una sesión `immersive-ar` los dos modos son la misma sesión pintada de dos
 * formas, así que el cambio es inmediato (con su fundido, ver `SceneryFade`).
 * En una sesión `immersive-vr` no hay passthrough que enseñar —el visor no lo
 * entrega—, así que la opción se muestra apagada en vez de mentir.
 */
function SceneryPicker({ passthroughAvailable }: { passthroughAvailable: boolean }) {
  const { scenery, setScenery } = useGame()

  const options = [
    { key: 'scene' as const, Icon: XRSceneIcon, enabled: true },
    {
      key: 'passthrough' as const,
      Icon: XRPassthroughIcon,
      enabled: passthroughAvailable,
    },
  ]

  return (
    <group position={XR_SCENERY_PICKER_OFFSET}>
      {options.map(({ key, Icon, enabled }, index) => {
        const selected = scenery === key
        return (
          <XRPressable
            key={key}
            position={[index * 0.15 - 0.075, 0, selected ? 0.02 : 0]}
            onSelect={() => setScenery(key)}
            disabled={!enabled}
            hitSize={[0.14, 0.12, 0.06]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[0.12, 0.1, 0.012]} />
              <meshStandardMaterial
                color={selected ? '#1d4ed8' : '#1c2634'}
                emissive="#60a5fa"
                emissiveIntensity={selected ? 0.45 : 0.05}
                roughness={0.5}
                // Apagada de verdad cuando el visor no da passthrough: el
                // estado se distingue por opacidad y no solo por color.
                transparent
                opacity={enabled ? 1 : 0.35}
              />
            </mesh>
            <Icon
              position={[0, 0, 0.008]}
              size={0.028}
              color={enabled ? '#ffffff' : '#64748b'}
            />
          </XRPressable>
        )
      })}
    </group>
  )
}

export function XRMenu() {
  const mode = useXR((state) => state.mode)
  const session = useXR((state) => state.session)
  const { gameState, startGame } = useGame()

  // Fuera de sesión inmersiva manda la pantalla de inicio en DOM.
  if (mode == null || gameState !== 'menu') {
    return null
  }

  return (
    <group position={XR_MENU_POSITION}>
      <XRPanel width={1.06} height={0.74} color={PANEL_COLOR} />
      <StickPicker />
      <DifficultyPicker />
      <SceneryPicker passthroughAvailable={mode === 'immersive-ar'} />

      {/* Empezar */}
      <XRPressable
        position={[0, -0.29, 0]}
        onSelect={startGame}
        hitSize={[0.36, 0.13, 0.06]}
      >
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.32, 0.1, 0.014]} />
          <meshStandardMaterial
            color="#15803d"
            emissive="#22c55e"
            emissiveIntensity={0.45}
            roughness={0.45}
          />
        </mesh>
        <XRPlayIcon position={[0, 0, 0.008]} />
      </XRPressable>

      {/* Salir del visor. Desde el menú inmersivo no había forma de volver sin
          quitarse las gafas: el botón del sistema no siempre está a mano. */}
      <XRPressable
        position={XR_MENU_EXIT_OFFSET}
        onSelect={() => void session?.end()}
        hitSize={[0.16, 0.13, 0.06]}
      >
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.13, 0.1, 0.014]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#94a3b8"
            emissiveIntensity={0.22}
            roughness={0.5}
          />
        </mesh>
        <XRBackIcon position={[-0.008, 0, 0.008]} size={0.026} />
      </XRPressable>
    </group>
  )
}
