'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CombinedPointer,
  DefaultXRControllerGrabPointer,
  DefaultXRInputSourceRayPointer,
  XRSpace,
  useXRInputSourceStateContext,
} from '@react-three/xr'
import type { Mesh, MeshStandardMaterial } from 'three'
import { useGame } from '@/lib/gameStore'

/**
 * Mando dibujado con geometría propia, y la pista de qué botón aprieta.
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
 */

/** Gris del cuerpo, con algo de emisión para que no se pierda en la noche. */
const BODY_COLOR = '#2b3442'
/** Ámbar de la pista: el mismo lenguaje visual que los palos. */
const HINT_COLOR = '#fbbf24'
/** Verde de confirmación cuando el gatillo está apretado. */
const PRESSED_COLOR = '#22c55e'

/** Ciclos por segundo del latido de la pista. */
const HINT_PULSE_HZ = 1.6

/**
 * Cuerpo del mando, a lo largo del eje Y del `grip-space`: según la spec de
 * WebXR ese eje sale por arriba del puño, así que el mango cae hacia −Y y la
 * cabeza (donde está el pulgar) queda arriba.
 */
function ControllerBody() {
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
 * El gatillo lateral —el que cierra la mano— y su pista.
 *
 * Late en ámbar mientras el jugador no haya atrapado ningún palo, y se pone
 * verde y quieto en cuanto lo aprieta: además de enseñar el botón, confirma que
 * el visor está leyendo la pulsación. Cuando ya ha cogido uno, la pista se
 * apaga sola y no vuelve a estorbar.
 *
 * @param side −1 o 1 según la mano, para que el botón salga en el costado que
 *   toca (el que aprietan los dedos, hacia el interior).
 */
function SqueezeButton({ side, hint }: { side: number; hint: boolean }) {
  const state = useXRInputSourceStateContext('controller')
  const materialRef = useRef<MeshStandardMaterial>(null)
  const ringRef = useRef<Mesh>(null)
  const ringMaterialRef = useRef<MeshStandardMaterial>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    const material = materialRef.current
    if (material == null) return

    const pressed = state.gamepad['xr-standard-squeeze']?.state === 'pressed'
    time.current += delta

    // Apretado: verde fijo, sin latido. Es la confirmación de que va bien.
    if (pressed) {
      material.emissiveIntensity = 1.5
      material.color.set(PRESSED_COLOR)
      material.emissive.set(PRESSED_COLOR)
    } else {
      const pulse = hint
        ? 0.5 + 0.5 * Math.sin(time.current * Math.PI * 2 * HINT_PULSE_HZ)
        : 0
      material.emissiveIntensity = 0.25 + pulse * 1.3
      material.color.set(hint ? HINT_COLOR : '#1b2230')
      material.emissive.set(HINT_COLOR)

      const ring = ringRef.current
      const ringMaterial = ringMaterialRef.current
      if (ring != null && ringMaterial != null) {
        // El anillo crece y se desvanece, como una onda que sale del botón.
        ring.scale.setScalar(1 + pulse * 0.6)
        ringMaterial.opacity = hint ? (1 - pulse) * 0.7 : 0
      }
    }

    const ring = ringRef.current
    if (ring != null) ring.visible = hint && !pressed
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

/**
 * Implementación completa del mando: lo que se ve, más los punteros.
 *
 * Sustituye a `<DefaultXRController>`, así que tiene que montar los punteros
 * ella misma. Se conservan los dos: el de agarre (esfera en el puño, gatillo
 * lateral) es con el que se cogen los palos, y el rayo se queda para el menú,
 * que está a un brazo largo y sería incómodo tocar. Quién puede atrapar y quién
 * no lo decide `Stick` con `canCatchWithPointer`, no este fichero.
 */
export function StickRushController() {
  const state = useXRInputSourceStateContext('controller')
  const { gameState, score } = useGame()

  const handedness = state.inputSource.handedness
  // El gatillo lateral cae hacia el interior de la mano: en el mando izquierdo
  // queda a su derecha y viceversa.
  const side = handedness === 'left' ? 1 : -1

  // La pista solo mientras haga falta: desde la cuenta atrás —que es justo
  // cuando conviene enseñar el control, antes de que caiga nada— y hasta que
  // atrape el primer palo. En el menú estorbaría, porque allí se usa el rayo.
  const hint =
    (gameState === 'countdown' || gameState === 'playing') && score === 0

  return (
    <>
      <XRSpace space="grip-space">
        <ControllerBody />
        <SqueezeButton side={side} hint={hint} />
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
