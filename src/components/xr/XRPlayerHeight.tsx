'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Vector3 } from 'three'
import { useGame } from '@/lib/gameStore'
import { hasFloorReference, headsetEyeHeight } from '@/lib/hoopHeight'
import { followRatio } from '@/lib/xrAnchor'

/**
 * Mide a qué altura tiene la cabeza quien lleva el visor, para que el aro se
 * ponga a su alcance (ver `@/lib/hoopHeight`).
 *
 * **Solo mientras se elige la partida.** Con los palos cayendo, un aro que
 * persiguiera la cabeza subiría al ponerse de puntillas y bajaría al agacharse
 * a por un palo, justo cuando el jugador está calculando dónde va a estar. La
 * altura se toma en el menú y se queda quieta hasta el siguiente.
 *
 * **Suavizado y con umbral.** La cabeza no para de moverse; sin filtro, el aro
 * temblaría con la respiración, y sin umbral cada milímetro repintaría la
 * máquina entera. Se sigue la medida despacio y solo se avisa al juego cuando
 * el cambio se nota.
 *
 * Debe montarse dentro de <XR> para poder leer el estado de la sesión.
 */
export function XRPlayerHeight() {
  const mode = useXR((state) => state.mode)
  // Solo un espacio de referencia con suelo permite saber la estatura: en uno
  // `local` la cabeza nace en el cero y su cota no mide desde el suelo. Se mira
  // la sesión y no `useXRSessionFeatureEnabled`, que da por no habilitado lo
  // que el navegador simplemente no publica (ver `hasFloorReference`).
  const floorLevel = useXR((state) =>
    hasFloorReference(state.session?.enabledFeatures),
  )
  const { gameState, setPlayerEyeHeight } = useGame()

  const smoothed = useRef<number | null>(null)
  const reported = useRef<number | null>(null)

  // Fuera de la sesión no hay a quién medir: el aro vuelve a su altura de
  // referencia y la próxima sesión empieza a medir de cero.
  useEffect(() => {
    if (mode != null) return
    smoothed.current = null
    reported.current = null
    setPlayerEyeHeight(null)
  }, [mode, setPlayerEyeHeight])

  useFrame((state, delta) => {
    if (mode == null || gameState !== 'menu') return

    state.camera.getWorldPosition(headPosition)
    const measured = headsetEyeHeight(headPosition.y, floorLevel)
    if (measured == null) return

    // La primera medida entra entera —el aro tiene que estar colocado antes de
    // que el jugador mire—; a partir de ahí se persigue despacio, con la misma
    // interpolación independiente del framerate que usa el anclaje.
    smoothed.current =
      smoothed.current == null
        ? measured
        : smoothed.current +
          (measured - smoothed.current) * followRatio(delta, SMOOTHING_SPEED)

    if (
      reported.current != null &&
      Math.abs(smoothed.current - reported.current) < REPORT_THRESHOLD
    ) {
      return
    }
    reported.current = smoothed.current
    setPlayerEyeHeight(smoothed.current)
  })

  return null
}

/** Cuánto tiene que cambiar la medida para mover el aro, en metros. */
const REPORT_THRESHOLD = 0.02

/**
 * Cuánto tarda la medida en seguir a la cabeza, como constante de tiempo
 * exponencial (1/s). Bastante más lenta que el anclaje de la interfaz: aquí no
 * se persigue un giro sino una estatura, que no cambia.
 */
const SMOOTHING_SPEED = 1.2

// Reutilizado entre frames: crear un vector dentro de useFrame genera basura en
// cada uno de los 90 fotogramas por segundo del visor.
const headPosition = new Vector3()
