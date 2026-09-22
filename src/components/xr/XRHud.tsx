'use client'

import { useXR } from '@react-three/xr'
import { LIFE_COLOR } from '../../lib/gameConfig'
import { startingLives } from '../../lib/gameMode'
import { useCallback } from 'react'

import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/ajustesCliente'
import { traductor, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { scoreRatio } from '../../lib/scoring'
import { type StickStatus, stickStatuses } from '../../lib/stickLayout'
import { type ShareStatus, useShareResult } from '../useShareResult'
import {
  XR_END_RUN_POSITION,
  XR_END_RUN_YAW,
  XR_HUD_PANEL,
  XR_HUD_POSITION,
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
} from '../../lib/xrLayout'
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
  XRStarsRow,
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
/** Dónde va la fila de vidas dentro del marcador. Cuánto lo alarga lo dice `XR_HUD_PANEL`. */
const LIFE_ROW_Y = -0.105
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
 * `shareOrCopy.ts`). Lo que no puede pasar es que el botón no conteste, y por
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

export function XRHud({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const {
    score,
    resolved,
    points,
    streak,
    bestPoints,
    isRecord,
    activeDifficulty: difficulty,
    activeStickCount: stickCount,
    gameMode,
    endless,
    levelResult,
    waveScore,
    waveResolved,
    lives,
    gameState,
    startGame,
    resetGame,
  } = useGame()
  const sinFin = gameMode === 'practice' && endless
  // Fuera de sesión inmersiva manda el HUD en DOM, y en el menú manda XRMenu.
  // Aparece con la cuenta atrás, que es cuando empieza a medir algo. Ya no hay
  // fase de tutorial que esquivar: la lección corre con la partida en marcha y
  // su panel se planta por encima de este (ver `XR_TUTORIAL_POSITION`).
  if ((hasDomUi && mode == null) || gameState === 'menu') {
    return null
  }

  const width = Math.max(stickCount - 1, 0) * TOKEN_SPACING
  // Sin fin, las fichas son las de la tanda que cuelga: las de la partida
  // entera no cabrían, y la barra de abajo ya cuenta lo acumulado.
  const tokens = stickStatuses(
    sinFin ? waveScore : score,
    sinFin ? waveResolved : resolved,
    stickCount,
  ).map(
    (state, index) => ({
      index,
      state,
      x: index * TOKEN_SPACING - width / 2,
    }),
  )
  const finished = gameState === 'finished'
  // Sin fin los puntos no tienen techo: la barra mide la racha viva contra la
  // mejor racha, que es lo que se guarda de ese modo.
  const ratio = sinFin
    ? Math.min(1, streak / Math.max(bestPoints, streak, 1))
    : scoreRatio(points, difficulty, stickCount)
  const recordRatio = sinFin
    ? bestPoints > 0
      ? Math.min(1, bestPoints / Math.max(bestPoints, streak, 1))
      : 0
    : scoreRatio(bestPoints, difficulty, stickCount)
  // En desafío el marcador crece para dejarles sitio: las vidas se ven durante
  // la partida y siguen ahí al acabar, que es con las que se acabó. En Niveles
  // ese sitio lo ocupan las estrellas al terminar.
  const totalLives = startingLives(gameMode)
  const showLives = lives != null && totalLives != null
  const showStars = finished && levelResult != null
  return (
    <group position={XR_HUD_POSITION}>
      {/* Panel de fondo: en AR el mundo real está detrás, sin él las fichas
          pierden contraste sobre cualquier pared. */}
      <XRPanel
        // Al acabar, el ancho no puede depender de cuántos palos se jugaran:
        // con los pocos de una partida corta, la fila de tres botones se
        // saldría del panel y perdería el fondo que la despega del passthrough.
        width={Math.max(width + 0.2, finished ? BUTTONS_WIDTH + 0.06 : 0)}
        height={
          (finished ? XR_HUD_PANEL.finished : XR_HUD_PANEL.run) +
          (showLives || showStars ? XR_HUD_PANEL.livesRow : 0)
        }
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
        {showStars && (
          <XRStarsRow stars={levelResult.stars} position={[0, LIFE_ROW_Y, 0]} size={0.02} />
        )}
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
export function XRQuitButton({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState, gameMode, endless, askToQuit, endRun } = useGame()

  // También durante la cuenta atrás: si al jugador se le ocurre que se ha
  // equivocado de opciones, esos tres segundos son su última oportunidad.
  if ((hasDomUi && mode == null) || (gameState !== 'playing' && gameState !== 'countdown')) {
    return null
  }

  return (
    <>
      {/* Sin fin no se acaba sola: terminar es su única salida con resumen. Va
          en la punta contraria a la de volver al menú para no confundirlas. */}
      {gameMode === 'practice' && endless && gameState === 'playing' && (
        <XRPressable
          position={XR_END_RUN_POSITION}
          rotation={[0, XR_END_RUN_YAW, 0]}
          onSelect={endRun}
          hitSize={[0.16, 0.14, 0.08]}
        >
          <mesh>
            <boxGeometry args={[0.12, 0.1, 0.012]} />
            <meshStandardMaterial
              color="#15803d"
              emissive="#22c55e"
              emissiveIntensity={0.3}
              roughness={0.5}
            />
          </mesh>
          <XRCheckIcon position={[0, 0, 0.012]} />
        </XRPressable>
      )}
      {/* Pregunta antes de dejarla: el botón se pulsa sin querer y salir pierde lo hecho. */}
      <QuitButton onSelect={askToQuit} />
    </>
  )
}

function QuitButton({ onSelect }: { onSelect: () => void }) {
  return (
    // El giro cuelga del botón, no de la placa: girando solo la placa, su borde
    // izquierdo se adelantaba por delante del icono y se comía el dibujo desde
    // ese lado. Es lo que hacía ilegible al icono anterior, cuya punta de flecha
    // caía justo en la parte que quedaba enterrada.
    <XRPressable
      position={XR_QUIT_POSITION}
      rotation={[0, XR_QUIT_YAW, 0]}
      onSelect={onSelect}
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

/**
 * El aviso antes de dejar la partida.
 *
 * **No se sale de golpe.** El botón se pulsa sin querer —con el visor puesto no se ve lo
 * que hay a los lados y la mano va a por los palos— y salir pierde lo que se lleve hecho.
 * Así que se para la partida y se pregunta; mientras se pregunta no cae ningún palo, porque
 * si no, decidir costaría puntos.
 */
/**
 * Lo que se escribe en el aviso de dejar la partida.
 *
 * Aparte del componente para poder **medirlo**: un panel del visor se pinta en un lienzo que
 * nadie mira al tamaño al que se lee, así que un texto que se sale o dos que se pisan solo
 * se descubren con las gafas puestas. Lo mide `salida.legible.test.ts`, en los dos idiomas
 * —el español es más largo y es donde se sale—.
 */
export function dibujarElAviso(ctx: CanvasRenderingContext2D, t: (clave: TextKey) => string): void {
  drawParagraph(ctx, t('Leave the game?'), 0, 0.1, {
    size: CONFIRM_TEXT.title,
    color: '#e2e8f0',
    weight: '700',
    maxWidth: XR_CONFIRM_SIZE[0] - 0.08,
  })
  drawParagraph(ctx, t('You lose what you have got so far.'), 0, 0.02, {
    size: CONFIRM_TEXT.body,
    color: '#94a3b8',
    maxWidth: XR_CONFIRM_SIZE[0] - 0.08,
  })
  drawText(ctx, t('Leave'), CONFIRM_BOXES.leave.position[0], CONFIRM_BOXES.leave.position[1], {
    size: CONFIRM_TEXT.button,
    color: '#e2e8f0',
    maxWidth: CONFIRM_BOXES.leave.size[0] - 0.03,
  })
  drawText(
    ctx,
    t('Keep playing'),
    CONFIRM_BOXES.stay.position[0],
    CONFIRM_BOXES.stay.position[1],
    {
      size: CONFIRM_TEXT.button,
      color: '#3b1d00',
      weight: '700',
      maxWidth: CONFIRM_BOXES.stay.size[0] - 0.03,
    },
  )
}

export function XRQuitConfirm() {
  const { prompt, resetGame, keepPlaying } = useGame()
  const t = traductor(useLang())

  const escribir = useCallback((ctx: CanvasRenderingContext2D) => dibujarElAviso(ctx, t), [t])

  if (prompt !== 'quit') return null

  return (
    <group position={XR_CONFIRM_POSITION}>
      <XRPanel width={XR_CONFIRM_SIZE[0]} height={XR_CONFIRM_SIZE[1]} color={PANEL_COLOR} />

      <XRPressable
        position={CONFIRM_BOXES.leave.position}
        onSelect={resetGame}
        hitSize={CONFIRM_BOXES.leave.size}
      >
        <mesh>
          <planeGeometry args={[CONFIRM_BOXES.leave.size[0], CONFIRM_BOXES.leave.size[1]]} />
          <meshBasicMaterial color="#1c2634" toneMapped={false} />
        </mesh>
      </XRPressable>

      <XRPressable
        position={CONFIRM_BOXES.stay.position}
        onSelect={keepPlaying}
        hitSize={CONFIRM_BOXES.stay.size}
      >
        <mesh>
          <planeGeometry args={[CONFIRM_BOXES.stay.size[0], CONFIRM_BOXES.stay.size[1]]} />
          <meshBasicMaterial color={LIFE_COLOR} toneMapped={false} />
        </mesh>
      </XRPressable>

      {/* El texto va encima de las placas: el lienzo es transparente salvo donde escribe. */}
      <group position={[0, 0, 0.03]}>
        <CanvasPanel
          width={XR_CONFIRM_SIZE[0]}
          height={XR_CONFIRM_SIZE[1]}
          draw={escribir}
          fallbackColor={PANEL_COLOR}
        />
      </group>
    </group>
  )
}
