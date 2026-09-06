'use client'

import { useEffect, type RefObject } from 'react'
import { useGame } from '../../lib/gameStore'

/** Lo que la feria mira del juego: por ahora, la racha. */
export interface FairMoodState {
  streak: number
}

/**
 * Lleva la racha del juego a un ref que el recinto lee en cada fotograma.
 *
 * Es el único trozo del decorado que escucha al estado, y no pinta nada: si el
 * público o las bombillas leyeran `useGame()` directamente, cada cambio de la
 * partida volvería a renderizar cientos de instancias para mover un número.
 * Aquí el cambio llega a un ref y la escena lo lee donde ya está mirando el
 * reloj: en `useFrame`.
 */
export function FairMood({ moodRef }: { moodRef: RefObject<FairMoodState> }) {
  const { streak } = useGame()

  useEffect(() => {
    moodRef.current.streak = streak
  }, [moodRef, streak])

  return null
}
