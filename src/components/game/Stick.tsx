'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  STICK_RADIUS,
  stickFallProgress,
} from '@/lib/gameConfig'
import { canCatchWithPointer } from '@/lib/xrInteraction'

type StickState = 'hanging' | 'falling' | 'caught' | 'missed'

/**
 * Tipo de puntero que ha disparado el evento, si lo trae. Los eventos de ratón
 * no lo llevan; los de @pmndrs/pointer-events (los de XR) sí.
 */
function pointerTypeOf(event: unknown): string | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerType } = event as { pointerType?: unknown }
  return typeof pointerType === 'string' ? pointerType : undefined
}

export interface StickProps {
  /** Punto de anclaje en el aro del que cuelga el palo. */
  anchor: [number, number, number]
  color: string
  /**
   * Relieve y rugosidad de la madera. Los carga y comparte StickMachine: el
   * material sí es propio de cada palo (el destello al atraparlo cambia su
   * emisión), pero las texturas, que es lo caro, se cargan una sola vez.
   */
  normalMap: Texture
  roughnessMap: Texture
  /** Velocidad de caída en unidades por segundo (según dificultad). */
  speed: number
  /** Retardo, en segundos, antes de empezar a caer. */
  delay: number
  /**
   * Con la partida parada (menú o fin) el palo se queda colgando: su reloj no
   * corre. Si no, los palos se soltaban mientras el jugador elegía opciones y
   * al empezar ya estaban por el suelo.
   */
  paused: boolean
  /**
   * Atrapado por el jugador (click o mando XR). Recibe cuánto había caído el
   * palo, de 0 (recién soltado) a 1 (a ras de suelo): cogerlo pronto puntúa más.
   */
  onCatch: (fallProgress: number) => void
  /** Se le escapó y ha tocado el suelo. */
  onMiss: () => void
}

export function Stick({
  anchor,
  color,
  normalMap,
  roughnessMap,
  speed,
  delay,
  paused,
  onCatch,
  onMiss,
}: StickProps) {
  const groupRef = useRef<Group>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const meshRef = useRef<Mesh>(null)

  const [state, setState] = useState<StickState>('hanging')
  // Visibilidad: se oculta cuando termina la animación de captura.
  const [visible, setVisible] = useState(true)
  // Tiempo acumulado desde el inicio (para gestionar el delay escalonado).
  const elapsed = useRef(0)
  // Intensidad del glow al ser atrapado, que decae con el tiempo.
  const flash = useRef(0)
  // Un palo solo puede resolverse una vez. Hace falta un ref además del
  // estado porque `setState` no se aplica hasta el siguiente render: dos
  // capturas en el mismo frame (los dos mandos XR apuntando al mismo palo,
  // o una captura justo cuando toca el suelo) verían ambas 'falling'.
  const resolved = useRef(false)
  // Si el puntero está encima, para devolver el cursor al desmontar.
  const hovering = useRef(false)

  const [anchorX, anchorY, anchorZ] = anchor

  const releaseCursor = () => {
    if (!hovering.current) return
    hovering.current = false
    document.body.style.cursor = 'auto'
  }

  // El palo desaparece al ser atrapado y se desmonta al acabar la partida:
  // si el puntero estaba encima, `onPointerOut` ya no llega y el cursor se
  // quedaría en 'pointer'.
  useEffect(() => releaseCursor, [])

  const handleCatch = (event?: ThreeEvent<PointerEvent | MouseEvent>) => {
    // Se coge con la mano, no apuntando: ver `canCatchWithPointer`.
    if (!canCatchWithPointer(pointerTypeOf(event))) return
    event?.stopPropagation()
    if (resolved.current) return
    if (state !== 'falling' && state !== 'hanging') return
    resolved.current = true
    setState('caught')
    flash.current = 1
    releaseCursor()
    // Dónde estaba el palo al cogerlo decide el bonus por reflejos. Se lee de
    // la posición viva y no del estado, que aún no se ha vuelto a renderizar.
    onCatch(stickFallProgress(groupRef.current?.position.y ?? anchorY))
  }

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    if (!group) return

    // Limita el delta para evitar saltos tras pestañas en segundo plano.
    const delta = Math.min(rawDelta, 0.05)
    if (!paused) {
      elapsed.current += delta
    }

    // Animación del flash de captura (escala + emissive decreciente).
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - delta * 2.5)
      const scale = 1 + flash.current * 0.6
      group.scale.setScalar(scale)
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = flash.current * 1.8
      }
      // Cuando el flash se apaga, el palo atrapado desaparece.
      if (flash.current <= 0 && state === 'caught') {
        setVisible(false)
      }
    }

    if (state === 'hanging') {
      if (!paused && elapsed.current >= delay) {
        setState('falling')
      }
      return
    }

    if (state === 'falling' && !resolved.current && !paused) {
      group.position.y -= speed * delta
      if (group.position.y <= STICK_MISS_Y) {
        group.position.y = STICK_MISS_Y
        resolved.current = true
        setState('missed')
        onMiss()
      }
    }
  })

  return (
    <group ref={groupRef} position={[anchorX, anchorY, anchorZ]} visible={visible}>
      {/* Hilo que une el arco con el palo. Solo mientras cuelga: en cuanto el
          palo se suelta deja de haber nada que lo sujete. */}
      <mesh position={[0, -STICK_CORD_LENGTH / 2, 0]} visible={state === 'hanging'}>
        <cylinderGeometry args={[0.005, 0.005, STICK_CORD_LENGTH, 6]} />
        <meshStandardMaterial color="#4a4038" metalness={0.1} roughness={0.9} />
      </mesh>

      {/* El palo en sí, colgando bajo el hilo. */}
      <mesh
        ref={meshRef}
        position={[0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0]}
        onClick={handleCatch}
        // El agarre se resuelve al cerrar la mano, sin esperar a soltar: con el
        // palo cayendo, exigir un clic completo (pulsar y soltar sobre el mismo
        // objeto) haría fallar agarres que el jugador siente como buenos.
        onPointerDown={handleCatch}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (state === 'falling' || state === 'hanging') {
            hovering.current = true
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={releaseCursor}
      >
        <cylinderGeometry args={[STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, 16]} />
        {/* Madera pintada, no plástico: el grano en relieve y la aspereza
            irregular son los que dan la sensación de peso. */}
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          normalMap={normalMap}
          normalScale={[0.8, 0.8]}
          roughnessMap={roughnessMap}
          emissive={color}
          emissiveIntensity={0}
          metalness={0}
          roughness={0.75}
        />
      </mesh>
    </group>
  )
}
