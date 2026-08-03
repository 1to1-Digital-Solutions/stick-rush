'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { XR_RESTART_DELAY_MS } from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'

/**
 * Puente entre el estado de la sesión WebXR y el estado del juego.
 *
 * En modo inmersivo no hay DOM (ni menú ni botón "Jugar"), así que el jugador
 * no podría arrancar ni reiniciar partidas. Para que el juego sea jugable solo
 * con el visor, al entrar en una sesión XR se inicia una partida y, al
 * terminarla, se encadena la siguiente tras una pausa (el HUD 3D muestra el
 * resultado mientras tanto). Al salir de la sesión se vuelve al menú.
 *
 * Debe montarse dentro de <XR> para poder leer el estado de la sesión.
 */
export function XRSessionController() {
  const mode = useXR((state) => state.mode)
  const { gameState, startGame, resetGame } = useGame()

  // Dentro de la sesión no puede quedarse en menú ni en pantalla de fin: si no
  // hay partida en curso, arranca una. Tras un final espera para que dé tiempo
  // a leer el marcador; si el jugador sale antes, el cleanup cancela el timer.
  useEffect(() => {
    if (mode == null || gameState === 'playing') return

    if (gameState === 'menu') {
      startGame()
      return
    }

    const timer = setTimeout(startGame, XR_RESTART_DELAY_MS)
    return () => clearTimeout(timer)
  }, [mode, gameState, startGame])

  // Al SALIR de una sesión se vuelve al menú. Hace falta recordar que hubo
  // sesión: en escritorio `mode` es null siempre, y sin esta guarda cualquier
  // partida iniciada con el ratón se cancelaría sola al empezar.
  const wasImmersive = useRef(false)
  useEffect(() => {
    if (mode != null) {
      wasImmersive.current = true
      return
    }
    if (!wasImmersive.current) return
    wasImmersive.current = false
    resetGame()
  }, [mode, resetGame])

  return null
}
