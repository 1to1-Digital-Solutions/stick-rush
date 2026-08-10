'use client'

import { useEffect, useRef } from 'react'
import { type GameState, useGame } from '@/lib/gameStore'
import { createSoundEngine, type SoundEngine } from '@/lib/sound'

/**
 * Pone sonido a la partida: al atrapar, al perder y en la cuenta atrás.
 *
 * Escucha el estado del juego en vez de engancharse a los componentes, así que
 * suena igual con el ratón que con los mandos del visor —que es donde más falta
 * hace, porque allí no hay marcador que mirar sin apartar la vista de los palos.
 *
 * Se monta una sola vez, en `GameScene`.
 */
export function useGameSound() {
  const { gameState, countdown, score, resolved, streak } = useGame()
  const engineRef = useRef<SoundEngine | null>(null)
  const previous = useRef({
    score: 0,
    missed: 0,
    countdown: 0,
    gameState: 'menu' as GameState,
  })

  useEffect(() => {
    // Sin Web Audio (navegador antiguo, entorno de test) se juega en silencio.
    const AudioContextClass = window.AudioContext
    if (AudioContextClass == null) return

    let context: AudioContext | null = null

    // El navegador no deja sonar hasta que el usuario ha interactuado con la
    // página, así que el contexto nace con el primer clic o tecla. También
    // cubre el visor: allí el gesto es el botón de entrar en la sesión, que
    // todavía es DOM.
    const startAudio = () => {
      if (context != null) return
      stopWaiting()
      context = new AudioContextClass()
      engineRef.current = createSoundEngine(context)
      // Que el navegador se niegue a reanudarlo es un desenlace previsto —su
      // política de reproducción automática— y significa jugar sin sonido.
      void context.resume().catch(() => {})
    }

    const stopWaiting = () => {
      window.removeEventListener('pointerdown', startAudio)
      window.removeEventListener('keydown', startAudio)
    }

    window.addEventListener('pointerdown', startAudio)
    window.addEventListener('keydown', startAudio)

    return () => {
      stopWaiting()
      engineRef.current?.dispose()
      engineRef.current = null
      if (context != null && context.state !== 'closed') void context.close()
    }
  }, [])

  const missed = resolved - score

  useEffect(() => {
    const engine = engineRef.current
    const before = previous.current
    previous.current = { score, missed, countdown, gameState }
    if (engine == null) return

    // Los contadores solo suben dentro de una partida, así que comparar con el
    // valor anterior basta para saber qué acaba de pasar. Si dos palos se
    // resuelven en el mismo lote de React suena una vez: dos copias del mismo
    // sonido a la vez no se oyen como dos, se oyen como una más fuerte.
    if (score > before.score) engine.play({ name: 'catch', streak })
    if (missed > before.missed) engine.play({ name: 'miss' })

    if (gameState === 'countdown' && countdown > 0 && countdown !== before.countdown) {
      engine.play({ name: 'countdown', secondsLeft: countdown })
    }
    // A jugar solo se entra agotando la cuenta atrás; volver al menú por el
    // camino la corta sin salida.
    if (gameState === 'playing' && before.gameState === 'countdown') {
      engine.play({ name: 'go' })
    }
  }, [score, missed, countdown, gameState, streak])
}
