'use client'

import { useRef, useState } from 'react'
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

  const [anchorX, anchorY, anchorZ] = anchor

  const handleCatch = (event?: ThreeEvent<MouseEvent>) => {
    event?.stopPropagation()
    if (state !== 'falling' && state !== 'hanging') return
    setState('caught')
    flash.current = 1
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

    if (state === 'falling') {
      group.position.y -= speed * delta
      if (group.position.y <= MISS_Y) {
        group.position.y = MISS_Y
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
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
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
