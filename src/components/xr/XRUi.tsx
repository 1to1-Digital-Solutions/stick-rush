'use client'

import { type ReactNode, useRef, useState } from 'react'
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

/** Color del halo que marca el botón apuntado. */
const HOVER_COLOR = '#7dd3fc'

/**
 * Ventana, en milisegundos, durante la que se ignora una segunda pulsación.
 * Los dos mandos pueden cruzarse sobre el mismo botón, y un agarre suele
 * registrar el puntero de rayo y el de contacto casi a la vez.
 */
const DEBOUNCE_MS = 300

/**
 * Botón 3D.
 *
 * Acepta cualquier puntero —el rayo del mando, la mano o el ratón—, al revés
 * que los palos, que solo se dejan coger con la mano: un menú que hubiera que
 * tocar físicamente sería incómodo de manejar.
 *
 * Dos decisiones que vienen de probarlo en el visor:
 *
 * - **Se resuelve al pulsar, no al soltar.** `onClick` exige pulsar y soltar
 *   sobre el mismo objeto; apuntando a pulso a un metro de distancia, el rayo
 *   se sale del botón entre una cosa y la otra y la pulsación se pierde. Es el
 *   mismo motivo por el que `Stick` escucha `onPointerDown`.
 * - **El foco se ve.** Sin modelo de mando el jugador no tenía forma de saber
 *   a qué apuntaba. Ahora el botón apuntado crece *y* se enciende con un halo:
 *   forma y color, nunca solo color.
 *
 * La zona sensible es una caja invisible más grande que el dibujo del botón:
 * apuntando en el aire, un objetivo del tamaño exacto del icono se falla
 * constantemente. Que sea invisible no la excluye del raycasting —los punteros
 * de @pmndrs/pointer-events no miran `visible`, solo si hay listeners.
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
  const lastFired = useRef(0)

  const handle = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    event.stopPropagation()
    if (disabled) return

    const now =
      typeof performance !== 'undefined' ? performance.now() : lastFired.current
    if (now - lastFired.current < DEBOUNCE_MS) return
    lastFired.current = now

    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = hitSize

  return (
    <group
      position={position}
      scale={active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}

      {/* Halo de foco: por detrás del dibujo, para enmarcarlo sin taparlo. */}
      <mesh position={[0, 0, -0.014]} visible={active}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={HOVER_COLOR}
          transparent
          opacity={0.34}
          toneMapped={false}
        />
      </mesh>

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

/** Dos montañas y una luna: el escenario del juego. */
export function XRSceneIcon({
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
      {[-0.5, 0.45].map((offset, index) => (
        <mesh
          key={index}
          position={[offset * size, index === 0 ? 0 : size * 0.18, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[size * (index === 0 ? 0.62 : 0.48), 0, 0.008, 3]}
          />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[size * 0.75, size * 0.85, 0]}>
        <circleGeometry args={[size * 0.2, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Un marco vacío: la habitación de verdad, sin decorado encima. */
export function XRPassthroughIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: {
  position?: [number, number, number]
  size?: number
  color?: string
}) {
  const thickness = size * 0.16

  return (
    <group position={position}>
      {/* Cuatro barras que dejan el centro despejado. */}
      {[
        [0, size * 0.9, size * 2, thickness],
        [0, -size * 0.9, size * 2, thickness],
        [-size, 0, thickness, size * 1.8],
        [size, 0, thickness, size * 1.8],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <boxGeometry args={[width, height, 0.008]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
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
