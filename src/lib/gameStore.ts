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
   * Mejor puntuación conseguida, guardada entre visitas (ver `highScore.ts`).
   * Durante una partida es la marca a batir: no incorpora los puntos en curso
   * hasta que la partida termina.
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
  startGame: () => void
  /**
   * Palo atrapado. `fallProgress` (0 recién soltado, 1 a ras de suelo) decide
   * el bonus por reflejos.
   */
  catchStick: (fallProgress: number) => void
  /** Palo perdido: rompe la racha y cuenta para cerrar la partida. */
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
  const [score, setScore] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  // El récord no es estado de React: vive en el navegador y el juego se
  // suscribe a él. Así no hay que sincronizarlo con efectos ni queda una copia
  // que pueda discrepar de lo guardado.
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    getBestPoints,
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

  const gameState: GameState = !running
    ? 'menu'
    : countdown > 0
      ? 'countdown'
      : resolved >= stickCount
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
    saveBestPoints(points)
  }, [gameState, points])

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

  const clearRun = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
  }, [])

  const startGame = useCallback(() => {
    clearRun()
    setRecordToBeat(getBestPoints())
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setRunning(true)
  }, [clearRun])

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
      startGame,
      catchStick,
      missStick,
      resetGame,
    }),
    [
      stickCount,
      difficulty,
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
