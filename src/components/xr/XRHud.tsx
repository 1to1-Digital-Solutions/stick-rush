'use client'

import { useXR } from '@react-three/xr'
import { LIFE_COLOR } from '@/lib/gameConfig'
import { startingLives } from '@/lib/gameMode'
import { useGame } from '@/lib/gameStore'
import { scoreRatio } from '@/lib/scoring'
import { type StickStatus, stickStatuses } from '@/lib/stickLayout'
import { type ShareStatus, useShareResult } from '@/lib/useShareResult'
import { XR_HUD_POSITION, XR_QUIT_POSITION, XR_QUIT_YAW } from '@/lib/xrLayout'
import {
  PANEL_COLOR,
  XRCheckIcon,
  XRCrossIcon,
  XRHeartIcon,
  XRHomeIcon,
  XRPanel,
  XRPressable,
  XRRepeatIcon,
  XRShareIcon,
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
 *
 * Por lo mismo, el récord es una **marca** sobre el carril y no una cifra: en la
 * escala de esta partida, hasta dónde hay que llegar. Si con la dificultad y el
 * número de palos elegidos el récord ni siquiera es alcanzable, la marca se
 * queda al final del carril, que es exactamente lo que significa.
 */
function ScoreBar({
  ratio,
  recordRatio,
  isRecord,
  width,
}: {
  ratio: number
  recordRatio: number
  isRecord: boolean
  width: number
}) {
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
        <meshBasicMaterial
          color={isRecord ? '#fbbf24' : '#22c55e'}
          toneMapped={false}
        />
      </mesh>
      {/* Marca del récord. Al batirlo crece además de cambiar el color de la
          barra: con las gafas puestas el color solo no basta. */}
      {recordRatio > 0 && (
        <mesh position={[width * (recordRatio - 0.5), 0, 0.008]}>
          <boxGeometry args={[0.005, isRecord ? 0.034 : 0.024, 0.006]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
      )}
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

/** Separación y tamaño de los corazones de vida en el marcador. */
const LIFE_SPACING = 0.05
const LIFE_SIZE = 0.019
/** Dónde va la fila de vidas dentro del marcador, y cuánto lo alarga. */
const LIFE_ROW_Y = -0.105
const LIFE_ROW_HEIGHT = 0.06
/** El gastado se apaga a gris y encoge; el vivo va del rojo de siempre. */
const LIFE_SPENT_COLOR = '#3f4a5a'

/**
 * Vidas que quedan en un desafío: un corazón por vida, encogido y apagado el
 * que se ha gastado. Con el visor puesto es lo que dice si la próxima que se
 * escape cierra la partida, y por eso va debajo de la barra de puntuación, en
 * el sitio fijo del marcador y no entre las fichas de los palos, que se mueven
 * con cuántos haya en juego.
 */
function Lives({ lives, total, y }: { lives: number; total: number; y: number }) {
  const width = (total - 1) * LIFE_SPACING

  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: total }, (_, index) => {
        const spent = index >= lives
        return (
          <XRHeartIcon
            key={index}
            position={[index * LIFE_SPACING - width / 2, 0, 0]}
            size={spent ? LIFE_SIZE * 0.62 : LIFE_SIZE}
            color={spent ? LIFE_SPENT_COLOR : LIFE_COLOR}
          />
        )
      })}
    </group>
  )
}

/** Placas de los botones de fin de partida: la de repetir y la de las demás. */
const PLAY_BUTTON = { color: '#15803d', emissive: '#22c55e', intensity: 0.4 }
const NEUTRAL_BUTTON = { color: '#334155', emissive: '#94a3b8', intensity: 0.2 }
/** Se pudo / no se pudo: el mismo verde y el mismo rojo que las fichas de palo. */
const DONE_BUTTON = { color: '#166534', emissive: '#22c55e', intensity: 0.5 }
const FAILED_BUTTON = { color: '#b91c1c', emissive: '#dc2626', intensity: 0.4 }

/** Separación entre los botones de fin de partida, con aire entre sus zonas. */
const BUTTON_SPACING = 0.16
const BUTTON_HIT: [number, number, number] = [0.15, 0.11, 0.06]
/** Lo que ocupan los tres botones de lado a lado, zonas sensibles incluidas. */
const BUTTONS_WIDTH = BUTTON_SPACING * 2 + BUTTON_HIT[0]

/** Placa de un botón de fin de partida. */
function ButtonPlate({
  style,
}: {
  style: { color: string; emissive: string; intensity: number }
}) {
  return (
    <mesh position={[0, 0, -0.008]}>
      <boxGeometry args={[0.13, 0.09, 0.012]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.emissive}
        emissiveIntensity={style.intensity}
        roughness={0.5}
      />
    </mesh>
  )
}

/**
 * Cómo queda el botón de compartir después de pulsarlo.
 *
 * Con el visor puesto no hay ningún aviso del sistema que diga si el resultado
 * salió, así que lo dice el propio botón: cambia de dibujo *y* de color, nunca
 * solo de color. Cancelar deja el botón como estaba, porque no ha pasado nada.
 */
const SHARE_FEEDBACK: Record<
  ShareStatus,
  { style: typeof NEUTRAL_BUTTON; Icon: typeof XRShareIcon }
> = {
  idle: { style: NEUTRAL_BUTTON, Icon: XRShareIcon },
  cancelled: { style: NEUTRAL_BUTTON, Icon: XRShareIcon },
  shared: { style: DONE_BUTTON, Icon: XRCheckIcon },
  copied: { style: DONE_BUTTON, Icon: XRCheckIcon },
  unavailable: { style: FAILED_BUTTON, Icon: XRCrossIcon },
}

/**
 * Compartir el resultado sin quitarse el visor.
 *
 * Dentro de la sesión la hoja de compartir del sistema puede no abrirse; ahí el
 * texto se queda en el portapapeles y el jugador lo pega al salir (ver
 * `shareResult.ts`). Lo que no puede pasar es que el botón no conteste, y por
 * eso el resultado del intento se ve en la propia placa.
 */
function ShareButton({ position }: { position: [number, number, number] }) {
  const { status, share } = useShareResult()
  const { style, Icon } = SHARE_FEEDBACK[status]

  return (
    <XRPressable
      position={position}
      onSelect={() => void share()}
      hitSize={BUTTON_HIT}
    >
      <ButtonPlate style={style} />
      <Icon position={[0, 0, 0.008]} />
    </XRPressable>
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
    bestPoints,
    isRecord,
    difficulty,
    stickCount,
    gameMode,
    lives,
    gameState,
    startGame,
    resetGame,
  } = useGame()

  // Fuera de sesión inmersiva manda el HUD en DOM, y en el menú manda XRMenu.
  // Durante el tutorial tampoco: un marcador vacío al lado de la demostración
  // es una ficha por palo compitiendo con los palos que la demostración está
  // contando. Aparece con la cuenta atrás, que es cuando empieza a medir algo.
  if (mode == null || gameState === 'menu' || gameState === 'tutorial') {
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
  const recordRatio = scoreRatio(bestPoints, difficulty, stickCount)
  // En desafío el marcador crece para dejarles sitio: las vidas se ven durante
  // la partida y siguen ahí al acabar, que es con las que se acabó.
  const totalLives = startingLives(gameMode)
  const showLives = lives != null && totalLives != null

  return (
    <group position={XR_HUD_POSITION}>
      {/* Panel de fondo: en AR el mundo real está detrás, sin él las fichas
          pierden contraste sobre cualquier pared. */}
      <XRPanel
        // Al acabar, el ancho no puede depender de cuántos palos se jugaran:
        // con los pocos de una partida corta, la fila de tres botones se
        // saldría del panel y perdería el fondo que la despega del passthrough.
        width={Math.max(width + 0.2, finished ? BUTTONS_WIDTH + 0.06 : 0)}
        height={(finished ? 0.42 : 0.27) + (showLives ? LIFE_ROW_HEIGHT : 0)}
        color={PANEL_COLOR}
        opacity={0.72}
      />

      <group position={[0, finished ? 0.1 : 0.04, 0]}>
        {tokens.map((token) => (
          <Token key={token.index} state={token.state} x={token.x} />
        ))}
        <StreakPips streak={streak} />
        <ScoreBar
          ratio={ratio}
          recordRatio={recordRatio}
          isRecord={isRecord}
          width={Math.max(width, 0.28)}
        />
        {showLives && <Lives lives={lives} total={totalLives} y={LIFE_ROW_Y} />}
      </group>

      {/*
        Al acabar, la partida ya no encadena sola: el jugador decide. Antes se
        reiniciaba tras una pausa y no había forma de volver a elegir palos ni
        dificultad sin quitarse el visor.
      */}
      {finished && (
        <group position={[0, -0.12, 0]}>
          <XRPressable
            position={[-BUTTON_SPACING, 0, 0]}
            onSelect={startGame}
            hitSize={BUTTON_HIT}
          >
            <ButtonPlate style={PLAY_BUTTON} />
            <XRRepeatIcon position={[0, 0, 0.008]} size={0.026} />
          </XRPressable>

          {/* En medio: compartir es lo nuevo, y así repetir y volver al menú
              siguen en las puntas donde ya estaban. */}
          <ShareButton position={[0, 0, 0]} />

          <XRPressable
            position={[BUTTON_SPACING, 0, 0]}
            onSelect={resetGame}
            hitSize={BUTTON_HIT}
          >
            <ButtonPlate style={NEUTRAL_BUTTON} />
            <XRHomeIcon position={[0, 0, 0.008]} />
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
    // El giro cuelga del botón, no de la placa: girando solo la placa, su borde
    // izquierdo se adelantaba por delante del icono y se comía el dibujo desde
    // ese lado. Es lo que hacía ilegible al icono anterior, cuya punta de flecha
    // caía justo en la parte que quedaba enterrada.
    <XRPressable
      position={XR_QUIT_POSITION}
      rotation={[0, XR_QUIT_YAW, 0]}
      onSelect={resetGame}
      hitSize={[0.16, 0.14, 0.08]}
    >
      <mesh>
        <boxGeometry args={[0.12, 0.1, 0.012]} />
        <meshStandardMaterial
          color="#334155"
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
      <XRHomeIcon position={[0, 0, 0.012]} />
    </XRPressable>
  )
}
