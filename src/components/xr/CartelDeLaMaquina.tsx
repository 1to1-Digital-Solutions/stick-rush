'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useHand } from '../../lib/ajustesCliente'
import { pulsosDelListon, sitioDelCartel } from '../../lib/cartelDeLaMaquina'
import { useGame } from '../../lib/gameStore'
import { reproducirPulsos } from '../../lib/haptics'
import type { Medalla } from '../../lib/objetivo'
import { CartelDeObjetivo } from './CartelDeObjetivo'

/** El cartel no se mueve: su sitio es el mismo toda la partida. */
const SITIO = sitioDelCartel()

/**
 * El cartel del objetivo, de frente y bajo la máquina: encima del marcador del visor.
 *
 * Aquí solo se junta lo de cada lado: qué dice sale del store (`cartel`), dónde va lo decide
 * `sitioDelCartel` y lo pinta el componente común a todos los juegos del salón. Cuelga de la
 * interfaz (`XRGazeAnchor`), como el marcador: va con quien juega, no con el decorado, y sube o
 * baja con sus ojos.
 *
 * Fuera de la sesión inmersiva, en la web del juego, manda el marcador en DOM y la misión se
 * lee allí (`HUD.tsx`).
 */
export function CartelDeLaMaquina({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const session = useXR((state) => state.session)
  const { cartel, medalla } = useGame()
  const mano = useHand()

  // El listón cruzado se nota en la mano buena, un instante después del atrape que lo cruzó; el
  // sonido lo pone `useGameSound`. Lo que quede pendiente se cancela al desmontar.
  const cancelar = useRef(() => {})
  useEffect(() => () => cancelar.current(), [])
  const alCelebrar = useCallback(
    (cruzada: Medalla) => {
      cancelar.current()
      cancelar.current = reproducirPulsos(session?.inputSources ?? [], pulsosDelListon(cruzada, mano))
    },
    [session, mano],
  )

  if ((hasDomUi && mode == null) || cartel == null) return null

  return (
    <CartelDeObjetivo
      vista={cartel}
      position={SITIO.position}
      rotation={SITIO.rotation}
      distancia={SITIO.distancia}
      celebra={medalla}
      alCelebrar={alCelebrar}
    />
  )
}
