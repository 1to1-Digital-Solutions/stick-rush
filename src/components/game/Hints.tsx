'use client'

import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef, useState } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'

import {
  HINT_MARK_COLOR,
  THROB,
  moveToward,
  advanceHints,
  throb,
  sweepPhase,
  noHints,
} from '../../lib/hints'
import { useHand } from '../../lib/settingsClient'
import { useGame } from '../../lib/gameStore'
import {
  FALL,
  GHOST,
  HINT_SCRIPT,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BY_THE_STICK,
  ghostFall,
  controllerByTheStick,
  ghostStick,
  aboutToFall,
  type MachineHint,
  type HintFact,
} from '../../lib/hintScript'
import { TUTORIAL_BUTTONS } from '../../lib/tutorial'
import { RealController } from '../xr/RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * The visual hints: what has to be done, shown without a single letter.
 *
 * **Why it exists.** The tutorial explains the game and stays as a safety net, but the
 * first thing someone does on coming in is not to read: it is to look around. If by looking around you cannot
 * see where to stand, that the sticks fall nor what they are caught with, the game starts with a question.
 * Here are the answers, drawn: the footprints in the centre of the hoop, the ghost stick
 * falling from the one in front down to chest height, and beside it the real controller with the
 * grab button throbbing.
 *
 * **And none of them stays on.** Each one turns itself off as soon as the gesture is made once, or when
 * its time runs out, and what floats leaves before the first stick falls; that is decided by
 * `lib/hintScript.ts` on top of the engine of `lib/hints.ts`, both tested without a browser.
 * Here it is only painted.
 *
 * **Everything is mounted at once and never unmounted**, even if it is not seen. Mounting a new mesh
 * mid-run forces three to compile its material, and compiling a shader blocks the
 * thread: with the headset on that is a hitch. Mounted from the start, `PrewarmShaders` compiles it
 * with everything else. What is turned on and off is `visible` and the opacity — and a hint that is
 * off is invisible, so it does not cost a draw call either.
 *
 * **It hangs from the world, next to the machine**, and not from anything that is mounted with the run: its origin
 * is the centre of the hoop, which is what the script is written relative to.
 *
 * **Only inside the headset.** Outside the session you play with the mouse on a screen, and there
 * the web tells it with letters, which are read before starting and without having the hands busy.
 */

/** How transparent each hint gets when fully on. */
const OPACITY = { ground: 0.75, stick: 0.6 } as const

/**
 * What is painted on the ground is separated by biasing the depth on rasterising and not by raising it a
 * millimetre: the millimetre is enough in the browser and is not enough with the headset on.
 */
const DECAL = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
} as const

/** What all the materials of a hint carry: amber, translucent and with no tone mapping. */
const PAINT = {
  color: HINT_MARK_COLOR,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
} as const

/** Has whoever plays asked that things do not move by themselves? */
function wantsNoMotion(): boolean {
  if (typeof window === 'undefined' || window.matchMedia == null) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Hints() {
  const inSession = useXR((state) => state.mode != null)
  const { gameState, countdown, score, hoopHeight } = useGame()
  const hand = useHand()
  const [still] = useState(wantsNoMotion)

  /** Where the controller goes: beside where the ghost stops, on the side of the good hand. */
  const beside = useMemo(() => {
    const { position, turn: yaw } = controllerByTheStick(hoopHeight, hand)
    return { position, rotation: [0, yaw, 0] as const, scale: CONTROLLER_BY_THE_STICK.scale }
  }, [hoopHeight, hand])

  /** The clock of each hint and which ones are shown, without going through React's state. */
  const state = useRef(noHints())
  /**
   * What the script takes for granted. **Once done, it stays done**: going back to the menu does not
   * turn on again what was already learnt. The same object is mutated on every frame instead of building
   * a new one: ninety objects per second are ninety objects to collect.
   */
  const facts = useRef<Record<HintFact, boolean>>({ grab: false, falling: false })
  /** What is seen of each one right now, from 0 to 1. */
  const strength = useRef<Record<MachineHint, number>>({ ground: 0, stick: 0, controller: 0 })

  const footprints = useRef<(Mesh | null)[]>([])
  const stick = useRef<Mesh>(null)
  const controller = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    facts.current.grab ||= score > 0
    facts.current.falling ||= aboutToFall(gameState, countdown)
    const step = advanceHints(HINT_SCRIPT, facts.current, state.current, inSession ? delta : 0)
    const now = clock.elapsedTime
    const pulse = still ? 1 : throb(now, THROB.strength)

    for (const hint of HINT_SCRIPT) {
      const wanted = inSession && step.lit.has(hint.id) ? 1 : 0
      strength.current[hint.id] = moveToward(strength.current[hint.id], wanted, delta)
    }

    // The footprints on the ground, throbbing: it is what sets them apart from one more slab of the square.
    const onGround = strength.current.ground
    for (const piece of footprints.current) {
      if (piece == null) continue
      piece.visible = onGround > 0.004
      ;(piece.material as MeshBasicMaterial).opacity = onGround * OPACITY.ground * pulse
    }

    // The ghost stick, falling from the one in front down to chest height. **It does not throb**: it already
    // moves, and a throb on top of the fall would turn it into a flicker. Still at mid
    // fall if it was asked that nothing moves by itself, which still says where they go.
    const stickStrength = strength.current.stick
    if (stick.current != null) {
      stick.current.visible = stickStrength > 0.004
      const fall = still
        ? { drop: FALL.travel / 2, visible: 1 }
        : ghostFall(sweepPhase(now, FALL.period).progress)
      const [x, y, z] = ghostStick(hoopHeight)
      stick.current.position.set(x, y - fall.drop, z)
      ;(stick.current.material as MeshBasicMaterial).opacity = stickStrength * OPACITY.stick * fall.visible
    }

    // The real controller. It is turned off by hiding the group and not by unmounting it: unmounting it disposes
    // the materials of the model and showing it again would recompile them.
    if (controller.current != null) controller.current.visible = strength.current.controller > 0.004
  })

  return (
    <group name="hints">
      {/* The footprints, on the ground and at the feet of whoever comes in: in the centre of the hoop and
          facing the machine, which is where all the sticks are reached from. */}
      {FOOTPRINTS.map((footprint, index) => (
        <mesh
          key={index}
          name={`hint-footprint-${index}`}
          ref={(piece) => {
            footprints.current[index] = piece
          }}
          visible={false}
          raycast={NO_RAYCAST}
          position={[footprint.x, FOOTPRINTS_Y, footprint.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          // A footprint is an oval: the twelve-sided circle stretched along the foot.
          scale={[FOOTPRINT.width / 2, FOOTPRINT.length / 2, 1]}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial {...PAINT} {...DECAL} />
        </mesh>
      ))}

      {/* The ghost stick: a cylinder a little thicker than the real stick, which wraps it
          where it hangs and falls with it. No ray: what is caught is the real stick. */}
      <mesh ref={stick} name="hint-stick" visible={false} raycast={NO_RAYCAST}>
        <cylinderGeometry args={[GHOST.radius, GHOST.radius, GHOST.length, 12]} />
        <meshBasicMaterial {...PAINT} />
      </mesh>

      {/* The real controller with the grab button throbbing, **beside where the ghost
          stops** and not on the hand: the hand is taken by the tutorial's copy, and two copies of the
          same model in the same place overlap. This way it comes out from the first time. Inside a
          group of its own to turn it off without unmounting it. */}
      <group ref={controller} name="hint-controller" visible={false}>
        <RealController hand={hand} button={TUTORIAL_BUTTONS.grab} beside={beside} />
      </group>
    </group>
  )
}
