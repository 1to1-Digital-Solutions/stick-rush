'use client'

import { useCallback, useState } from 'react'
import { useGame } from './gameStore'
import {
  type ShareOutcome,
  buildShareText,
  shareOrCopy,
} from './shareResult'

/**
 * Compartir el resultado desde donde se esté jugando.
 *
 * Lo usan la pantalla de fin de partida de escritorio y la del visor: las dos
 * cuentan la misma partida, así que el texto y la decisión de compartir o
 * copiar tienen que ser los mismos. Lo que cambia es cómo se pinta el aviso, y
 * eso se queda en cada una.
 */

/** Qué contar al jugador tras pulsar. `idle` es no haberlo intentado aún. */
export type ShareStatus = 'idle' | ShareOutcome

/** Enlace que se comparte: el juego donde esté servido, sin parámetros. */
function gameUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

export function useShareResult(): {
  status: ShareStatus
  share: () => Promise<void>
} {
  const {
    points,
    score,
    stickCount,
    difficulty,
    gameMode,
    lives,
    bestPoints,
    isRecord,
    runId,
  } = useGame()
  // El resultado se guarda con la partida a la que pertenece, y no suelto: si
  // no, el "copiado" de una partida seguiría en pantalla al terminar la
  // siguiente, anunciando algo que nadie ha hecho.
  const [attempt, setAttempt] = useState<{
    runId: number
    outcome: ShareOutcome
  } | null>(null)

  const share = useCallback(async () => {
    const text = buildShareText({
      points,
      score,
      stickCount,
      difficulty,
      gameMode,
      lives,
      bestPoints,
      isRecord,
      url: gameUrl(),
    })
    const outcome = await shareOrCopy(
      text,
      typeof navigator === 'undefined' ? null : navigator,
    )
    setAttempt({ runId, outcome })
  }, [
    points,
    score,
    stickCount,
    difficulty,
    gameMode,
    lives,
    bestPoints,
    isRecord,
    runId,
  ])

  return {
    status: attempt?.runId === runId ? attempt.outcome : 'idle',
    share,
  }
}
