'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  type Difficulty,
  MAX_STICKS,
  MIN_STICKS,
} from './gameConfig'
import {
  type GameMode,
  type RunOutcome,
  remainingLives,
  runOutcome,
} from './gameMode'
import {
  getBestPoints,
  getServerBestPoints,
  saveBestPoints,
  subscribeBestPoints,
} from './highScore'
import {
  HOOP_ADJUST_STEP,
  clampHoopAdjustment,
  getHoopAdjustment,
  hoopHeightFor,
  saveHoopAdjustment,
} from './hoopHeight'
import {
  getMuted,
  getServerMuted,
  saveMuted,
  subscribeMuted,
} from './mutePreference'
import {
  getScenery,
  getServerScenery,
  saveScenery,
  subscribeScenery,
} from './sceneryPreference'
import { stickPoints } from './scoring'
import {
  TUTORIAL_SECONDS,
  getTutorialSeen,
  saveTutorialSeen,
} from './tutorial'

export type GameState =
  | 'menu'
  /**
   * Demostración de cómo se juega, antes de la cuenta atrás. Solo en el visor y
   * solo la primera vez (ver `tutorial.ts`).
   */
  | 'tutorial'
  | 'countdown'
  | 'playing'
  | 'finished'

/**
 * Qué se ve alrededor de la máquina en una sesión inmersiva.
 *
 * - `scene`: el escenario del juego (la plaza de noche). Es el «modo VR».
 * - `passthrough`: la habitación real del jugador. Es el «modo AR».
 *
 * No son dos tipos de sesión de WebXR sino dos formas de pintar la misma:
 * cambiar de `immersive-vr` a `immersive-ar` obligaría a cerrar la sesión y
 * abrir otra, con su parpadeo y su permiso. Entrando siempre en `immersive-ar`
 * —cuando el visor la soporta— basta con dibujar el decorado o no para pasar de
 * uno a otro al instante.
 */
export type SceneryMode = 'scene' | 'passthrough'

/** Segundos de cuenta atrás entre pulsar "Jugar" y el primer palo. */
export const COUNTDOWN_SECONDS = 3

export interface GameStore {
  /** Número de palos elegido (5–13). */
  stickCount: number
  /** Dificultad seleccionada. */
  difficulty: Difficulty
  /** Práctica o desafío (ver `gameMode.ts`). */
  gameMode: GameMode
  /**
   * Vidas que quedan en la partida, o `null` en un modo que no se juega con
   * ellas. En el menú son las de salida: es lo que se pone en juego al empezar.
   */
  lives: number | null
  /**
   * Cómo ha acabado la partida, o `null` mientras sigue viva. Es lo que
   * distingue superar el reto de quedarse sin vidas en la pantalla de fin.
   */
  outcome: RunOutcome | null
  /** Palos atrapados en la partida actual. */
  score: number
  /**
   * Palos ya resueltos (atrapados + perdidos) en la partida actual. Es estado
   * y no un contador interno porque el HUD 3D de XR lo pinta palo a palo.
   */
  resolved: number
  /** Puntos acumulados (ver `scoring.ts`). */
  points: number
  /** Palos seguidos atrapados sin fallar ninguno. */
  streak: number
  /** La mejor racha de la partida, para el resumen final. */
  bestStreak: number
  /**
   * Mejor puntuación conseguida **en el modo elegido**, guardada entre visitas
   * (ver `highScore.ts`). Durante una partida es la marca a batir: no incorpora
   * los puntos en curso hasta que la partida termina.
   */
  bestPoints: number
  /**
   * La partida recién terminada ha superado el récord anterior. Se apaga al
   * empezar la siguiente o al volver al menú.
   */
  isRecord: boolean
  /** Fase del juego. */
  gameState: GameState
  /**
   * Segundos que faltan para que se suelte el primer palo. Solo tiene sentido
   * en `countdown`; fuera de esa fase vale 0.
   */
  countdown: number
  /**
   * Identificador de partida. Se incrementa al iniciar una nueva para
   * forzar el remontaje de los sticks y reiniciar sus animaciones.
   */
  runId: number
  /** Escenario o passthrough en sesión inmersiva. */
  scenery: SceneryMode
  /**
   * Juego en silencio. Se guarda entre visitas (ver `mutePreference.ts`): con
   * el visor puesto, volver a apagar el sonido cada vez que uno se pone las
   * gafas es el gesto más incómodo del juego.
   */
  muted: boolean
  /**
   * Altura del aro, en metros, ya acomodada a quien juega: sale de la altura
   * del visor más la corrección manual (ver `hoopHeight.ts`).
   */
  hoopHeight: number
  /** Corrección manual sobre esa altura, en metros. Se guarda entre visitas. */
  hoopAdjustment: number
  /**
   * Altura de ojos que ha medido el visor, o `null` cuando no hay sesión, aún
   * no ha dado tiempo a medir o su espacio de referencia no permite saberla. La
   * usa el aro y también la interfaz inmersiva, que cuelga de los ojos del
   * jugador y no del suelo (ver `xrUiRise` en `xrLayout.ts`).
   */
  playerEyeHeight: number | null
  /**
   * Si el tutorial del visor ya se vio en este navegador. Se guarda entre
   * visitas: es lo que hace que se interponga una sola vez.
   */
  tutorialSeen: boolean
  /** Si hay una sesión inmersiva abierta, es decir, si se juega con gafas. */
  immersive: boolean

  setScenery: (scenery: SceneryMode) => void
  setMuted: (muted: boolean) => void
  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /**
   * Elige modo. **Solo desde el menú**: con una partida en marcha, o con su
   * resumen en pantalla, no hace nada (ver el porqué en la implementación).
   */
  setGameMode: (mode: GameMode) => void
  /**
   * Sube (pasos positivos) o baja (negativos) el aro. Cada paso son
   * `HOOP_ADJUST_STEP` metros y el recorrido está acotado, así que el aro no
   * puede acabar fuera del alcance ni dentro del suelo.
   */
  adjustHoop: (steps: number) => void
  /**
   * Altura de ojos que mide el visor, o `null` cuando no hay sesión o su
   * espacio de referencia no permite saberla.
   */
  setPlayerEyeHeight: (height: number | null) => void
  /** Apunta si se está jugando dentro del visor. Lo lleva al día la sesión. */
  setImmersive: (immersive: boolean) => void
  /**
   * Empieza una partida.
   *
   * Por su cuenta antepone la demostración de cómo se juega cuando toca: con
   * las gafas puestas y sin haberla visto nunca. Es del juego y no del botón
   * que se pulse, porque dentro de la sesión también se puede empezar desde el
   * overlay con el teclado. `tutorial` fuerza la decisión en los dos sentidos:
   * lo usa el botón de volver a verlo desde el menú.
   */
  startGame: (options?: { tutorial?: boolean }) => void
  /**
   * Cierra el tutorial y pasa a la cuenta atrás. Lo llaman el botón de saltar y
   * el propio final de la demostración: las dos cosas cuentan como visto, así
   * que a partir de ahí no vuelve a interponerse.
   */
  finishTutorial: () => void
  /**
   * Palo atrapado. `fallProgress` (0 recién soltado, 1 a ras de suelo) decide
   * el bonus por reflejos.
   */
  catchStick: (fallProgress: number) => void
  /**
   * Palo perdido: rompe la racha, cuenta para cerrar la partida y, en desafío,
   * cuesta una vida.
   */
  missStick: () => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Restringe el número de palos al rango permitido. */
function clampStickCount(count: number): number {
  if (Number.isNaN(count)) return MIN_STICKS
  return Math.min(MAX_STICKS, Math.max(MIN_STICKS, Math.round(count)))
}

export function useGameStoreValue(): GameStore {
  const [stickCount, setStickCountState] = useState(MIN_STICKS)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // Se entra en práctica: es el juego de siempre y quien acaba de llegar no
  // tiene por qué estrenarse con vidas que aún no sabe cómo se pierden. El
  // desafío está a un toque, en el mismo sitio.
  const [gameMode, setGameModeState] = useState<GameMode>('practice')
  const [score, setScore] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  // El récord no es estado de React: vive en el navegador y el juego se
  // suscribe a él. Así no hay que sincronizarlo con efectos ni queda una copia
  // que pueda discrepar de lo guardado. Cada modo tiene el suyo, así que la
  // lectura cambia con el modo elegido.
  const readRecord = useCallback(() => getBestPoints(gameMode), [gameMode])
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    readRecord,
    getServerBestPoints,
  )
  // La marca a batir se congela al empezar: en cuanto la partida termina y se
  // guarda, `bestPoints` ya incluye lo recién hecho y no serviría para saber si
  // se ha superado nada.
  const [recordToBeat, setRecordToBeat] = useState(0)
  // Lo único que se guarda es si hay partida en marcha. Las tres fases de una
  // partida —contando, jugando y terminada— se derivan de la cuenta atrás y de
  // los palos resueltos, así no hay fuentes de verdad que sincronizar ni
  // efectos que cambien de fase provocando renders en cascada.
  const [running, setRunning] = useState(false)
  // El escenario tampoco es estado de React: vive en el navegador, como el
  // silencio. Se entra con él puesto —es la experiencia completa— salvo que la
  // visita anterior lo quitara. Que la preferencia diga passthrough no basta
  // para servirlo: en una sesión sin habitación real detrás, quien pinta la
  // escena lo ignora y mantiene el escenario.
  const scenery = useSyncExternalStore(
    subscribeScenery,
    getScenery,
    getServerScenery,
  )
  const setScenery = useCallback((value: SceneryMode) => saveScenery(value), [])
  // El silencio no es estado de React: vive en el navegador y el juego se
  // suscribe a él, como el récord. Se entra con sonido salvo que la visita
  // anterior lo dejara quitado, y el botón que lo cambia está en los dos menús,
  // el de escritorio y el inmersivo.
  const muted = useSyncExternalStore(subscribeMuted, getMuted, getServerMuted)
  const [countdown, setCountdown] = useState(0)
  const [runId, setRunId] = useState(0)
  // La corrección de la altura del aro sale de lo guardado en visitas
  // anteriores. En el servidor no hay almacenamiento y vale 0, pero eso no
  // desajusta la hidratación: el aro solo se pinta dentro del Canvas, que se
  // carga en cliente.
  const [hoopAdjustment, setHoopAdjustmentState] = useState(getHoopAdjustment)
  // Lo que mide el visor, mientras dure la sesión. Fuera de ella no hay a quién
  // medir y el aro se queda a la altura de referencia.
  const [playerEyeHeight, setPlayerEyeHeight] = useState<number | null>(null)
  // El tutorial se ve una vez y se recuerda, como la altura del aro. Se lee al
  // montar y no en cada consulta porque decide qué se pinta: leer el
  // almacenamiento en mitad de un render lo volvería impredecible.
  const [tutorialSeen, setTutorialSeen] = useState(getTutorialSeen)
  // Si la partida en curso arrancó enseñando cómo se juega. Es una fase de la
  // partida y no una pantalla aparte: al acabar encadena con la cuenta atrás.
  const [tutorialRunning, setTutorialRunning] = useState(false)
  // Si hay gafas puestas. El juego lo necesita para saber a quién enseñar cómo
  // se juega: en escritorio la pantalla de inicio ya lo explica con texto.
  const [immersive, setImmersive] = useState(false)

  // Los palos que se han escapado. Se deriva en vez de contarse aparte: un
  // tercer contador que hay que mantener a la par de los otros dos es un
  // desajuste esperando a pasar.
  const misses = resolved - score
  // Cuándo se acaba una partida lo decide el modo (ver `gameMode.ts`): en
  // práctica, el último palo; en desafío, también quedarse sin vidas.
  const outcome = running
    ? runOutcome({ mode: gameMode, resolved, misses, stickCount })
    : null
  const lives = remainingLives(gameMode, misses)

  const gameState: GameState = !running
    ? 'menu'
    : tutorialRunning
      ? 'tutorial'
      : countdown > 0
        ? 'countdown'
        : outcome
          ? 'finished'
          : 'playing'

  // Un tic por segundo hasta soltar el primer palo. La cuenta atrás da tiempo a
  // colocarse —en el visor uno acaba de pulsar un botón y tiene las manos donde
  // no toca— y avisa de que la partida va a empezar de verdad.
  useEffect(() => {
    if (!running || countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown])

  // Saltar y agotar el tiempo son la misma salida: en los dos casos el jugador
  // ya ha decidido y el tutorial no vuelve a interponerse. Se anota como visto
  // antes de dar paso a la cuenta atrás.
  const finishTutorial = useCallback(() => {
    if (!tutorialRunning) return
    saveTutorialSeen()
    setTutorialSeen(true)
    setTutorialRunning(false)
    setCountdown(COUNTDOWN_SECONDS)
  }, [tutorialRunning])

  // La demostración dura lo que dure el guion (ver `tutorial.ts`) y cierra
  // sola. La escena lleva su propio reloj para animar, pero quien decide cuándo
  // se acaba es el store: así el jugador entra en la cuenta atrás aunque el
  // Canvas esté pintando a trompicones.
  useEffect(() => {
    if (!tutorialRunning) return
    const timer = setTimeout(finishTutorial, TUTORIAL_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [tutorialRunning, finishTutorial])

  // Al terminar, la puntuación sale hacia el almacenamiento; guardar solo hace
  // algo si mejora lo que había, así que repetirlo no cambia nada. Se guarda al
  // final y no palo a palo para que durante la partida el récord siga siendo la
  // marca a batir.
  useEffect(() => {
    if (gameState !== 'finished') return
    saveBestPoints(gameMode, points)
  }, [gameState, gameMode, points])

  // La partida ha batido el récord con el que empezó *y* lo guardado es
  // exactamente esta puntuación. Sin esa segunda condición, con el
  // almacenamiento bloqueado la marca a batir se quedaría a cero para siempre y
  // cada partida con puntos se anunciaría como récord. Y se exige la igualdad y
  // no "al menos": con dos pestañas abiertas, la otra puede haber guardado algo
  // mejor mientras se jugaba, y entonces esta partida supera la marca que
  // congeló al empezar pero no la que hay guardada. Derivado y no guardado:
  // dura lo que dure la pantalla de fin de partida.
  const isRecord =
    gameState === 'finished' && points > recordToBeat && bestPoints === points

  const hoopHeight = hoopHeightFor({
    eyeHeight: playerEyeHeight,
    adjustment: hoopAdjustment,
  })

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

  // Escribir es todo lo que hace falta: el almacén avisa a quien lo mire y de
  // ahí vuelve `muted`. Guardar además una copia en React sería tener dos
  // versiones de lo mismo que pueden discrepar.
  const setMuted = useCallback((value: boolean) => saveMuted(value), [])

  // Se guarda al tocarlo y no al salir: en el visor no hay "salir", uno se
  // quita las gafas. Y solo cuando el valor cambia de verdad, para no escribir
  // en cada pulsación una vez alcanzado el tope.
  const adjustHoop = useCallback(
    (steps: number) => {
      const next = clampHoopAdjustment(hoopAdjustment + steps * HOOP_ADJUST_STEP)
      if (next === hoopAdjustment) return
      saveHoopAdjustment(next)
      setHoopAdjustmentState(next)
    },
    [hoopAdjustment],
  )

  /**
   * El modo es de la partida entera, así que solo se cambia entre partidas.
   *
   * No es una precaución teórica: los puntos conseguidos y el modo en el que se
   * consiguieron son un par, y el récord se guarda leyendo los dos. Con el
   * resumen en pantalla —donde la puntuación sigue viva— cambiar de modo
   * copiaría esa puntuación al récord del otro, que no se ha jugado. Hoy ningún
   * menú se ve en esa fase, pero la regla es del juego y no de dónde esté el
   * botón.
   */
  const setGameMode = useCallback(
    (mode: GameMode) => {
      if (running) return
      setGameModeState(mode)
    },
    [running],
  )

  const clearRun = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
  }, [])

  const startGame = useCallback(
    (options?: { tutorial?: boolean }) => {
      // Con las gafas puestas y sin haberlo visto nunca, la partida empieza
      // enseñando: es el único momento en que el jugador está mirando y aún no
      // hay palos cayéndole encima.
      const tutorial = options?.tutorial ?? (immersive && !tutorialSeen)
      clearRun()
      setRecordToBeat(getBestPoints(gameMode))
      setRunId((id) => id + 1)
      setTutorialRunning(tutorial)
      // Con tutorial la cuenta espera: sus tres segundos son para colocarse, y
      // gastarlos mientras el jugador mira la demostración los desperdicia.
      setCountdown(tutorial ? 0 : COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, gameMode, immersive, tutorialSeen],
  )

  const catchStick = useCallback(
    (fallProgress: number) => {
      setScore((value) => value + 1)
      setResolved((value) => value + 1)
      // La racha se calcula aquí y no fuera porque los puntos dependen de ella:
      // con dos palos resolviéndose en el mismo lote, leer `streak` del render
      // anterior daría el mismo bonus a los dos.
      setStreak((previous) => {
        const next = previous + 1
        setBestStreak((best) => Math.max(best, next))
        setPoints((total) =>
          total + stickPoints({ difficulty, streak: next, fallProgress }),
        )
        return next
      })
    },
    [difficulty],
  )

  const missStick = useCallback(() => {
    setResolved((value) => value + 1)
    setStreak(0)
  }, [])

  const resetGame = useCallback(() => {
    clearRun()
    setCountdown(0)
    // Dejar la demostración a medias no cuenta como haberla visto: quien vuelve
    // al menú desde ella se la encuentra otra vez al empezar.
    setTutorialRunning(false)
    setRunning(false)
  }, [clearRun])

  return useMemo(
    () => ({
      stickCount,
      difficulty,
      gameMode,
      lives,
      outcome,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestPoints,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      immersive,
      setScenery,
      setMuted,
      setStickCount,
      setDifficulty,
      setGameMode,
      adjustHoop,
      setPlayerEyeHeight,
      setImmersive,
      startGame,
      finishTutorial,
      catchStick,
      missStick,
      resetGame,
    }),
    [
      stickCount,
      difficulty,
      gameMode,
      lives,
      outcome,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestPoints,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      immersive,
      setScenery,
      setMuted,
      setStickCount,
      setGameMode,
      adjustHoop,
      startGame,
      finishTutorial,
      catchStick,
      missStick,
      resetGame,
    ],
  )
}

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) {
    throw new Error('useGame debe usarse dentro de <GameProvider>')
  }
  return store
}
