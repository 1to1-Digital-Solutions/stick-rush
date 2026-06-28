'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
  const [gameState, setGameState] = useState<GameState>('menu')
  const [runId, setRunId] = useState(0)

  // Cuenta de palos ya resueltos en la partida (atrapados + perdidos);
  // cuando llega a stickCount, la partida termina. Es un ref porque solo
  // se mutó y compara, no participa en el render.
  const resolvedCount = useRef(0)

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

  const startGame = useCallback(() => {
    setScore(0)
    resolvedCount.current = 0
    setRunId((id) => id + 1)
    setGameState('playing')
  }, [])

  const catchStick = useCallback(() => {
    setScore((value) => value + 1)
  }, [])

  const resolveStick = useCallback(() => {
    resolvedCount.current += 1
    if (resolvedCount.current >= stickCount) {
      setGameState('finished')
    }
  }, [stickCount])

  const resetGame = useCallback(() => {
    setScore(0)
    resolvedCount.current = 0
    setGameState('menu')
  }, [])

  return useMemo(
    () => ({
      stickCount,
      difficulty,
      score,
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
