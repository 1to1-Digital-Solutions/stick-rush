'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { GROUND_Y, STICK_LENGTH } from '@/lib/gameConfig'

type StickState = 'hanging' | 'falling' | 'caught' | 'missed'

export interface StickProps {
  /** Punto de anclaje en el arco del que cuelga el palo. */
  anchor: [number, number, number]
  color: string
  /** Velocidad de caída en unidades por segundo (según dificultad). */
  speed: number
  /** Retardo, en segundos, antes de empezar a caer. */
  delay: number
  /** Atrapado por el jugador (click o mando XR). */
  onCatch: () => void
  /** Resuelto: atrapado o perdido (para cerrar la partida). */
  onResolve: () => void
}

// Cota a partir de la cual el palo se considera perdido.
const MISS_Y = GROUND_Y

export function Stick({
  anchor,
  color,
  speed,
  delay,
  onCatch,
  onResolve,
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

  const handleCatch = (event?: ThreeEvent<MouseEvent>) => {
    event?.stopPropagation()
    if (resolved.current) return
    if (state !== 'falling' && state !== 'hanging') return
    resolved.current = true
    setState('caught')
    flash.current = 1
    releaseCursor()
    onCatch()
    onResolve()
  }

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    if (!group) return

    // Limita el delta para evitar saltos tras pestañas en segundo plano.
    const delta = Math.min(rawDelta, 0.05)
    elapsed.current += delta

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
      if (elapsed.current >= delay) {
        setState('falling')
      }
      return
    }

    if (state === 'falling' && !resolved.current) {
      group.position.y -= speed * delta
      if (group.position.y <= MISS_Y) {
        group.position.y = MISS_Y
        resolved.current = true
        setState('missed')
        onResolve()
      }
    }
  })

  return (
    <group ref={groupRef} position={[anchorX, anchorY, anchorZ]} visible={visible}>
      {/* Hilo del que cuelga el palo */}
      <mesh position={[0, STICK_LENGTH / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, STICK_LENGTH * 0.6, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* El palo en sí. El pivote está en el anclaje: cuelga hacia abajo. */}
      <mesh
        ref={meshRef}
        position={[0, -STICK_LENGTH / 2, 0]}
        onClick={handleCatch}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (state === 'falling' || state === 'hanging') {
            hovering.current = true
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={releaseCursor}
      >
        <cylinderGeometry args={[0.05, 0.05, STICK_LENGTH, 8]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}
