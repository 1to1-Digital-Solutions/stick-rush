'use client'

import { useEffect, useRef } from 'react'
import { useGame } from '../../lib/gameStore'
import { MUSIC_VOLUME, musicUrl } from '../../lib/music'

/**
 * La música de fondo, sonando en bucle mientras el mundo esté montado.
 *
 * Cuelga del mundo y no de la envoltura de DOM, como el sonido
 * (`useGameSound.ts`): el salón de xrcade monta el mundo y nada más, y una
 * música enganchada más arriba dejaría el juego mudo justo donde se juega con
 * el visor.
 *
 * **No empieza sola.** Ningún navegador deja sonar nada antes de que quien
 * juega toque algo. Así que se prueba al montar —por si se viene de otra
 * pantalla y ya hubo un gesto— y, si no cuela, se espera al primero que llegue.
 *
 * El silencio manda: callar el juego para la música también, y la música solo
 * se apaga a sí misma.
 */
export function useGameMusic(): void {
  const { muted, music } = useGame()
  const player = useRef<HTMLAudioElement | null>(null)

  const wanted = music && !muted

  useEffect(() => {
    // El elemento se crea al pedir música por primera vez, no al montar: quien
    // entra con la música apagada no descarga medio megabyte para nada.
    if (!wanted) {
      player.current?.pause()
      return
    }

    const audio = player.current ?? new Audio(musicUrl())
    player.current = audio
    audio.loop = true
    audio.volume = MUSIC_VOLUME

    /** Intenta sonar. El navegador puede decir que no, y no es un error. */
    const start = () => {
      void audio.play().catch(() => {})
    }
    start()

    // Y si dijo que no, al primer gesto que haya. Se escucha en la ventana
    // porque el gesto puede caer en el Canvas, en un botón del menú o en el
    // mando del visor, y aquí no se sabe cuál llega antes.
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    for (const event of events) window.addEventListener(event, start, { once: true })

    return () => {
      for (const event of events) window.removeEventListener(event, start)
    }
  }, [wanted])

  // Quitar el mundo se lleva la música: dentro del salón se monta y se desmonta
  // a cada visita, y si no, seguiría sonando sobre el juego siguiente.
  useEffect(
    () => () => {
      player.current?.pause()
      player.current = null
    },
    [],
  )
}
