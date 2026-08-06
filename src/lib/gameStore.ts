'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type Difficulty,
  MAX_STICKS,
  MIN_STICKS,
} from './gameConfig'
import { stickPoints } from './scoring'

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

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
  // Lo único que se guarda es si hay partida en marcha. Las tres fases de una
  // partida —contando, jugando y terminada— se derivan de la cuenta atrás y de
  // los palos resueltos, así no hay fuentes de verdad que sincronizar ni
  // efectos que cambien de fase provocando renders en cascada.
  const [running, setRunning] = useState(false)
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
      gameState,
      countdown,
      runId,
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
      gameState,
      countdown,
      runId,
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
