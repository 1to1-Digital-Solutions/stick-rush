'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import {
  type Difficulty,
  MAX_STICKS,
  MIN_STICKS,
} from './gameConfig'

export type GameState = 'menu' | 'playing' | 'finished'

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
  /** Fase del juego. */
  gameState: GameState
  /**
   * Identificador de partida. Se incrementa al iniciar una nueva para
   * forzar el remontaje de los sticks y reiniciar sus animaciones.
   */
  runId: number

  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  startGame: () => void
  catchStick: () => void
  /** Marca un palo como resuelto (atrapado o perdido); cierra la partida. */
  resolveStick: () => void
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
  // Solo se guardan las fases que decide el jugador; "finished" se deriva de
  // los palos resueltos, así no hay dos fuentes de verdad que sincronizar.
  const [phase, setPhase] = useState<'menu' | 'playing'>('menu')
  const [runId, setRunId] = useState(0)

  const gameState: GameState =
    phase === 'playing' && resolved >= stickCount ? 'finished' : phase

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

  const startGame = useCallback(() => {
    setScore(0)
    setResolved(0)
    setRunId((id) => id + 1)
    setPhase('playing')
  }, [])

  const catchStick = useCallback(() => {
    setScore((value) => value + 1)
  }, [])

  const resolveStick = useCallback(() => {
    setResolved((value) => value + 1)
  }, [])

  const resetGame = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPhase('menu')
  }, [])

  return useMemo(
    () => ({
      stickCount,
      difficulty,
      score,
      resolved,
      gameState,
      runId,
      setStickCount,
      setDifficulty,
      startGame,
      catchStick,
      resolveStick,
      resetGame,
    }),
    [
      stickCount,
      difficulty,
      score,
      resolved,
      gameState,
      runId,
      setStickCount,
      startGame,
      catchStick,
      resolveStick,
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
