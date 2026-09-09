'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  getBestEndlessStreak,
  getBestPoints,
  getServerBestEndlessStreak,
  getServerBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
  subscribeBestEndlessStreak,
  subscribeBestPoints,
} from './highScore'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from './levels'
import {
  getServerStarsList,
  getServerUnlockedLevel,
  getStarsList,
  getUnlockedLevel,
  saveLevelResult,
  subscribeStarsList,
  subscribeUnlockedLevel,
} from './progress'
import { volumeFactor } from './ajustes'
import { useVolumes } from './ajustesCliente'
import {
  HOOP_ADJUST_STEP,
  clampHoopAdjustment,
  getHoopAdjustment,
  hoopHeightFor,
  saveHoopAdjustment,
} from './hoopHeight'
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
  /** Práctica, niveles o desafío (ver `gameMode.ts`). */
  gameMode: GameMode
  /**
   * Práctica sin fin: cuando se resuelve la tanda de palos la máquina vuelve a
   * cargar otra, hasta que el jugador termina. El récord es la mejor racha.
   */
  endless: boolean
  /** Nivel elegido en Niveles, o `null` = el más alto desbloqueado. */
  level: number | null
  /** El nivel que se juega: el elegido, o el más alto desbloqueado. */
  activeLevel: number
  /** Hasta qué nivel se puede jugar, recordado entre visitas. */
  unlockedLevel: number
  /** Estrellas de cada nivel, del primero al último. */
  levelStars: readonly Stars[]
  /** Cómo acabó el nivel jugado, solo con la partida terminada en Niveles. */
  levelResult: { stars: Stars; passed: boolean; unlocked: number | null } | null
  /** Velocidad a la que se juega: la elegida, o la del nivel en Niveles. */
  activeDifficulty: Difficulty
  /** Palos que cuelgan de la máquina en esta tanda: los elegidos, o los del nivel. */
  activeStickCount: number
  /**
   * Semilla del reparto de palos. Es `runId` salvo en la partida sin fin, donde
   * cambia con cada tanda para que la máquina se recargue con palos nuevos.
   */
  stickSeed: number
  /** Tanda en curso de la partida sin fin, empezando en 0; siempre 0 si no. */
  wave: number
  /** Palos atrapados y resueltos de la TANDA en curso; en sin fin, no de la partida. */
  waveScore: number
  waveResolved: number
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
   * Juego en silencio, porque los efectos están a cero en los ajustes del
   * arcade. Ya no es una preferencia del juego: se elige una vez en xrcade y
   * vale para los doce (ver `ajustes.ts`). Aquí se deja derivado porque media
   * escena pregunta «¿estoy mudo?» y no «¿a cuánto están los efectos?».
   */
  muted: boolean
  /** Volumen de los efectos, de 0 a 1, tal y como lo quiere la Web Audio API. */
  sfxVolume: number
  /** Música de fondo encendida: el ambiente de los ajustes, por encima de cero. */
  music: boolean
  /** Volumen del ambiente, de 0 a 1. */
  ambienceVolume: number
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
  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /**
   * Elige modo. **Solo desde el menú**: con una partida en marcha, o con su
   * resumen en pantalla, no hace nada (ver el porqué en la implementación).
   */
  setGameMode: (mode: GameMode) => void
  setEndless: (endless: boolean) => void
  /** Elige nivel entre los desbloqueados; lo que no lo está se recorta. */
  setLevel: (level: number) => void
  /** Termina la partida sin fin a voluntad: es su única salida con resumen. */
  endRun: () => void
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
  const [endless, setEndless] = useState(false)
  // `null` es «el más alto desbloqueado»: así el menú enseña el nivel que toca
  // sin leer el almacenamiento en el primer render, que no está en el servidor.
  const [level, setLevelState] = useState<number | null>(null)
  // La partida sin fin la termina el jugador: es lo único que la cierra.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  // Tanda de la partida sin fin, y con qué marcador empezó: el marcador de la
  // partida sigue subiendo mientras la máquina se recarga.
  const [wave, setWave] = useState(0)
  const [waveStart, setWaveStart] = useState({ score: 0, resolved: 0 })
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
  // El progreso de Niveles y la racha sin fin tampoco son estado de React: viven
  // en el navegador y se leen suscritos, como el récord.
  const unlockedLevel = useSyncExternalStore(
    subscribeUnlockedLevel,
    getUnlockedLevel,
    getServerUnlockedLevel,
  )
  const starsList = useSyncExternalStore(subscribeStarsList, getStarsList, getServerStarsList)
  const levelStarsAll = useMemo(
    () => starsList.split(',').map((s) => Number(s) as Stars),
    [starsList],
  )
  const bestEndlessStreak = useSyncExternalStore(
    subscribeBestEndlessStreak,
    getBestEndlessStreak,
    getServerBestEndlessStreak,
  )
  // Hasta dónde se podía jugar al empezar, y con qué nivel se empezó. El nivel
  // se congela al empezar: al superarlo se desbloquea el siguiente en el acto, y
  // si el activo siguiera al desbloqueado la partida terminada se convertiría en
  // la siguiente a medias, con más palos que resolver y el resumen esfumado.
  const [unlockedAtStart, setUnlockedAtStart] = useState(1)
  const [levelAtStart, setLevelAtStart] = useState(1)
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
  // El sonido no es estado de este juego: sale de los ajustes del arcade, que
  // se eligen una vez en xrcade y valen para los doce. Aquí solo se traduce a
  // lo que la escena pregunta: si está mudo y a qué volumen (ver `ajustes.ts`).
  const volumes = useVolumes()
  const muted = volumes.sfx === 0
  const sfxVolume = volumeFactor(volumes.sfx)
  const music = volumes.ambience > 0
  const ambienceVolume = volumeFactor(volumes.ambience)
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

  const levels = gameMode === 'levels'
  const endlessRun = gameMode === 'practice' && endless
  const selectedLevel = clampLevel(Math.min(level ?? unlockedLevel, unlockedLevel))
  const activeLevel = running ? levelAtStart : selectedLevel
  const currentLevel = levelSpec(activeLevel)
  const activeDifficulty = levels ? currentLevel.difficulty : difficulty
  const activeStickCount = levels ? currentLevel.stickCount : stickCount
  // Sin fin, cada tanda reparte palos nuevos: la semilla cambia con la tanda.
  const stickSeed = endlessRun ? runId * 1000 + wave : runId
  const waveScore = score - waveStart.score
  const waveResolved = resolved - waveStart.resolved

  // Los palos que se han escapado. Se deriva en vez de contarse aparte: un
  // tercer contador que hay que mantener a la par de los otros dos es un
  // desajuste esperando a pasar.
  const misses = resolved - score
  // Cuándo se acaba una partida lo decide el modo (ver `gameMode.ts`): en
  // práctica, el último palo; en desafío, también quedarse sin vidas. Sin fin
  // no se acaba sola: la cierra el jugador.
  const outcome = running
    ? endlessRun
      ? endedByPlayer
        ? 'cleared'
        : null
      : runOutcome({ mode: gameMode, resolved, misses, stickCount: activeStickCount })
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

  // Sin fin: tanda resuelta, la máquina se recarga. Se apunta de qué tanda se
  // pasó para que dos ejecuciones del efecto —Strict Mode las provoca— no
  // salten dos.
  const advancedWave = useRef(-1)
  useEffect(() => {
    if (!running || !endlessRun || gameState !== 'playing') return
    if (waveResolved < activeStickCount) return
    // Dos ejecuciones del efecto por la misma tanda —Strict Mode las provoca en
    // desarrollo— sumarían dos veces lo hecho.
    /* v8 ignore next */
    if (advancedWave.current === wave) return
    advancedWave.current = wave
    setWaveStart({ score, resolved })
    setWave((value) => value + 1)
  }, [running, endlessRun, gameState, waveResolved, activeStickCount, wave, score, resolved])

  // Cómo acabó el nivel, solo con la partida terminada en Niveles.
  const levelResult = useMemo(() => {
    if (!levels || gameState !== 'finished') return null
    const stars = levelStars(score, activeStickCount)
    const passed = levelPassed(stars)
    const abre = passed && activeLevel + 1 > unlockedAtStart && activeLevel < LEVEL_COUNT
    return { stars, passed, unlocked: abre ? activeLevel + 1 : null }
  }, [levels, gameState, score, activeStickCount, activeLevel, unlockedAtStart])

  // Cada modo guarda lo suyo al terminar: puntos, racha o estrellas. Guardar
  // solo hace algo si mejora lo que había, así que repetirlo no cambia nada. Se
  // guarda al final y no palo a palo para que durante la partida el récord siga
  // siendo la marca a batir.
  useEffect(() => {
    if (gameState !== 'finished') return
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
  }, [gameState, gameMode, points, bestStreak, endlessRun, levelResult, activeLevel])

  // La marca de este modo: puntos, o la racha en la partida sin fin. En Niveles
  // no hay marca que batir: hay estrellas.
  const bestForMode = endlessRun ? bestEndlessStreak : levels ? 0 : bestPoints
  const scoreForRecord = endlessRun ? bestStreak : points
  // La partida ha batido el récord con el que empezó *y* lo guardado es
  // exactamente esta puntuación. Sin esa segunda condición, con el
  // almacenamiento bloqueado la marca a batir se quedaría a cero para siempre y
  // cada partida con puntos se anunciaría como récord. Y se exige la igualdad y
  // no "al menos": con dos pestañas abiertas, la otra puede haber guardado algo
  // mejor mientras se jugaba, y entonces esta partida supera la marca que
  // congeló al empezar pero no la que hay guardada. Derivado y no guardado:
  // dura lo que dure la pantalla de fin de partida.
  const isRecord =
    gameState === 'finished' &&
    !levels &&
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  const hoopHeight = hoopHeightFor({
    eyeHeight: playerEyeHeight,
    adjustment: hoopAdjustment,
  })

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

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

  const setLevel = useCallback(
    (next: number) => {
      if (running) return
      setLevelState(clampLevel(Math.min(next, getUnlockedLevel())))
    },
    [running],
  )

  const endRun = useCallback(() => setEndedByPlayer(true), [])

  const clearRun = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
    setWave(0)
    setWaveStart({ score: 0, resolved: 0 })
    setEndedByPlayer(false)
    advancedWave.current = -1
  }, [])
  const startGame = useCallback(
    (options?: { tutorial?: boolean }) => {
      // Con las gafas puestas y sin haberlo visto nunca, la partida empieza
      // enseñando: es el único momento en que el jugador está mirando y aún no
      // hay palos cayéndole encima.
      const tutorial = options?.tutorial ?? (immersive && !tutorialSeen)
      clearRun()
      setRecordToBeat(
        gameMode === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(gameMode),
      )
      setUnlockedAtStart(getUnlockedLevel())
      setLevelAtStart(selectedLevel)
      setRunId((id) => id + 1)
      setTutorialRunning(tutorial)
      // Con tutorial la cuenta espera: sus tres segundos son para colocarse, y
      // gastarlos mientras el jugador mira la demostración los desperdicia.
      setCountdown(tutorial ? 0 : COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, gameMode, endless, selectedLevel, immersive, tutorialSeen],
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
          total + stickPoints({ difficulty: activeDifficulty, streak: next, fallProgress }),
        )
        return next
      })
    },
    [activeDifficulty],
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
      endless,
      level,
      activeLevel,
      unlockedLevel,
      levelStars: levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestPoints: bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      immersive,
      setScenery,
      setStickCount,
      setDifficulty,
      setGameMode,
      setEndless,
      setLevel,
      endRun,
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
      endless,
      level,
      activeLevel,
      unlockedLevel,
      levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      immersive,
      setScenery,
      setStickCount,
      setGameMode,
      setLevel,
      endRun,
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
