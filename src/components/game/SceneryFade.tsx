'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { BACKDROP_COLOR } from '../../lib/gameConfig'
import { DECOR_POINTER_EVENTS } from '../../lib/pointers'
import type { SceneryMode } from '../../lib/gameStore'

/**
 * Funde entre el escenario y el passthrough.
 *
 * Cambiar de decorado de golpe es violento: se pasa de una plaza de noche a la
 * habitación del jugador en un fotograma. Aquí se hace en dos tiempos —cerrar,
 * cambiar, abrir— con una cortina que envuelve la cabeza.
 *
 * **Por qué una cortina y no un fundido del propio fondo.** El skybox de
 * `<Environment background>` no se puede volver transparente: o está o no está,
 * y quitarlo es justo lo que revela el passthrough. Una esfera alrededor de la
 * cámara sí se puede desvanecer, y de paso tapa el instante del cambio.
 *
 * El modo que hay que pintar se entrega a los hijos como render prop, para que
 * el cambio ocurra con la cortina cerrada y no se vea el salto.
 */

/** Cuánto dura cada mitad de la transición, en segundos. */
const FADE_SECONDS = 0.32

/** Radio de la cortina: cerca de la cabeza, pero fuera del plano de recorte. */
const CURTAIN_RADIUS = 0.35

export function SceneryFade({
  mode,
  children,
}: {
  mode: SceneryMode
  children: (applied: SceneryMode) => ReactNode
}) {
  // El decorado que se está pintando ahora mismo, que va por detrás de lo que
  // el jugador ha pedido mientras dura el fundido.
  const [applied, setApplied] = useState(mode)
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)
  const opacity = useRef(0)
  const phase = useRef<'idle' | 'closing' | 'opening'>('idle')

  useEffect(() => {
    if (applied !== mode) phase.current = 'closing'
  }, [mode, applied])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (mesh == null || material == null) return

    // La cortina va pegada a la cabeza. En el visor el jugador se mueve por la
    // habitación, y una esfera anclada al origen de la escena se le quedaría
    // detrás justo durante el cambio.
    //
    // **Y la posición del mundo se traduce al espacio de su padre.** La cortina cuelga del
    // decorado, que va corrido hacia delante y —montado en el salón— girado hacia donde
    // estaba el arco (`HostAnchored`): asignada tal cual, la esfera se planta desplazada
    // justo lo que se haya movido el mundo, y con 35 cm de radio eso es dejar la cabeza
    // fuera. `worldToLocal` recorre la cadena entera de padres, que es lo que hay que
    // deshacer.
    state.camera.getWorldPosition(mesh.position)
    const padre = mesh.parent
    if (padre != null) {
      // three solo pone al día las matrices al pintar, y el decorado se coloca en su propio
      // render: sin esto se traduciría con el mundo del fotograma anterior.
      padre.updateWorldMatrix(true, false)
      padre.worldToLocal(mesh.position)
    }

    const step = delta / FADE_SECONDS

    if (phase.current === 'closing') {
      opacity.current = Math.min(1, opacity.current + step)
      if (opacity.current >= 1) {
        // Con la cortina cerrada se cambia el decorado: el salto no se ve.
        setApplied(mode)
        phase.current = 'opening'
      }
    } else if (phase.current === 'opening') {
      opacity.current = Math.max(0, opacity.current - step)
      if (opacity.current <= 0) phase.current = 'idle'
    }

    material.opacity = opacity.current
    // Invisible del todo cuando no hace nada: si no, en AR una esfera negra al
    // 0 % de opacidad seguiría escribiendo en el buffer de profundidad.
    mesh.visible = opacity.current > 0.001
  })

  return (
    <>
      {/* Y fuera del alcance de los punteros, dicho aquí además de heredarlo del mundo: es una
          esfera de 35 cm **alrededor de la cabeza**, y una forma que envuelve la mano cuenta
          como tocada a distancia cero. Estar invisible no la aparta: a la librería de punteros
          la visibilidad no le dice nada (`lib/pointers.ts`). */}
      <mesh ref={meshRef} visible={false} pointerEvents={DECOR_POINTER_EVENTS}>
        {/* Vista desde dentro: la esfera envuelve al jugador. */}
        <sphereGeometry args={[CURTAIN_RADIUS, 16, 12]} />
        <meshBasicMaterial
          ref={materialRef}
          color={BACKDROP_COLOR}
          side={BackSide}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {children(applied)}
    </>
  )
}
