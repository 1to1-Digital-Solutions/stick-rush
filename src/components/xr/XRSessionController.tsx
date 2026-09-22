'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { useBareHands } from './useBareHands'

/**
 * Puente entre el estado de la sesión WebXR y el estado del juego.
 *
 * Al entrar en VR/AR se lleva al jugador **al menú**, no a una partida: en el
 * visor manda `XRMenu`, que es donde elige palos y dificultad. Antes la sesión
 * arrancaba una partida sola y encadenaba la siguiente al acabar, de modo que
 * nunca se podía elegir nada ni volver atrás sin quitarse el visor.
 *
 * Debe montarse dentro de <XR> para poder leer el estado de la sesión.
 */
export function XRSessionController() {
  const mode = useXR((state) => state.mode)
  const bareHanded = useBareHands()
  const { gameState, resetGame, setImmersive, setBareHanded } = useGame()

  // Con qué se juega solo se sabe dentro de la sesión, y hace falta fuera: el
  // reflejo del tutorial en el overlay es DOM y no alcanza este estado. Va en su
  // propio efecto porque cambia por su cuenta —los mandos se dejan en la mesa a
  // media partida— y no al entrar o salir de la sesión.
  useEffect(() => {
    setBareHanded(bareHanded)
  }, [bareHanded, setBareHanded])

  // Recordar que hubo sesión es imprescindible: en escritorio `mode` es null
  // siempre, y sin esta guarda cualquier partida iniciada con el ratón se
  // cancelaría sola nada más empezar.
  const immersive = useRef(false)

  useEffect(() => {
    // El juego necesita saber si hay gafas puestas para decidir a quién le
    // enseña cómo se juega (ver `startGame`). Se apunta antes que nada: aunque
    // la sesión no cambie de estado, el dato tiene que estar al día.
    setImmersive(mode != null)

    // Entrada: si se llega con una partida de escritorio a medias, se descarta.
    // En el visor el punto de partida es siempre el menú.
    if (mode != null) {
      if (immersive.current) return
      immersive.current = true
      if (gameState !== 'menu') resetGame()
      return
    }

    // Salida: se vuelve al menú de escritorio.
    if (!immersive.current) return
    immersive.current = false
    resetGame()
  }, [mode, gameState, resetGame, setImmersive])

  return null
}
