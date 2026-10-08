'use client'

import { useCallback } from 'react'
import { useXR } from '@react-three/xr'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  LIFE_COLOR,
  MAX_STICKS,
  MIN_STICKS,
  STICK_COLOR,
} from '../../lib/gameConfig'
import {
  CHALLENGE_LIVES,
  GAME_MODE_HINTS,
  GAME_MODE_ORDER,
  type GameMode,
  picksSetup,
} from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { PLAYER_COUNT_HINTS, eligeJugadores, juegaADos, type PlayerCount } from '../../lib/duel'
import { useLang } from '../../lib/ajustesCliente'
import { traductor, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { LEVEL_COUNT } from '../../lib/levels'
import { useExit } from '../../game/exit'
import { HOOP_ADJUST_RANGE } from '../../lib/hoopHeight'
import {
  menuLabelsFor,
  menuLabelText,
  ROW_LABEL_RISE,
  MENU_TEXT,
  XR_DIFFICULTY_SPACING,
  XR_ENDLESS_TOGGLE_OFFSET,
  XR_MENU_HIT,
  XR_PLAYERS_TOGGLE_OFFSET,
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_GAUGE_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_LEVEL_PICKER_SPACING,
  XR_MENU_EXIT_OFFSET,
  menuPoseFor,
  XR_MENU_TUTORIAL_OFFSET,
  XR_MODE_TOGGLE_OFFSET,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_PICKER_SPACING,
  MENU_PANEL,
  PISTA_ANCHO,
  PISTA_Y,
  XR_MENU_PLAY_HIT,
  XR_MENU_PLAY_OFFSET,
  XR_DIFFICULTY_ROW_Y,
  XR_ROW_HIT_HEIGHT,
  XR_STICK_ROW_Y,
} from '../../lib/xrLayout'
import { ControllerModel } from './XRControllerModel'
import { HandModel } from './XRHandModel'
import { useBareHands } from './useBareHands'
import {
  PANEL_COLOR,
  XRArrowIcon,
  XRDifficultyBars,
  XRSalirIcon,
  XRHeartIcon,
  XRPanel,
  XRPassthroughIcon,
  XRPlayIcon,
  XRPlayersIcon,
  XRPressable,
  XRSceneIcon,
  XRStarsRow,
  XR_STAR_COLOR,
  XR_STAR_SPENT_COLOR,
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
    <group position={[0, XR_STICK_ROW_Y, 0]}>
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
            hitSize={[STICK_PICKER_SPACING, XR_ROW_HIT_HEIGHT.sticks, 0.05]}
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
 * Selector de nivel, en la fila de los palos cuando se juega a Niveles: una
 * casilla por nivel, encendida la elegida, con sus estrellas encima y apagadas
 * las que quedan por abrir. Como el de palos, se elige tocando la que se
 * quiere; las bloqueadas no responden.
 */
function LevelPicker() {
  const { activeLevel, unlockedLevel, levelStars, setLevel } = useGame()
  const width = (LEVEL_COUNT - 1) * XR_LEVEL_PICKER_SPACING

  return (
    <group position={[0, XR_STICK_ROW_Y, 0]}>
      {Array.from({ length: LEVEL_COUNT }, (_, index) => {
        const level = index + 1
        const locked = level > unlockedLevel
        const selected = level === activeLevel
        const stars = levelStars[index] ?? 0
        return (
          <XRPressable
            key={level}
            position={[index * XR_LEVEL_PICKER_SPACING - width / 2, 0, selected ? 0.02 : 0]}
            onSelect={() => setLevel(level)}
            disabled={locked}
            hitSize={[XR_LEVEL_PICKER_SPACING, XR_ROW_HIT_HEIGHT.sticks, 0.05]}
          >
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.03, selected ? 0.07 : 0.05, 0.012]} />
              <meshStandardMaterial
                color={selected ? STICK_COLOR : locked ? '#1c2634' : '#3d4654'}
                emissive={STICK_COLOR}
                emissiveIntensity={selected ? 0.55 : 0}
                roughness={0.6}
                transparent
                opacity={locked ? 0.35 : 1}
              />
            </mesh>
            {/* Las estrellas ganadas, apiladas encima de la casilla: sin sitio
                para tres en fila, se ponen en columna y se cuentan. */}
            {!locked &&
              Array.from({ length: 3 }, (_, star) => (
                <mesh key={star} position={[0, 0.03 + star * 0.016, 0.004]}>
                  <boxGeometry args={[0.014, 0.008, 0.006]} />
                  <meshBasicMaterial
                    color={star < stars ? XR_STAR_COLOR : XR_STAR_SPENT_COLOR}
                    toneMapped={false}
                  />
                </mesh>
              ))}
          </XRPressable>
        )
      })}
    </group>
  )
}

/**
 * Selector de dificultad: cinco fichas con 1 a 5 barras crecientes, del verde
 * al rojo. La elegida se adelanta y se ilumina, así que no depende del color.
 * En Niveles la dice el nivel: la ficha que toca se enseña encendida y las
 * demás no responden.
 */
function DifficultyPicker({ locked = false }: { locked?: boolean }) {
  const { activeDifficulty: difficulty, setDifficulty } = useGame()
  const width = (DIFFICULTY_ORDER.length - 1) * DIFFICULTY_SPACING

  return (
    <group position={[0, XR_DIFFICULTY_ROW_Y, 0]}>
      {DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === difficulty
        const color = DIFFICULTY_COLORS[level]
        return (
          <XRPressable
            key={level}
            position={[index * DIFFICULTY_SPACING - width / 2, 0, selected ? 0.022 : 0]}
            onSelect={() => setDifficulty(level)}
            disabled={locked}
            hitSize={[DIFFICULTY_SPACING * 0.92, XR_ROW_HIT_HEIGHT.difficulty, 0.05]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[DIFFICULTY_SPACING * 0.82, 0.13, 0.012]} />
              <meshStandardMaterial
                color={selected ? color : '#1c2634'}
                emissive={color}
                emissiveIntensity={selected ? 0.5 : 0.06}
                roughness={0.55}
                transparent
                opacity={locked && !selected ? 0.35 : 1}
              />
            </mesh>
            {/* Barras: tantas como nivel, cada una más alta que la anterior.
                Las mismas que enseña el tutorial al recordar el nivel. */}
            <XRDifficultyBars
              difficulty={level}
              lit={selected}
              position={[0, -0.04, 0]}
            />
          </XRPressable>
        )
      })}
    </group>
  )
}

/** Separación entre los corazones del interruptor de modo. */
const MODE_HEART_SPACING = 0.045
/** Semilado de esos corazones: más pequeños que un icono de botón, van tres. */
const MODE_HEART_SIZE = 0.016
/**
 * El modo, dicho con lo que cada uno pone en juego: nada en práctica —los
 * corazones apagados—, estrellas en niveles, los tres corazones encendidos en
 * desafío. Cada pulsación pasa al siguiente y del último vuelve al primero: un
 * botón que recorre tres estados, sin una letra, como todo el menú inmersivo.
 * El estado se distingue por dibujo, brillo y tamaño, nunca solo por color.
 */
function ModeToggle() {
  const { gameMode, setGameMode } = useGame()
  const challenge = gameMode === 'challenge'
  const levels = gameMode === 'levels'
  const width = (CHALLENGE_LIVES - 1) * MODE_HEART_SPACING
  const next = GAME_MODE_ORDER[(GAME_MODE_ORDER.indexOf(gameMode) + 1) % GAME_MODE_ORDER.length]

  return (
    <XRPressable
      position={XR_MODE_TOGGLE_OFFSET}
      onSelect={() => setGameMode(next)}
      hitSize={[0.2, 0.13, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.17, 0.1, 0.014]} />
        <meshStandardMaterial
          color={challenge ? '#4c1d24' : levels ? '#3b2f0b' : '#1c2634'}
          emissive={levels ? XR_STAR_COLOR : LIFE_COLOR}
          emissiveIntensity={challenge || levels ? 0.4 : 0.04}
          roughness={0.5}
        />
      </mesh>
      {levels ? (
        <XRStarsRow stars={3} position={[0, 0, 0.008]} spacing={MODE_HEART_SPACING} />
      ) : (
        Array.from({ length: CHALLENGE_LIVES }, (_, index) => (
          <XRHeartIcon
            key={index}
            position={[index * MODE_HEART_SPACING - width / 2, 0, 0.008]}
            size={challenge ? MODE_HEART_SIZE : MODE_HEART_SIZE * 0.75}
            color={challenge ? LIFE_COLOR : '#55606f'}
          />
        ))
      )}
    </XRPressable>
  )
}

/**
 * Tanda o sin fin, solo en práctica. Encendido, la máquina se recarga cada vez
 * que se vacía y la partida la termina el jugador. Se dibuja como lo que es: un
 * anillo, el camino que no se acaba; apagado, un tramo suelto.
 */
function EndlessToggle() {
  const { endless, setEndless } = useGame()

  return (
    <XRPressable
      position={XR_ENDLESS_TOGGLE_OFFSET}
      onSelect={() => setEndless(!endless)}
      hitSize={[0.16, 0.13, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.13, 0.1, 0.014]} />
        <meshStandardMaterial
          color={endless ? '#1d4ed8' : '#1c2634'}
          emissive="#60a5fa"
          emissiveIntensity={endless ? 0.45 : 0.05}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0, 0.008]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.022, 0.006, 8, 24, endless ? Math.PI * 2 : Math.PI]} />
        <meshBasicMaterial color={endless ? '#ffffff' : '#64748b'} toneMapped={false} />
      </mesh>
    </XRPressable>
  )
}
/**
 * Contra quién, solo en el desafío: una ficha sola o dos enfrentadas —el icono de los hermanos—,
 * y cada pulsación pasa a la otra, como el interruptor de sin fin en cuyo hueco va. Encendido a
 * dos, la placa se enciende además de cambiar el dibujo: nunca solo el color.
 */
function PlayersToggle() {
  const { players, setPlayers } = useGame()
  const aDos = players === 2
  const tinta = aDos ? '#ffffff' : '#94a3b8'

  return (
    <XRPressable
      position={XR_PLAYERS_TOGGLE_OFFSET}
      onSelect={() => setPlayers(aDos ? 1 : 2)}
      hitSize={XR_MENU_HIT.endless}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.13, 0.1, 0.014]} />
        <meshStandardMaterial
          color={aDos ? '#15803d' : '#1c2634'}
          emissive="#22c55e"
          emissiveIntensity={aDos ? 0.45 : 0.05}
          roughness={0.5}
        />
      </mesh>
      <XRPlayersIcon
        position={[0, 0, 0.008]}
        size={0.016}
        table={tinta}
        near={{ color: tinta }}
        far={aDos ? { color: tinta } : null}
      />
    </XRPressable>
  )
}

/**
 * Escenario o habitación real, sin salir de la sesión.
 *
 * En una sesión `immersive-ar` los dos modos son la misma sesión pintada de dos
 * formas, así que el cambio es inmediato (con su fundido, ver `SceneryFade`).
 * En una sesión `immersive-vr` no hay passthrough que enseñar —el visor no lo
 * entrega—, así que la opción se muestra apagada en vez de mentir. Escribe el
 * escenario del arcade: el panel del salón y este selector enseñan lo mismo.
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

/** Alto de la regla del aro, en metros. */
const HOOP_GAUGE_HEIGHT = 0.085
/** Semilado del recorrido de la marca dentro de esa regla. */
const HOOP_GAUGE_TRAVEL = HOOP_GAUGE_HEIGHT / 2 - 0.014

/**
 * Subir y bajar el aro a mano.
 *
 * El aro se coloca solo a partir de la altura del visor (ver `hoopHeight.ts`),
 * pero eso no siempre acierta: el visor no siempre dice a qué altura está la
 * cabeza, y quien juega sentado en un sofá con el espacio calibrado de pie sale
 * medido de más. Esto es la corrección.
 *
 * **La respuesta es la propia máquina.** El aro pasa por delante del panel, a su
 * derecha, así que al pulsar se ve subir o bajar: no hace falta ninguna cifra, que además no
 * se podría escribir (el menú inmersivo va sin una sola letra, ver arriba). La
 * regla del medio solo dice cuánto queda de recorrido, y los botones se apagan
 * al llegar al tope, así que el límite se ve antes de chocar con él.
 */
function HoopHeightPicker() {
  const { hoopAdjustment, adjustHoop } = useGame()
  const atTop = hoopAdjustment >= HOOP_ADJUST_RANGE
  const atBottom = hoopAdjustment <= -HOOP_ADJUST_RANGE

  const buttons = [
    { key: 'down', up: false, offset: XR_HOOP_DOWN_OFFSET, disabled: atBottom },
    { key: 'up', up: true, offset: XR_HOOP_UP_OFFSET, disabled: atTop },
  ]

  return (
    <group>
      {buttons.map(({ key, up, offset, disabled }) => (
        <XRPressable
          key={key}
          position={offset}
          onSelect={() => adjustHoop(up ? 1 : -1)}
          disabled={disabled}
          hitSize={[0.13, 0.1, 0.06]}
        >
          <mesh position={[0, 0, -0.008]}>
            <boxGeometry args={[0.1, 0.085, 0.012]} />
            <meshStandardMaterial
              color="#1c2634"
              emissive="#94a3b8"
              emissiveIntensity={disabled ? 0.02 : 0.24}
              roughness={0.5}
              // Apagado de verdad en el tope: el estado se distingue por
              // opacidad y por brillo, no solo por color.
              transparent
              opacity={disabled ? 0.35 : 1}
            />
          </mesh>
          <XRArrowIcon
            position={[0, 0, 0.008]}
            up={up}
            color={disabled ? '#64748b' : '#ffffff'}
          />
        </XRPressable>
      ))}

      {/* Regla: un raíl con el aro en miniatura marcando dónde está. */}
      <group position={XR_HOOP_GAUGE_OFFSET}>
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.012, HOOP_GAUGE_HEIGHT, 0.008]} />
          <meshStandardMaterial
            color="#1c2634"
            emissive="#94a3b8"
            emissiveIntensity={0.08}
            roughness={0.5}
          />
        </mesh>
        <mesh
          position={[
            0,
            (hoopAdjustment / HOOP_ADJUST_RANGE) * HOOP_GAUGE_TRAVEL,
            0,
          ]}
        >
          <boxGeometry args={[0.05, 0.009, 0.012]} />
          <meshStandardMaterial
            color={STICK_COLOR}
            emissive={STICK_COLOR}
            emissiveIntensity={0.55}
            roughness={0.55}
          />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Volver a ver la demostración de cómo se juega.
 *
 * El tutorial se interpone una sola vez, así que quien lo saltó —o quien vuelve
 * meses después— necesita una forma de recuperarlo. Lleva en miniatura lo que
 * va a enseñar —el mando con su gatillo marcado, o la mano si se entró sin
 * mandos—, porque a un metro se reconoce mejor un objeto que un símbolo
 * inventado, y porque prometer un mando a quien juega con las manos es prometer
 * otra demostración.
 */
function TutorialButton() {
  const { startGame } = useGame()
  const bareHanded = useBareHands()

  return (
    <XRPressable
      position={XR_MENU_TUTORIAL_OFFSET}
      onSelect={() => startGame({ tutorial: true })}
      hitSize={[0.14, 0.12, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.11, 0.095, 0.014]} />
        <meshStandardMaterial
          color="#1c2634"
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
      {/* Quieto y sin latido: en el menú el latido competiría con el botón de
          empezar, que es a donde va casi todo el mundo. */}
      {bareHanded ? (
        <group position={[0, 0.006, 0.02]} rotation={[0.2, -0.2, 0]} scale={0.42}>
          <HandModel side={1} highlight pulsing={false} />
        </group>
      ) : (
        <group position={[0, 0.012, 0.02]} rotation={[0.25, -0.5, 0]} scale={0.5}>
          <ControllerModel side={1} highlight pulsing={false} />
        </group>
      )}
    </XRPressable>
  )
}

/** Lo que ocupa la placa del menú, en metros (`xrLayout.ts`, que la necesita para los palos). */
export { MENU_PANEL }

/**
 * De qué es cada fila del menú.
 *
 * Va en un lienzo aparte porque el resto del panel es geometría y ahí no cabe una letra, y
 * encima de los botones y no dentro: dentro habría que elegir entre el nombre y el icono,
 * y el icono es lo que se pulsa.
 */
/**
 * Los rótulos del panel: qué es cada fila. Sale del componente para que un test
 * pueda medirlos con un lienzo de mentira —`legibilidad.ts`— sin montar la escena:
 * si un nombre se pisa con otro o se sale, se ve aquí y no con el visor puesto.
 */
export function dibujarLosNombres(
  ctx: CanvasRenderingContext2D,
  t: (clave: TextKey) => string,
  gameMode: GameMode = 'practice',
  players: PlayerCount = 1,
): void {
  for (const { text, x, y } of menuLabelsFor(gameMode)) {
    // La fila del modo dice cuál hay elegido —«Reto», «Práctica»—, no «Modo».
    drawText(ctx, t(menuLabelText(text, gameMode)), x, y + ROW_LABEL_RISE, {
      size: MENU_TEXT.label,
      color: '#94a3b8',
      maxWidth: 0.3,
    })
  }

  // Qué es el modo elegido. Los modos eran **solo nombres** en el panel —«Práctica»,
  // «Desafío»— y lo que los distingue solo lo contaba la pantalla de la web, que con las
  // gafas puestas no se ve.
  // A dos, la explicación es la de la partida a dos: el modo ya lo dice su interruptor.
  const pista = juegaADos(gameMode, players) ? PLAYER_COUNT_HINTS[2] : GAME_MODE_HINTS[gameMode]
  drawParagraph(ctx, t(pista), 0, PISTA_Y, {
    size: MENU_TEXT.hint,
    color: '#94a3b8',
    maxWidth: PISTA_ANCHO,
    anchor: 'top',
  })
}

function RowLabels() {
  const t = traductor(useLang())
  const { gameMode, players } = useGame()

  const escribir = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarLosNombres(ctx, t, gameMode, players),
    [t, gameMode, players],
  )

  return (
    <group position={[0, 0, 0.004]}>
      <CanvasPanel
        width={MENU_PANEL[0]}
        height={MENU_PANEL[1]}
        draw={escribir}
        fallbackColor={PANEL_COLOR}
      />
    </group>
  )
}

export function XRMenu({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState, gameMode, startGame } = useGame()
  const exit = useExit()
  const levels = gameMode === 'levels'
  // Fuera de sesión inmersiva manda la pantalla de inicio en DOM.
  if ((hasDomUi && mode == null) || gameState !== 'menu') {
    return null
  }

  // En el visor, la columna de la izquierda (`XR_MENU_POSE`); sin visor —el salón en
  // escritorio— delante, que ahí no se gira la cabeza para buscarla.
  const pose = menuPoseFor(mode != null)
  return (
    <group position={pose.position} rotation={[0, pose.yaw, 0]} scale={pose.scale}>
      {/* Más alto que antes: la fila del aro va arriba del todo y necesita
          panel detrás para no quedar flotando fuera de él. */}
      <XRPanel width={MENU_PANEL[0]} height={MENU_PANEL[1]} color={PANEL_COLOR} />
      <RowLabels />
      <HoopHeightPicker />
      <TutorialButton />
      {/* **Solo la práctica pregunta** palos y velocidad. En Niveles los dice el
          nivel: la fila de palos se cambia por la escalera y las fichas se quedan
          de muestra. El desafío va fijo (`CHALLENGE_SETUP`): se elige el modo y se
          le da a empezar, sin filas que no cambian nada. */}
      {levels ? <LevelPicker /> : picksSetup(gameMode) ? <StickPicker /> : null}
      {(levels || picksSetup(gameMode)) && <DifficultyPicker locked={levels} />}
      <ModeToggle />
      {gameMode === 'practice' && <EndlessToggle />}
      {eligeJugadores(gameMode) && <PlayersToggle />}
      <SceneryPicker passthroughAvailable={mode === 'immersive-ar'} />
      {/* Empezar. La primera vez la partida se abre con el tutorial —con las
          gafas puestas no hay forma de saber que los palos se agarran, ni con
          qué botón—, pero eso lo decide el juego y no este botón: dentro de la
          sesión también se puede empezar desde el overlay con el teclado. */}
      <XRPressable
        position={XR_MENU_PLAY_OFFSET}
        onSelect={() => startGame()}
        hitSize={XR_MENU_PLAY_HIT}
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

      {/* Salir. Desde el menú inmersivo no había forma de volver sin quitarse
          las gafas: el botón del sistema no siempre está a mano. A dónde se
          vuelve lo decide quien monta el juego (ver `game/exit.tsx`): en su
          propia web es cerrar la sesión; dentro del salón de xrcade, devolverle
          al jugador sin tocarla. */}
      <XRPressable
        position={XR_MENU_EXIT_OFFSET}
        onSelect={exit}
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
        <group position={[0, 0, 0.008]}>
          <XRSalirIcon />
        </group>
      </XRPressable>

    </group>
  )
}
