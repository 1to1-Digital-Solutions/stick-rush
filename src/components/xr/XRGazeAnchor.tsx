'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'
import {
  initialAnchorState,
  stepAnchor,
  type AnchorState,
} from '@/lib/xrAnchor'

/**
 * Mantiene la interfaz inmersiva dentro del campo de visión del jugador.
 *
 * Todo lo que cuelgue de aquí conserva sus coordenadas de siempre (el menú a
 * 95 cm hacia −Z, por ejemplo), pero ese −Z pasa a ser **hacia donde mira el
 * jugador** en vez de una dirección fija de la sala. Sin esto, entrar en el
 * visor mirando hacia otro lado dejaba el menú a la espalda: ni se veía ni se
 * podía apuntar (ver `@/lib/xrAnchor`).
 *
 * El grupo también acompaña al jugador si camina, de modo que la interfaz no se
 * queda anclada a un punto del cuarto.
 *
 * Toda la decisión de *cuándo* girar está en `stepAnchor`, que se prueba sin
 * navegador; aquí solo se lee la cámara y se aplica el resultado.
 */
export function XRGazeAnchor({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  const anchor = useRef<AnchorState | null>(null)
  const mode = useXR((state) => state.mode)

  // Cada sesión empieza de cero: al entrar, la interfaz debe plantarse delante
  // del jugador de inmediato, sin el giro de reencuadre.
  useEffect(() => {
    anchor.current = null
  }, [mode])

  useFrame((state, delta) => {
    const group = ref.current
    // Fuera de sesión inmersiva no hay nada que colocar: manda el DOM.
    if (group == null || mode == null) return

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

    // Bajo los pies del jugador, no bajo su cabeza: las alturas de la interfaz
    // se miden desde el suelo, igual que antes.
    group.position.set(gazePosition.x, 0, gazePosition.z)
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
