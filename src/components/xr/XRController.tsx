'use client'

import {
  CombinedPointer,
  DefaultXRControllerGrabPointer,
  DefaultXRInputSourceRayPointer,
  XRSpace,
  useXRInputSourceStateContext,
} from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { ControllerModel } from './XRControllerModel'

/**
 * El mando del jugador: lo que se ve en su mano, más los punteros.
 *
 * Sustituye a `<DefaultXRController>`, así que tiene que montar los punteros
 * ella misma. Se conservan los dos: el de agarre (esfera en el puño, gatillo
 * lateral) es con el que se cogen los palos, y el rayo se queda para el menú,
 * que está a un brazo largo y sería incómodo tocar. Quién puede atrapar y quién
 * no lo decide `Stick` con `canCatchWithPointer`, no este fichero.
 *
 * El dibujo del mando vive en `XRControllerModel`, porque el tutorial enseña
 * ese mismo mando antes de que el jugador tenga nada que agarrar.
 */
export function StickRushController() {
  const state = useXRInputSourceStateContext('controller')
  const { gameState, score } = useGame()

  const handedness = state.inputSource.handedness
  // El gatillo lateral cae hacia el interior de la mano: en el mando izquierdo
  // queda a su derecha y viceversa.
  const side = handedness === 'left' ? 1 : -1

  // La marca solo mientras haga falta: desde la cuenta atrás —que es justo
  // cuando conviene enseñar el control, antes de que caiga nada— y hasta que
  // atrape el primer palo. En el menú estorbaría, porque allí se usa el rayo, y
  // durante el tutorial la lleva el mando de la demostración.
  const highlight =
    (gameState === 'countdown' || gameState === 'playing') && score === 0

  return (
    <>
      <XRSpace space="grip-space">
        <ControllerModel
          side={side}
          highlight={highlight}
          isPressed={() =>
            state.gamepad['xr-standard-squeeze']?.state === 'pressed'
          }
        />
      </XRSpace>

      <CombinedPointer>
        <DefaultXRControllerGrabPointer
          radius={CONTROLLER_GRAB_RADIUS}
          cursorModel
        />
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel
          cursorModel
        />
      </CombinedPointer>
    </>
  )
}

/** Radio de la esfera de agarre del mando, en metros (por defecto 0.07). */
export const CONTROLLER_GRAB_RADIUS = 0.09
