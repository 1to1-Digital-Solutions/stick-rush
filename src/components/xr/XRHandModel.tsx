'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshStandardMaterial } from 'three'

import { HINT_COLOR } from './XRControllerModel'

/**
 * La mano desnuda dibujada con geometría propia, cerrándose sobre el palo.
 *
 * Existe por lo mismo que `XRControllerModel`, pero al revés. El tutorial
 * enseñaba **un mando** con su gatillo lateral marcado, y quien entra al visor
 * con las manos —sin mandos a mano, o sin poder sostenerlos— veía un objeto que
 * no tiene y un botón que no puede apretar. Con las manos el gesto es otro: se
 * lleva la mano al palo y se cierra, sin botón ninguno.
 *
 * No pretende ser un retrato de una mano: basta con que se lea como una y con
 * que **se vea cerrarse**, que es la instrucción entera. La yema de los dedos
 * lleva la marca ámbar —el mismo lenguaje que el gatillo del mando y que los
 * palos— y se pone verde al cerrarse, que además confirma que el visor está
 * leyendo el gesto.
 */

/** Tono de la mano, con algo de emisión para que no se pierda en la noche. */
const SKIN_COLOR = '#c08b6a'
/** Verde de confirmación cuando la mano está cerrada. */
const CLOSED_COLOR = '#22c55e'

/** Ciclos por segundo del latido de la marca, el mismo que el del mando. */
const HINT_PULSE_HZ = 1.6

/** Cuánto se doblan los dedos al cerrarse, en radianes. */
const FULL_CURL = 1.5

/** Velocidad a la que la mano se cierra y se abre, en fracción por segundo. */
const CURL_SPEED = 7

/** Dónde nace cada dedo a lo ancho de la palma, en fracciones de su ancho. */
const FINGER_SPREAD = [-0.33, -0.11, 0.11, 0.33]

/** Medidas de la mano, en metros. Del tamaño del mando al que sustituye. */
const PALM_WIDTH = 0.05
const PALM_HEIGHT = 0.05
const PALM_DEPTH = 0.02
const FINGER_LENGTH = 0.038
const FINGER_THICKNESS = 0.009

/**
 * La mano, con los dedos cerrándose.
 *
 * @param side      −1 o 1 según la mano, para que el pulgar salga en el costado
 *   que toca: es lo único que distingue una mano de la otra de un vistazo.
 * @param highlight si las yemas van marcadas en ámbar o apagadas como el resto.
 * @param pulsing   si esa marca late. En una miniatura quieta —el botón del
 *   menú— el latido distrae y la marca se queda fija.
 * @param isClosed  se consulta en cada fotograma. Es una función y no un valor
 *   porque quien la cierra —la demostración del tutorial— corre por referencia,
 *   sin pasar por React.
 */
export function HandModel({
  side,
  highlight,
  pulsing = true,
  isClosed,
}: {
  side: number
  highlight: boolean
  pulsing?: boolean
  isClosed?: () => boolean
}) {
  const fingersRef = useRef<(Group | null)[]>([])
  const thumbRef = useRef<Group>(null)
  const tipMaterials = useRef<(MeshStandardMaterial | null)[]>([])
  const curl = useRef(0)
  const time = useRef(0)

  useFrame((_, delta) => {
    const closed = isClosed?.() ?? false
    time.current += delta

    // La mano no salta entre abierta y cerrada: se cierra. Es el movimiento lo
    // que convierte el dibujo en una instrucción, igual que en el resto de la
    // demostración.
    const target = closed ? 1 : 0
    curl.current += (target - curl.current) * Math.min(1, delta * CURL_SPEED)

    for (const finger of fingersRef.current) {
      if (finger != null) finger.rotation.x = curl.current * FULL_CURL
    }
    // El pulgar se cierra menos y hacia dentro: es lo que hace que la mano
    // parezca agarrar y no solo doblarse.
    const thumb = thumbRef.current
    if (thumb != null) thumb.rotation.z = side * curl.current * -0.7

    const pulse =
      highlight && pulsing && !closed
        ? 0.5 + 0.5 * Math.sin(time.current * Math.PI * 2 * HINT_PULSE_HZ)
        : 0
    for (const material of tipMaterials.current) {
      if (material == null) continue
      if (closed) {
        material.color.set(CLOSED_COLOR)
        material.emissive.set(CLOSED_COLOR)
        material.emissiveIntensity = 1.5
      } else {
        material.color.set(highlight ? HINT_COLOR : SKIN_COLOR)
        material.emissive.set(HINT_COLOR)
        material.emissiveIntensity = highlight ? 0.25 + pulse * 1.3 : 0
      }
    }
  })

  return (
    <group>
      {/* La palma, de canto: el dorso mira al jugador y los dedos se cierran
          hacia él, que es como se ve la propia mano al coger algo. */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[PALM_WIDTH, PALM_HEIGHT, PALM_DEPTH]} />
        <meshStandardMaterial
          color={SKIN_COLOR}
          emissive={SKIN_COLOR}
          emissiveIntensity={0.25}
          roughness={0.8}
        />
      </mesh>

      {FINGER_SPREAD.map((offset, index) => (
        <group
          key={offset}
          ref={(node) => {
            fingersRef.current[index] = node
          }}
          position={[offset * PALM_WIDTH, PALM_HEIGHT / 2, 0]}
        >
          <mesh position={[0, FINGER_LENGTH / 2, 0]}>
            <capsuleGeometry args={[FINGER_THICKNESS / 2, FINGER_LENGTH, 3, 8]} />
            <meshStandardMaterial
              color={SKIN_COLOR}
              emissive={SKIN_COLOR}
              emissiveIntensity={0.25}
              roughness={0.8}
            />
          </mesh>
          {/* La yema: es la que lleva la marca, porque es la que toca el palo. */}
          <mesh position={[0, FINGER_LENGTH * 0.95, 0]}>
            <sphereGeometry args={[FINGER_THICKNESS * 0.62, 10, 8]} />
            <meshStandardMaterial
              ref={(node) => {
                tipMaterials.current[index] = node
              }}
              color={HINT_COLOR}
              emissive={HINT_COLOR}
              emissiveIntensity={0.5}
              roughness={0.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* El pulgar, en el costado que le toca a esta mano. */}
      <group
        ref={thumbRef}
        position={[(side * PALM_WIDTH) / 2, -PALM_HEIGHT * 0.12, 0]}
      >
        <mesh
          position={[side * FINGER_LENGTH * 0.3, FINGER_LENGTH * 0.28, 0]}
          rotation={[0, 0, side * -0.9]}
        >
          <capsuleGeometry
            args={[FINGER_THICKNESS / 2, FINGER_LENGTH * 0.75, 3, 8]}
          />
          <meshStandardMaterial
            color={SKIN_COLOR}
            emissive={SKIN_COLOR}
            emissiveIntensity={0.25}
            roughness={0.8}
          />
        </mesh>
        <mesh position={[side * FINGER_LENGTH * 0.56, FINGER_LENGTH * 0.55, 0]}>
          <sphereGeometry args={[FINGER_THICKNESS * 0.62, 10, 8]} />
          <meshStandardMaterial
            ref={(node) => {
              tipMaterials.current[FINGER_SPREAD.length] = node
            }}
            color={HINT_COLOR}
            emissive={HINT_COLOR}
            emissiveIntensity={0.5}
            roughness={0.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}
