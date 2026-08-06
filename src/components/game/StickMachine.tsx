'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { Quaternion, RepeatWrapping, Vector3 } from 'three'
import {
  DIFFICULTY_SPEEDS,
  GROUND_Y,
  MACHINE_BULB_COLOR,
  MACHINE_FRAME_COLOR,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
  STICK_COLOR,
  WOOD_TEXTURES,
  machinePoint,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { buildStickLayout } from '@/lib/stickLayout'
import { Stick } from './Stick'

type Point = [number, number, number]

const UP = new Vector3(0, 1, 0)

/**
 * Barra recta entre dos puntos cualesquiera. Es la pieza con la que se monta
 * toda la estructura: los aros (por tramos), los montantes, las diagonales de
 * la celosía y las riostras de los postes.
 */
function Strut({
  from,
  to,
  radius,
  color,
  metalness = 0.6,
  roughness = 0.4,
}: {
  from: Point
  to: Point
  radius: number
  color: string
  metalness?: number
  roughness?: number
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const direction = b.clone().sub(a)
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      // El cilindro nace vertical; se gira hasta apuntar de `from` a `to`.
      quaternion: new Quaternion().setFromUnitVectors(
        UP,
        direction.clone().normalize(),
      ),
      length: direction.length(),
    }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  )
}

/** Tramos del aro principal, a rayas alternas como el toldo de una caseta. */
const ARC_SEGMENTS = 24
/** Montantes verticales que unen el aro principal con el superior. */
const TRUSS_POSTS = 9
const TUBE_RADIUS = 0.032
/** Separación entre el aro de los palos y el aro superior de la celosía. */
const TRUSS_RISE = 0.24

/** Sube un punto del aro una altura dada. */
function raise([x, y, z]: Point, dy: number): Point {
  return [x, y + dy, z]
}

/**
 * La máquina: un aro semicircular horizontal del que cuelgan los palos, montado
 * sobre una celosía y sostenido por dos postes arriostrados. El jugador se pone
 * en el centro.
 *
 * La estructura es deliberadamente redundante —doble aro, montantes, diagonales
 * en zigzag y tirantes en los postes— porque con un solo tubo la máquina parecía
 * que se fuera a venir abajo. Es la misma lógica que una viga de celosía real:
 * lo que da sensación de rigidez son las diagonales.
 */
export function StickMachine() {
  const { stickCount, difficulty, runId, gameState, catchStick, missStick } =
    useGame()
  const speed = DIFFICULTY_SPEEDS[difficulty]
  // Fuera de la partida los palos se quedan colgando, a la vista, mientras el
  // jugador elige opciones.
  const paused = gameState !== 'playing'

  const [normalMap, roughnessMap] = useTexture([
    WOOD_TEXTURES.normalMap,
    WOOD_TEXTURES.roughnessMap,
  ])

  // El grano corre a lo largo del palo, que es mucho más largo que ancho. Se
  // ajusta en el render del padre para que los materiales de los palos, que se
  // crean después, ya nazcan con la textura configurada.
  useMemo(() => {
    for (const texture of [normalMap, roughnessMap]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(1, 3)
    }
  }, [normalMap, roughnessMap])

  // Tramos de los dos aros. El de abajo lleva las rayas y los palos; el de
  // arriba cierra la celosía.
  const arcs = useMemo(() => {
    const lower: { key: number; from: Point; to: Point; color: string }[] = []
    const upper: { key: number; from: Point; to: Point }[] = []
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const from = machinePoint(i / ARC_SEGMENTS)
      const to = machinePoint((i + 1) / ARC_SEGMENTS)
      lower.push({
        key: i,
        from,
        to,
        color: MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length],
      })
      upper.push({ key: i, from: raise(from, TRUSS_RISE), to: raise(to, TRUSS_RISE) })
    }
    return { lower, upper }
  }, [])

  // Celosía: montantes verticales y diagonales en zigzag entre ellos.
  const truss = useMemo(() => {
    const posts: { key: number; from: Point; to: Point }[] = []
    const braces: { key: number; from: Point; to: Point }[] = []
    for (let i = 0; i < TRUSS_POSTS; i++) {
      const base = machinePoint(i / (TRUSS_POSTS - 1))
      posts.push({ key: i, from: base, to: raise(base, TRUSS_RISE) })
      if (i < TRUSS_POSTS - 1) {
        const next = machinePoint((i + 1) / (TRUSS_POSTS - 1))
        // Alterna el sentido de la diagonal para formar el zigzag.
        braces.push(
          i % 2 === 0
            ? { key: i, from: base, to: raise(next, TRUSS_RISE) }
            : { key: i, from: raise(base, TRUSS_RISE), to: next },
        )
      }
    }
    return { posts, braces }
  }, [])

  // Bombillas sobre el aro superior, cada una con su casquillo.
  const bulbs = useMemo(
    () =>
      Array.from({ length: TRUSS_POSTS - 1 }, (_, index) => {
        const point = machinePoint((index + 0.5) / (TRUSS_POSTS - 1))
        return {
          key: index,
          socket: raise(point, TRUSS_RISE + 0.03),
          bulb: raise(point, TRUSS_RISE + 0.085),
        }
      }),
    [],
  )

  // Anclajes y retardos escalonados. Se recalculan en cada partida (runId)
  // y cuando cambia el número de palos.
  const sticks = useMemo(
    () => buildStickLayout(stickCount, runId),
    [stickCount, runId],
  )

  // Postes de los extremos, arriostrados hacia fuera como los de un escenario.
  //
  // El pie se abre hacia fuera y hacia atrás en vez de caer a plomo: con el aro
  // al alcance del brazo, unos postes verticales quedarían pegados a los
  // hombros del jugador y le cerrarían el paso.
  const legs = useMemo(() => {
    return [0, 1].map((side) => {
      const top = raise(machinePoint(side), TRUSS_RISE)
      const [x, , z] = top
      const foot: Point = [x * 1.9, GROUND_Y, z + 0.45]
      const braceFoot: Point = [x * 2.3, GROUND_Y, z + 1.05]
      return {
        key: side,
        top,
        foot,
        braceTop: raise(machinePoint(side), TRUSS_RISE * 0.35),
        braceFoot,
      }
    })
  }, [])

  return (
    <group>
      {/* Aro de los palos, a rayas */}
      {arcs.lower.map((segment) => (
        <Strut
          key={`low-${segment.key}`}
          from={segment.from}
          to={segment.to}
          radius={TUBE_RADIUS}
          color={segment.color}
          metalness={0.1}
          roughness={0.55}
        />
      ))}

      {/* Aro superior y celosía */}
      {arcs.upper.map((segment) => (
        <Strut
          key={`up-${segment.key}`}
          from={segment.from}
          to={segment.to}
          radius={0.02}
          color={MACHINE_TRUSS_COLOR}
        />
      ))}
      {truss.posts.map((post) => (
        <Strut
          key={`post-${post.key}`}
          from={post.from}
          to={post.to}
          radius={0.013}
          color={MACHINE_TRUSS_COLOR}
        />
      ))}
      {truss.braces.map((brace) => (
        <Strut
          key={`brace-${brace.key}`}
          from={brace.from}
          to={brace.to}
          radius={0.013}
          color={MACHINE_TRUSS_COLOR}
        />
      ))}

      {/* Bombillas */}
      {bulbs.map((bulb) => (
        <group key={`bulb-${bulb.key}`}>
          <mesh position={bulb.socket}>
            <cylinderGeometry args={[0.012, 0.015, 0.038, 8]} />
            <meshStandardMaterial color="#3b3630" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={bulb.bulb}>
            <sphereGeometry args={[0.024, 14, 14]} />
            <meshStandardMaterial
              color={MACHINE_BULB_COLOR}
              emissive={MACHINE_BULB_COLOR}
              emissiveIntensity={1.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Ganchos: cada palo cuelga de una anilla sujeta al aro. */}
      {sticks.map((stick) => (
        <mesh
          key={`hook-${stick.key}`}
          position={[
            stick.anchor[0],
            stick.anchor[1] - TUBE_RADIUS - 0.012,
            stick.anchor[2],
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.022, 0.006, 8, 16]} />
          <meshStandardMaterial
            color={MACHINE_FRAME_COLOR}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Postes con base y tirante */}
      {legs.map((leg) => (
        <group key={`leg-${leg.key}`}>
          <Strut
            from={leg.foot}
            to={leg.top}
            radius={0.042}
            color={MACHINE_FRAME_COLOR}
            metalness={0.7}
            roughness={0.35}
          />
          <Strut
            from={leg.braceFoot}
            to={leg.braceTop}
            radius={0.019}
            color={MACHINE_TRUSS_COLOR}
          />
          <mesh position={[leg.foot[0], GROUND_Y + 0.025, leg.foot[2]]}>
            <cylinderGeometry args={[0.13, 0.16, 0.04, 20]} />
            <meshStandardMaterial
              color={MACHINE_FRAME_COLOR}
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[leg.braceFoot[0], GROUND_Y + 0.02, leg.braceFoot[2]]}>
            <cylinderGeometry args={[0.075, 0.095, 0.032, 16]} />
            <meshStandardMaterial
              color={MACHINE_TRUSS_COLOR}
              metalness={0.6}
              roughness={0.45}
            />
          </mesh>
        </group>
      ))}

      {sticks.map((stick) => (
        <Stick
          key={stick.key}
          anchor={stick.anchor}
          color={STICK_COLOR}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          speed={speed}
          delay={stick.delay}
          paused={paused}
          onCatch={catchStick}
          onMiss={missStick}
        />
      ))}
    </group>
  )
}
