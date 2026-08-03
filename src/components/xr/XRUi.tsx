'use client'

import { type ReactNode, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

/**
 * Piezas de interfaz para las sesiones inmersivas.
 *
 * En VR/AR no hay DOM, así que menú, marcador y botones son geometría. Todo lo
 * de aquí es local: ni fuentes, ni texturas, ni nada que salga a la red.
 */

/** Fondo de los paneles: oscuro y semitransparente, legible sobre passthrough. */
export const PANEL_COLOR = '#0f1f2b'

/** Panel de fondo. En AR es lo que despega la interfaz de la pared real. */
export function XRPanel({
  width,
  height,
  color = PANEL_COLOR,
  opacity = 0.82,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
}) {
  return (
    <mesh position={[0, 0, -0.02]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Botón 3D.
 *
 * Acepta cualquier puntero —el rayo del mando, la mano o el ratón—, al revés
 * que los palos, que solo se dejan coger con la mano: un menú que hubiera que
 * tocar físicamente sería incómodo de manejar.
 *
 * La zona sensible es una caja invisible más grande que el dibujo del botón:
 * apuntando en el aire, un objetivo del tamaño exacto del icono se falla
 * constantemente.
 */
export function XRPressable({
  position,
  onSelect,
  children,
  hitSize,
  disabled = false,
}: {
  position: [number, number, number]
  onSelect: () => void
  children: ReactNode
  hitSize: [number, number, number]
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const handle = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (disabled) return
    onSelect()
  }

  return (
    <group
      position={position}
      scale={hovered && !disabled ? 1.08 : 1}
      onClick={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
      <mesh visible={false}>
        <boxGeometry args={hitSize} />
      </mesh>
    </group>
  )
}

/** Triángulo de «reproducir»: el símbolo de empezar, sin idioma. */
export function XRPlayIcon({
  position = [0, 0, 0],
  size = 0.05,
  color = '#ffffff',
}: {
  position?: [number, number, number]
  size?: number
  color?: string
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
      <cylinderGeometry args={[size, size, 0.01, 3]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Punta de flecha hacia la izquierda: volver. */
export function XRBackIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: {
  position?: [number, number, number]
  size?: number
  color?: string
}) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <cylinderGeometry args={[size, size, 0.01, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[size * 0.9, 0, 0]}>
        <boxGeometry args={[size * 1.1, size * 0.5, 0.01]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Dos flechas girando: repetir partida. Un anillo abierto con su punta. */
export function XRRepeatIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: {
  position?: [number, number, number]
  size?: number
  color?: string
}) {
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[size, size * 0.22, 8, 20, Math.PI * 1.45]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[size, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.42, size * 0.42, 0.01, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}
