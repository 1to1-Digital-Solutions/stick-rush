'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'
import { useGame } from '../../lib/gameStore'
import {
  initialAnchorState,
  stepAnchor,
  type AnchorState,
} from '../../lib/xrAnchor'
import { usePlayHeight } from '../../lib/ajustesCliente'
import { xrUiRiseOverWorld } from '../../lib/xrLayout'

/**
 * Mantiene la interfaz inmersiva donde el jugador la ve: delante de su cara y a
 * la altura de sus ojos.
 *
 * Todo lo que cuelgue de aquí conserva sus coordenadas de siempre (el menú a
 * 95 cm hacia −Z, por ejemplo), pero ese −Z pasa a ser **hacia donde mira el
 * jugador** en vez de una dirección fija de la sala. Sin esto, entrar en el
 * visor mirando hacia otro lado dejaba el menú a la espalda: ni se veía ni se
 * podía apuntar (ver `@/lib/xrAnchor`).
 *
 * El grupo también acompaña al jugador si camina, de modo que la interfaz no se
 * queda anclada a un punto del cuarto, y se acomoda a su estatura (ver
 * `xrUiRise`): la mide `<XRPlayerHeight>` mientras el menú está delante, así
 * que durante la partida el panel se queda quieto en vez de perseguir la
 * cabeza.
 *
 * Toda la decisión de *cuándo* girar está en `stepAnchor`, que se prueba sin
 * navegador; aquí solo se lee la cámara y se aplica el resultado.
 */
export function XRGazeAnchor({
  children,
  always = false,
}: {
  children: ReactNode
  /**
   * Colocar la interfaz también fuera de sesión inmersiva. Es lo que hace falta
   * cuando el anfitrión no pone interfaz en DOM —el salón de xrcade, sin visor—:
   * ahí esto es la única interfaz que hay, y dejarla sin colocar la deja donde
   * caiga, normalmente a la espalda de quien mira.
   */
  always?: boolean
}) {
  const ref = useRef<Group>(null)
  const anchor = useRef<AnchorState | null>(null)
  const mode = useXR((state) => state.mode)
  const { playerEyeHeight } = useGame()

  // Cada sesión empieza de cero: al entrar, la interfaz debe plantarse delante
  // del jugador de inmediato, sin el giro de reencuadre.
  useEffect(() => {
    anchor.current = null
  }, [mode])

  // Si el mundo entero ya ha bajado hasta quien juega, la interfaz vino con
  // él y no le hace falta corrección propia (ver `xrUiRiseOverWorld`).
  const aLaAlturaDeLosOjos = usePlayHeight() === 'eyes'
  useFrame((state, delta) => {
    const group = ref.current
    // Fuera de sesión inmersiva no hay nada que colocar si manda el DOM; si no
    // lo hay (`always`), esta interfaz es la única y se coloca igual, delante de
    // donde mire la cámara que ponga el anfitrión.
    if (group == null || (mode == null && !always)) return

    const { camera } = state
    camera.getWorldPosition(gazePosition)
    camera.getWorldQuaternion(gazeQuaternion)

    // El orden YXZ aísla el giro horizontal en el primer ángulo: así la
    // interfaz sigue a dónde mira el jugador sin inclinarse cuando levanta o
    // baja la cabeza, que es lo que la haría bailar.
    gazeEuler.setFromQuaternion(gazeQuaternion, 'YXZ')

    // El anclaje trabaja en el espacio del padre (`<XROrigin>`), así que hay
    // que descontar la orientación de ese padre en vez de darla por cero.
    let parentYaw = 0
    const parent = group.parent
    if (parent != null) {
      parent.getWorldQuaternion(parentQuaternion)
      parentEuler.setFromQuaternion(parentQuaternion, 'YXZ')
      parentYaw = parentEuler.y
      parent.worldToLocal(gazePosition)
    }

    const gazeYaw = gazeEuler.y - parentYaw
    const previous = anchor.current
    const next =
      previous == null
        ? initialAnchorState(gazeYaw)
        : stepAnchor(previous, gazeYaw, delta)
    anchor.current = next

    // A la altura de los ojos de quien juega, no a la del suelo: las cotas de
    // `xrLayout` son las de la persona de referencia y suben o bajan con él, así
    // que sentado no se encuentra el panel a la altura de la frente.
    group.position.set(
      gazePosition.x,
      xrUiRiseOverWorld(playerEyeHeight, aLaAlturaDeLosOjos),
      gazePosition.z,
    )
    group.rotation.set(0, next.yaw, 0)
  })

  return <group ref={ref}>{children}</group>
}

// Reutilizados entre frames: crear vectores dentro de useFrame genera basura en
// cada uno de los 90 fotogramas por segundo del visor.
const gazePosition = new Vector3()
const gazeQuaternion = new Quaternion()
const gazeEuler = new Euler()
const parentQuaternion = new Quaternion()
const parentEuler = new Euler()
