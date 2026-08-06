'use client'

import { useXR } from '@react-three/xr'
import { useGame } from '@/lib/gameStore'
import { scoreRatio } from '@/lib/scoring'
import { type StickStatus, stickStatuses } from '@/lib/stickLayout'
import { XR_HUD_POSITION, XR_QUIT_POSITION } from '@/lib/xrLayout'
import {
  PANEL_COLOR,
  XRBackIcon,
  XRPanel,
  XRPressable,
  XRRepeatIcon,
} from './XRUi'

/**
 * Marcador dentro de la escena, para sesiones inmersivas.
 *
 * El HUD normal es DOM y en inmersivo no se ve, así que el jugador se quedaba
 * sin marcador ni resultado. Este lo sustituye con geometría: una ficha por
 * palo, atrapado / perdido / pendiente.
 *
 * No usa texto a propósito: `<Text>` de drei descarga las fuentes de un CDN
 * (troika resuelve la tipografía contra jsdelivr), y el juego debe verse aunque
 * el visor esté en una red local sin salida. Cada estado se distingue por color
 * *y* por tamaño y altura, para no depender solo del color.
 *
 * Va dentro de <XROrigin>, así que sus medidas son metros vistos por el
 * jugador. Queda por delante y por debajo del aro para no cruzarse con los
 * palos que caen.
 */

const TOKEN_SPACING = 0.07
const TOKEN_RADIUS = 0.026

const TOKEN_STYLE: Record<
  StickStatus,
  { color: string; emissive: number; scale: number; lift: number }
> = {
  // Atrapado: verde, ficha grande y elevada.
  caught: { color: '#22c55e', emissive: 1.4, scale: 1.15, lift: 0.012 },
  // Perdido: rojo, ficha pequeña y hundida.
  missed: { color: '#dc2626', emissive: 0.25, scale: 0.7, lift: -0.012 },
  // Pendiente: gris apagado, tamaño intermedio.
  pending: { color: '#475569', emissive: 0, scale: 0.9, lift: 0 },
}

/**
 * Barra de puntuación: se llena conforme el jugador se acerca al máximo posible
 * de esa partida.
 *
 * Es la forma de dar puntos sin escribir un número. `<Text>` de drei descargaría
 * la fuente de un CDN que la CSP bloquea, así que la puntuación se lee como
 * proporción —cuánto has sacado de lo que había— que además es más útil de un
 * vistazo que una cifra absoluta sin escala.
 */
function ScoreBar({ ratio, width }: { ratio: number; width: number }) {
  const filled = Math.max(width * ratio, 0.001)

  return (
    <group position={[0, -0.055, 0]}>
      {/* Carril */}
      <mesh>
        <boxGeometry args={[width, 0.012, 0.006]} />
        <meshBasicMaterial color="#1c2634" toneMapped={false} />
      </mesh>
      {/* Relleno, anclado a la izquierda para que crezca hacia la derecha. */}
      <mesh position={[(filled - width) / 2, 0, 0.004]}>
        <boxGeometry args={[filled, 0.012, 0.006]} />
        <meshBasicMaterial color="#22c55e" toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Racha viva: una cuña por palo encadenado, hasta cinco. A partir de ahí no
 * añaden información y solo ensanchan el marcador.
 */
function StreakPips({ streak }: { streak: number }) {
  const shown = Math.min(streak, 5)
  if (shown < 2) return null

  return (
    <group position={[0, 0.06, 0]}>
      {Array.from({ length: shown }, (_, index) => (
        <mesh
          key={index}
          position={[(index - (shown - 1) / 2) * 0.026, 0, 0]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[0.012, 0.012, 0.006]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Token({ state, x }: { state: StickStatus; x: number }) {
  const style = TOKEN_STYLE[state]

  return (
    <mesh
      position={[x, style.lift, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={style.scale}
    >
      <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, 0.014, 16]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.color}
        emissiveIntensity={style.emissive}
        metalness={0.2}
        roughness={0.5}
      />
    </mesh>
  )
}

export function XRHud() {
  const mode = useXR((state) => state.mode)
  const {
    score,
    resolved,
    points,
    streak,
    difficulty,
    stickCount,
    gameState,
    startGame,
    resetGame,
  } = useGame()

  // Fuera de sesión inmersiva manda el HUD en DOM, y en el menú manda XRMenu.
  if (mode == null || gameState === 'menu') {
    return null
  }

  const width = Math.max(stickCount - 1, 0) * TOKEN_SPACING
  const tokens = stickStatuses(score, resolved, stickCount).map(
    (state, index) => ({
      index,
      state,
      x: index * TOKEN_SPACING - width / 2,
    }),
  )
  const finished = gameState === 'finished'
  const ratio = scoreRatio(points, difficulty, stickCount)

  return (
    <group position={XR_HUD_POSITION}>
      {/* Panel de fondo: en AR el mundo real está detrás, sin él las fichas
          pierden contraste sobre cualquier pared. */}
      <XRPanel
        width={width + 0.2}
        height={finished ? 0.42 : 0.27}
        color={PANEL_COLOR}
        opacity={0.72}
      />

      <group position={[0, finished ? 0.1 : 0.04, 0]}>
        {tokens.map((token) => (
          <Token key={token.index} state={token.state} x={token.x} />
        ))}
        <StreakPips streak={streak} />
        <ScoreBar ratio={ratio} width={Math.max(width, 0.28)} />
      </group>

      {/*
        Al acabar, la partida ya no encadena sola: el jugador decide. Antes se
        reiniciaba tras una pausa y no había forma de volver a elegir palos ni
        dificultad sin quitarse el visor.
      */}
      {finished && (
        <group position={[0, -0.12, 0]}>
          <XRPressable
            position={[-0.09, 0, 0]}
            onSelect={startGame}
            hitSize={[0.15, 0.11, 0.06]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[0.13, 0.09, 0.012]} />
              <meshStandardMaterial
                color="#15803d"
                emissive="#22c55e"
                emissiveIntensity={0.4}
                roughness={0.5}
              />
            </mesh>
            <XRRepeatIcon position={[0, 0, 0.008]} size={0.026} />
          </XRPressable>

          <XRPressable
            position={[0.09, 0, 0]}
            onSelect={resetGame}
            hitSize={[0.15, 0.11, 0.06]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[0.13, 0.09, 0.012]} />
              <meshStandardMaterial
                color="#334155"
                emissive="#94a3b8"
                emissiveIntensity={0.2}
                roughness={0.5}
              />
            </mesh>
            <XRBackIcon position={[-0.008, 0, 0.008]} size={0.024} />
          </XRPressable>
        </group>
      )}
    </group>
  )
}

/**
 * Botón de volver al menú durante la partida, apartado a un lado para no
 * cruzarse con los palos. Sin él, entrar en una partida en el visor era un
 * callejón sin salida: no había forma de cambiar de opciones.
 */
export function XRQuitButton() {
  const mode = useXR((state) => state.mode)
  const { gameState, resetGame } = useGame()

  // También durante la cuenta atrás: si al jugador se le ocurre que se ha
  // equivocado de opciones, esos tres segundos son su última oportunidad.
  if (mode == null || (gameState !== 'playing' && gameState !== 'countdown')) {
    return null
  }

  return (
    <XRPressable
      position={XR_QUIT_POSITION}
      onSelect={resetGame}
      hitSize={[0.16, 0.14, 0.08]}
    >
      <mesh rotation={[0, Math.PI / 7, 0]}>
        <boxGeometry args={[0.12, 0.1, 0.012]} />
        <meshStandardMaterial
          color="#334155"
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
      <XRBackIcon position={[-0.008, 0, 0.012]} size={0.024} />
    </XRPressable>
  )
}
