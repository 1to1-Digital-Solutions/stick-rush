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
import { stickPoints } from './scoring'

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

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
   * Juego en silencio. No se guarda entre visitas: lo único que el juego
   * escribe en el navegador es el récord, y no se quiso ampliar eso a las
   * preferencias, así que cada visita arranca con sonido.
   */
  muted: boolean

  setScenery: (scenery: SceneryMode) => void
  setMuted: (muted: boolean) => void
  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /**
   * Elige modo. **Solo desde el menú**: con una partida en marcha, o con su
   * resumen en pantalla, no hace nada (ver el porqué en la implementación).
   */
  setGameMode: (mode: GameMode) => void
  startGame: () => void
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
  // Se entra con el escenario puesto: es la experiencia completa, y quien
  // prefiera ver su cuarto lo quita desde el menú inmersivo.
  const [scenery, setScenery] = useState<SceneryMode>('scene')
  // Se entra con sonido: es parte de cómo se juega —en el visor es lo único
  // que avisa de un fallo sin mirar el marcador— y quien lo prefiera mudo lo
  // apaga desde el menú, de escritorio o inmersivo.
  const [muted, setMuted] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [runId, setRunId] = useState(0)

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

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

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

  const startGame = useCallback(() => {
    clearRun()
    setRecordToBeat(getBestPoints(gameMode))
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setRunning(true)
  }, [clearRun, gameMode])

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
      setScenery,
      setMuted,
      setStickCount,
      setDifficulty,
      setGameMode,
      startGame,
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
      setScenery,
      setMuted,
      setStickCount,
      setGameMode,
      startGame,
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
