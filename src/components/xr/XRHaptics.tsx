'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { MISS_PULSE, pulseAllHaptics } from '../../lib/haptics'

/**
 * El golpe de vibración del palo que se escapa.
 *
 * El del acierto lo da `Stick` en el propio agarre, porque ahí hay un evento
 * del que sacar la mano que lo cogió. El fallo no tiene ninguna: el palo llega
 * al suelo solo. Así que se escucha al juego —como hace `useGameSound` con el
 * sonido— y el aviso sale por los dos mandos de la sesión.
 *
 * Mira los contadores y no `missStick`, y por eso vive aquí y no en el store:
 * el store es el juego, común al ratón y al visor, y esto solo existe con las
 * gafas puestas. Dos palos perdidos en el mismo lote de React dan un solo
 * golpe, igual que suenan una sola vez: dos vibraciones simultáneas en la misma
 * mano no se sienten como dos.
 *
 * Debe montarse dentro de <XR>, para poder leer los mandos de la sesión.
 */
export function XRHaptics() {
  const session = useXR((state) => state.session)
  const { score, resolved } = useGame()
  const missed = resolved - score
  const previous = useRef(0)

  useEffect(() => {
    const before = previous.current
    previous.current = missed
    // Solo cuando sube: el contador también vuelve a cero al empezar otra
    // partida, y eso no es ningún palo perdido.
    if (missed <= before) return
    pulseAllHaptics(session, MISS_PULSE)
  }, [missed, session])

  return null
}
