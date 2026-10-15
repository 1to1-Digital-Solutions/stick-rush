'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Quaternion, RepeatWrapping, Vector3 } from 'three'
import { assetUrl } from '../../lib/assets'
import {
  DIFFICULTY_SPEEDS,
  GROUND_Y,
  MACHINE_FRAME_COLOR,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
  STICK_COLOR,
  WOOD_TEXTURES,
  machinePoint,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { hoopFallSpeed } from '../../lib/hoopHeight'
import { buildStickLayout } from '../../lib/stickLayout'
import { stickCoversMenu } from '../../lib/xrLayout'
import {
  BulbGlass,
  BulbSocket,
  FrameTube,
  MachinePieces,
  MatteTube,
  TrussTube,
  type MachinePieceCounts,
} from './MachinePieces'
import { Stick } from './Stick'
import { useReducedMotion } from './useReducedMotion'

type Point = [number, number, number]

const UP = new Vector3(0, 1, 0)

/**
 * Straight bar between any two points. It is the part the whole structure is
 * built with: the rings (in segments), the uprights, the diagonals of
 * the truss and the braces of the posts.
 */
function Strut({
  from,
  to,
  radius,
  color,
  Piece = TrussTube,
}: {
  from: Point
  to: Point
  radius: number
  color: string
  /** Family of instances, which is what decides the material. By default, the truss. */
  Piece?: typeof TrussTube
}) {
  const { position, quaternion, scale } = useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const direction = b.clone().sub(a)
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      // The cylinder is born vertical; it is turned until it points from `from` to `to`.
      quaternion: new Quaternion().setFromUnitVectors(
        UP,
        direction.clone().normalize(),
      ),
      // The instanced geometry is unit-sized (1 m tall, 1 in diameter), so the scale
      // is directly the measurements of the tube. The thickness goes in X and Z, the length in Y.
      scale: new Vector3(radius * 2, direction.length(), radius * 2),
    }
  }, [from, to, radius])

  return (
    <Piece position={position} quaternion={quaternion} scale={scale} color={color} />
  )
}

/** Segments of the main hoop, in alternating stripes like the awning of a fair stall. */
const ARC_SEGMENTS = 24
/** Vertical uprights that join the main hoop to the upper ring. */
const TRUSS_POSTS = 9
const TUBE_RADIUS = 0.032
/**
 * Gap between the hoop of the sticks and the upper ring of the truss.
 *
 * It is the only thing that grows when the machine «looks low»: the hoop of the sticks cannot be
 * raised —the height of whoever plays decides it, because what has to be caught hangs from it— but
 * the truss above it can, and that is what gives it its bearing. Reported with the headset on: «make
 * the machine a tiny bit taller».
 */
const TRUSS_RISE = 0.34

/** Raises a point of the hoop by a given height. */
function raise([x, y, z]: Point, dy: number): Point {
  return [x, y + dy, z]
}

/**
 * The machine: a horizontal semicircular hoop the sticks hang from, mounted
 * on a truss and held up by two braced posts. The player stands
 * in the centre.
 *
 * The structure is deliberately redundant —double ring, uprights, zigzag
 * diagonals and stays on the posts— because with a single tube the machine looked
 * as if it were about to come down. It is the same logic as a real truss beam:
 * what gives the feeling of stiffness is the diagonals.
 */
export function StickMachine() {
  // What hangs is what the mode says: the sticks and the speed of the level in
  // Levels, and a new round per seed in the endless run.
  const {
    activeStickCount: stickCount,
    activeDifficulty: difficulty,
    stickSeed,
    gameState,
    prompt,
    hoopHeight,
    catchStick,
    missStick,
  } = useGame()
  // Corrected for the height of the hoop: fitting it to the player cannot change
  // how long the fall lasts (see `hoopHeight.ts`).
  const speed = hoopFallSpeed(DIFFICULTY_SPEEDS[difficulty], hoopHeight)
  // Outside the run the sticks stay hanging, in sight, while the
  // player chooses options. Swaying: it is the only thing that moves until the
  // first one falls, and without it the machine looks frozen.
  // Also with the exit question on screen: a stick that kept falling would be lost
  // while deciding, and that is a point that thinking it over costs.
  const paused = gameState !== 'playing' || prompt !== null
  const reducedMotion = useReducedMotion()
  // In the headset's menu the column sits behind the sticks on that side: they are dimmed while
  // choosing (`stickCoversMenu`). Without a headset the menu goes on the web or in front, and nothing is touched.
  const inHeadsetMenu = useXR((state) => state.mode) != null && gameState === 'menu'

  // With the mouse still, what is underneath is looked at again on every frame.
  //
  // R3F only casts its ray when a pointer event arrives, and here what moves is the
  // sticks: they sway a few pixels while hanging and then fall. With the mouse stopped next to the edge of one
  // —nobody moves it during the countdown—, whether the stick was underneath or not depended on
  // which point of the swing the last movement caught it at, and if it was not, the cursor no longer lit up
  // even if the stick passed underneath again. `events.update()` repeats the last pointer
  // event against the scene as it is now, and from there come the usual `pointerover` and `pointerout`.
  //
  // Only from the countdown to the end (in the menu and when it is over there is nothing to catch) and
  // only on screen: with the headset you catch with the hand, and there is no mouse to go over there.
  const events = useThree((state) => state.events)
  const gl = useThree((state) => state.gl)
  useFrame(() => {
    if (gameState !== 'countdown' && gameState !== 'playing') return
    if (gl.xr.isPresenting) return
    events.update?.()
  })

  const [normalMap, roughnessMap] = useTexture([
    assetUrl(WOOD_TEXTURES.normalMap),
    assetUrl(WOOD_TEXTURES.roughnessMap),
  ])

  // The grain runs along the stick, which is much longer than it is wide. It is
  // set in the parent's render so that the materials of the sticks, which are
  // created afterwards, are already born with the texture configured.
  useMemo(() => {
    for (const texture of [normalMap, roughnessMap]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(1, 3)
    }
  }, [normalMap, roughnessMap])

  // Segments of the two rings. The lower one carries the stripes and the sticks; the
  // upper one closes the truss.
  const arcs = useMemo(() => {
    const lower: { key: number; from: Point; to: Point; color: string }[] = []
    const upper: { key: number; from: Point; to: Point }[] = []
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const from = machinePoint(i / ARC_SEGMENTS, hoopHeight)
      const to = machinePoint((i + 1) / ARC_SEGMENTS, hoopHeight)
      lower.push({
        key: i,
        from,
        to,
        color: MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length],
      })
      upper.push({ key: i, from: raise(from, TRUSS_RISE), to: raise(to, TRUSS_RISE) })
    }
    return { lower, upper }
  }, [hoopHeight])

  // Truss: vertical uprights and zigzag diagonals between them.
  const truss = useMemo(() => {
    const posts: { key: number; from: Point; to: Point }[] = []
    const braces: { key: number; from: Point; to: Point }[] = []
    for (let i = 0; i < TRUSS_POSTS; i++) {
      const base = machinePoint(i / (TRUSS_POSTS - 1), hoopHeight)
      posts.push({ key: i, from: base, to: raise(base, TRUSS_RISE) })
      if (i < TRUSS_POSTS - 1) {
        const next = machinePoint((i + 1) / (TRUSS_POSTS - 1), hoopHeight)
        // Alternates the direction of the diagonal to form the zigzag.
        braces.push(
          i % 2 === 0
            ? { key: i, from: base, to: raise(next, TRUSS_RISE) }
            : { key: i, from: raise(base, TRUSS_RISE), to: next },
        )
      }
    }
    return { posts, braces }
  }, [hoopHeight])

  // Bulbs on the upper ring, each with its socket.
  const bulbs = useMemo(
    () =>
      Array.from({ length: TRUSS_POSTS - 1 }, (_, index) => {
        const point = machinePoint((index + 0.5) / (TRUSS_POSTS - 1), hoopHeight)
        return {
          key: index,
          socket: raise(point, TRUSS_RISE + 0.03),
          bulb: raise(point, TRUSS_RISE + 0.085),
        }
      }),
    [hoopHeight],
  )

  // Anchors and staggered delays. They are recomputed on every round (its seed),
  // when the number of sticks changes and when the hoop changes height —which
  // only happens in the menu, with the sticks hanging still.
  const sticks = useMemo(
    () => buildStickLayout(stickCount, stickSeed, hoopHeight),
    [stickCount, stickSeed, hoopHeight],
  )

  // Posts at the ends, braced outwards like those of a stage.
  //
  // The foot opens outwards and backwards instead of dropping plumb: with the hoop
  // within arm's reach, vertical posts would end up stuck to the
  // player's shoulders and would block their way.
  const legs = useMemo(() => {
    return [0, 1].map((side) => {
      const top = raise(machinePoint(side, hoopHeight), TRUSS_RISE)
      const [x, , z] = top
      const foot: Point = [x * 1.9, GROUND_Y, z + 0.45]
      const braceFoot: Point = [x * 2.3, GROUND_Y, z + 1.05]
      return {
        key: side,
        top,
        foot,
        braceTop: raise(machinePoint(side, hoopHeight), TRUSS_RISE * 0.35),
        braceFoot,
      }
    })
  }, [hoopHeight])

  // The EXACT count of what is going to hang from each family. It comes from what is painted —and not
  // from a number written by hand— because it depends on the height of the hoop: falling short makes
  // drei stop painting the surplus ones without saying anything, and the machine would come out in bits.
  const limits = useMemo<MachinePieceCounts>(
    () => ({
      matte: arcs.lower.length,
      frame: legs.length,
      truss: arcs.upper.length + truss.posts.length + truss.braces.length + legs.length,
      bulbs: bulbs.length,
    }),
    [arcs, truss, legs, bulbs],
  )

  return (
    <MachinePieces limits={limits}>
      {/* Hoop of the sticks, striped */}
      {arcs.lower.map((segment) => (
        <Strut
          key={`low-${segment.key}`}
          from={segment.from}
          to={segment.to}
          radius={TUBE_RADIUS}
          color={segment.color}
          Piece={MatteTube}
        />
      ))}

      {/* Upper ring and truss */}
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

      {/* Bulbs */}
      {bulbs.map((bulb) => (
        <group key={`bulb-${bulb.key}`}>
          <BulbSocket position={bulb.socket} />
          <BulbGlass position={bulb.bulb} />
        </group>
      ))}

      {/* Hooks: each stick hangs from a ring fastened to the hoop. */}
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

      {/* Posts with base and stay */}
      {legs.map((leg) => (
        <group key={`leg-${leg.key}`}>
          <Strut
            from={leg.foot}
            to={leg.top}
            radius={0.042}
            color={MACHINE_FRAME_COLOR}
            Piece={FrameTube}
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
          probeId={stick.key}
          anchor={stick.anchor}
          color={STICK_COLOR}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          speed={speed}
          delay={stick.delay}
          swingPhase={stick.swingPhase}
          swaying={!reducedMotion}
          paused={paused}
          dimmed={inHeadsetMenu && stickCoversMenu(stick.anchor)}
          onCatch={catchStick}
          onMiss={missStick}
        />
      ))}
    </MachinePieces>
  )
}
