'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'

/**
 * El mando dibujado con geometría propia, y la marca de qué botón agarra.
 *
 * **Por qué no el modelo de la librería.** @react-three/xr descarga el modelo
 * real de cada mando desde `cdn.jsdelivr.net`, y este juego tiene que funcionar
 * en un visor sin salida a internet —además, la CSP lo bloquea—. Se había
 * resuelto con `model: false`, pero eso dejaba las manos **invisibles**: sin
 * mando y sin nada delante que el rayo pudiera tocar, el jugador no tenía forma
 * de saber hacia dónde apuntaba. Así que se dibuja aquí, con cuatro primitivas
 * y cero descargas.
 *
 * No pretende ser un retrato del mando: basta con que haya un objeto sólido
 * donde está la mano y que el gatillo lateral cante.
 *
 * Vive separado de `XRController` porque no lo usa solo la mano de verdad: el
 * tutorial enseña este mismo mando y este mismo gatillo (ver `XRTutorial`), y
 * el botón que rescata el tutorial desde el menú lo lleva en miniatura. Enseñar
 * un dibujo distinto del que luego se tiene en la mano sería enseñar otra cosa.
 */

/** Gris del cuerpo, con algo de emisión para que no se pierda en la noche. */
const BODY_COLOR = '#2b3442'
/** Ámbar de la marca: el mismo lenguaje visual que los palos. */
export const HINT_COLOR = '#fbbf24'
/** Verde de confirmación cuando el gatillo está apretado. */
const PRESSED_COLOR = '#22c55e'

/** Ciclos por segundo del latido de la marca. */
const HINT_PULSE_HZ = 1.6

/**
 * Cuerpo del mando, a lo largo del eje Y del `grip-space`: según la spec de
 * WebXR ese eje sale por arriba del puño, así que el mango cae hacia −Y y la
 * cabeza (donde está el pulgar) queda arriba.
 */
export function ControllerBody() {
  return (
    <group>
      {/* Mango: ligeramente inclinado hacia la muñeca, como el real. */}
      <mesh position={[0, -0.045, 0.012]} rotation={[0.22, 0, 0]}>
        <capsuleGeometry args={[0.018, 0.07, 4, 12]} />
        <meshStandardMaterial
          color={BODY_COLOR}
          emissive={BODY_COLOR}
          emissiveIntensity={0.35}
          roughness={0.65}
          metalness={0.15}
        />
      </mesh>

      {/* Cabeza: el disco donde viven el stick y los botones. */}
      <mesh position={[0, 0.008, -0.004]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.028, 0.018, 16]} />
        <meshStandardMaterial
          color={BODY_COLOR}
          emissive={BODY_COLOR}
          emissiveIntensity={0.35}
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      {/* Gatillo del índice, en la cara delantera. No se usa para agarrar:
          está para que el mando se lea como un mando y el jugador sitúe el
          lateral por contraste. */}
      <mesh position={[0, -0.012, -0.026]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.016, 0.02, 0.008]} />
        <meshStandardMaterial
          color="#1b2230"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
    </group>
  )
}

/**
 * El gatillo lateral —el que cierra la mano— y su marca.
 *
 * Late en ámbar mientras haya algo que enseñar, y se pone verde y quieto en
 * cuanto el jugador lo aprieta: además de señalar el botón, confirma que el
 * visor está leyendo la pulsación.
 *
 * @param side      −1 o 1 según la mano, para que el botón salga en el costado
 *   que toca (el que aprietan los dedos, hacia el interior).
 * @param highlight si el gatillo va marcado en ámbar o apagado como el resto.
 * @param pulsing   si esa marca late y emite la onda. En una miniatura quieta
 *   —el botón del menú— el latido distrae y la marca se queda fija.
 * @param isPressed se consulta en cada fotograma. Es una función y no un valor
 *   porque el estado del gamepad cambia sin que React vuelva a renderizar.
 */
export function SqueezeButton({
  side,
  highlight,
  pulsing = true,
  isPressed,
}: {
  side: number
  highlight: boolean
  pulsing?: boolean
  isPressed?: () => boolean
}) {
  const materialRef = useRef<MeshStandardMaterial>(null)
  const ringRef = useRef<Mesh>(null)
  const ringMaterialRef = useRef<MeshStandardMaterial>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    const material = materialRef.current
    if (material == null) return

    const pressed = isPressed?.() ?? false
    time.current += delta

    // Apretado: verde fijo, sin latido. Es la confirmación de que va bien.
    if (pressed) {
      material.emissiveIntensity = 1.5
      material.color.set(PRESSED_COLOR)
      material.emissive.set(PRESSED_COLOR)
    } else {
      const pulse =
        highlight && pulsing
          ? 0.5 + 0.5 * Math.sin(time.current * Math.PI * 2 * HINT_PULSE_HZ)
          : 0
      material.emissiveIntensity = 0.25 + pulse * 1.3
      material.color.set(highlight ? HINT_COLOR : '#1b2230')
      material.emissive.set(HINT_COLOR)

      const ring = ringRef.current
      const ringMaterial = ringMaterialRef.current
      if (ring != null && ringMaterial != null) {
        // El anillo crece y se desvanece, como una onda que sale del botón.
        ring.scale.setScalar(1 + pulse * 0.6)
        ringMaterial.opacity = highlight ? (1 - pulse) * 0.7 : 0
      }
    }

    const ring = ringRef.current
    if (ring != null) ring.visible = highlight && !pressed
  })

  return (
    <group position={[side * 0.021, -0.03, 0.004]} rotation={[0, 0, side * -0.3]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.006, 0.022, 3, 8]} />
        <meshStandardMaterial
          ref={materialRef}
          color={HINT_COLOR}
          emissive={HINT_COLOR}
          emissiveIntensity={0.5}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Onda que señala el botón sin necesidad de una sola letra. */}
      <mesh ref={ringRef} position={[side * 0.006, 0, 0]} rotation={[0, side * Math.PI / 2, 0]}>
        <torusGeometry args={[0.016, 0.0022, 6, 20]} />
        <meshStandardMaterial
          ref={ringMaterialRef}
          color={HINT_COLOR}
          emissive={HINT_COLOR}
          emissiveIntensity={1.4}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** El mando entero: cuerpo y gatillo de agarre. */
export function ControllerModel({
  side,
  highlight,
  pulsing,
  isPressed,
}: {
  side: number
  highlight: boolean
  pulsing?: boolean
  isPressed?: () => boolean
}) {
  return (
    <>
      <ControllerBody />
      <SqueezeButton
        side={side}
        highlight={highlight}
        pulsing={pulsing}
        isPressed={isPressed}
      />
    </>
  )
}
