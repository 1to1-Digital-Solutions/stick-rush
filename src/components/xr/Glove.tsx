'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type InstancedMesh } from 'three'

import {
  CLOSED,
  approachPose,
  fingerAngles,
  glovePose,
  type Reading,
  type Pose,
} from '../../lib/glove'
import { DECOR_POINTER_EVENTS } from '../../lib/pointers'
import { HINT_COLOR } from './XRControllerModel'

/**
 * The player's hand, drawn as a glove that grips the controller and closes its fist.
 *
 * What decides how far each finger closes is in `lib/glove.ts`; here it is only drawn.
 *
 * **No files and a single draw call.** The glove is boxes —palm, cuff and three phalanges
 * per finger—, all of them instances of the same `InstancedMesh`: sixteen parts that the
 * headset paints at once per eye. With separate meshes it would be sixteen calls per hand and
 * per eye, and on the Quest that shows (`.claude/rules/xr.md`, «Lo que cuestan se mide»). The
 * skeleton is `Object3D`s that are not drawn: every frame its joints are bent and where each
 * part ends up is copied to its instance.
 *
 * **Placed on the drawn controller** (`XRControllerModel`), in the same `grip-space`: the
 * handle goes down along −Y with a slight tilt, the front trigger faces −Z and the side one
 * is on the inner side (`side`). The palm goes on the outside, the fingers wrap the handle
 * from the front and end on the side trigger, which is the one they close; the thumb rests on
 * top, over the head of the controller.
 *
 * **The grip hint is in the hand.** While the gesture has to be taught (`highlight`), the
 * tips of the three fingers that squeeze the side trigger pulse in amber —the same amber as
 * the button and as the sticks—; when the fist closes they turn green, which confirms that
 * the headset is reading the trigger.
 *
 * To take it to another game it is enough to reposition `PALM`, `KNUCKLES` and `THUMB` on its controller.
 */

/** Cartoon-glove white: it reads as a hand without looking like anybody's skin. */
const GLOVE = new Color('#e9eef5')
const AMBER = new Color(HINT_COLOR)
const GREEN = new Color('#22c55e')

/** Cycles per second of the fingertips' pulse, the same as the controller button's. */
const PULSE_HZ = 1.6

/** Thickness and width of a finger, in metres. */
const FINGER = { thickness: 0.015, width: 0.017 }

/**
 * The four fingers: at what height of the handle each one starts and what its three phalanges
 * measure. The index on top, over the front trigger; the little finger at the bottom and shorter.
 */
const FINGERS = [
  { y: -0.012, phalanges: [0.022, 0.017, 0.015], index: true },
  { y: -0.032, phalanges: [0.024, 0.018, 0.015], index: false },
  { y: -0.052, phalanges: [0.022, 0.017, 0.014], index: false },
  { y: -0.071, phalanges: [0.018, 0.014, 0.012], index: false },
] as const

/** Where the fingers start: outside the handle and a little in front of its axis. */
const KNUCKLES = { x: 0.028, z: -0.012 }

/** The palm: a plate outside the handle, as tall as the fingers. */
const PALM = { x: 0.036, y: -0.042, z: 0.008, size: [0.018, 0.084, 0.056] as const }

/** The cuff of the glove, towards the wrist, which in the `grip-space` is at +Z. */
const CUFF = { x: 0.03, y: -0.046, z: 0.052, size: [0.036, 0.07, 0.03] as const }

/** The thumb: it starts at the top of the palm and crosses over the head of the controller. */
const THUMB = { x: 0.028, y: 0.012, z: -0.002, phalanges: [0.024, 0.02] as const }

/** How far the thumb bends with the fist closed, per joint. */
const THUMB_BEND = [0.5, 0.7] as const

/** The tilt of the drawn controller's handle: the fingers follow it. */
const HANDLE_TILT = 0.22

type Skeleton = {
  root: Object3D
  /** The joints of each finger, from the knuckle to the tip. */
  fingers: Object3D[][]
  thumb: Object3D[]
  /** What is drawn: each one is an instance. */
  parts: Object3D[]
  /** Which instances are fingertips that carry the hint. */
  fingertips: Set<number>
}

/** A box of those measurements hanging from `parent`, which starts at its origin and grows towards −Z. */
function phalanx(parent: Object3D, length: number, parts: Object3D[]): Object3D {
  const part = new Object3D()
  part.position.z = -length / 2
  part.scale.set(FINGER.width, FINGER.thickness, length)
  parent.add(part)
  parts.push(part)
  const next = new Object3D()
  next.position.z = -length
  parent.add(next)
  return next
}

/**
 * Builds the skeleton of the hand of one side.
 *
 * @param outer −1 or 1: which way the outer side of the handle is, the palm's. It is the
 *   opposite of the side trigger.
 */
function buildSkeleton(outer: number): Skeleton {
  const root = new Object3D()
  const parts: Object3D[] = []
  const fingertips = new Set<number>()

  const box = (x: number, y: number, z: number, size: readonly [number, number, number]) => {
    const part = new Object3D()
    part.position.set(x, y, z)
    part.rotation.x = HANDLE_TILT
    part.scale.set(...size)
    root.add(part)
    parts.push(part)
  }
  box(outer * PALM.x, PALM.y, PALM.z, PALM.size)
  box(outer * CUFF.x, CUFF.y, CUFF.z, CUFF.size)

  const fingers = FINGERS.map(({ y, phalanges, index }) => {
    const knuckle = new Object3D()
    // The handle tilts forward as it goes down, and the knuckles with it.
    knuckle.position.set(outer * KNUCKLES.x, y, KNUCKLES.z + (y + 0.045) * HANDLE_TILT)
    root.add(knuckle)
    const joints = [knuckle]
    let current = knuckle
    phalanges.forEach((length, i) => {
      const next = phalanx(current, length, parts)
      if (i === phalanges.length - 1 && !index) fingertips.add(parts.length - 1)
      if (i < phalanges.length - 1) joints.push(next)
      current = next
    })
    return joints
  })

  const base = new Object3D()
  base.position.set(outer * THUMB.x, THUMB.y, THUMB.z)
  // It points inwards, over the head of the controller. In YXZ order the bend (X) is
  // applied on the thumb's own axis and not on the hand's.
  base.rotation.order = 'YXZ'
  base.rotation.y = outer * (Math.PI / 2)
  root.add(base)
  const thumb = [base]
  const tip = phalanx(base, THUMB.phalanges[0], parts)
  thumb.push(tip)
  phalanx(tip, THUMB.phalanges[1], parts)

  return { root, fingers, thumb, parts, fingertips }
}

/**
 * The glove.
 *
 * @param side      −1 or 1 depending on the hand, as in `ControllerModel`: the side of the
 *   side trigger. The palm goes on the opposite one.
 * @param highlight whether the fingertips carry the grip hint.
 * @param read      what is being squeezed right now. It is queried every frame because the
 *   controller changes without React rendering again.
 */
export function Glove({
  side,
  highlight,
  read,
}: {
  side: number
  highlight: boolean
  read: () => Reading
}) {
  const meshRef = useRef<InstancedMesh>(null)
  const outer = -side
  const skeleton = useMemo(() => buildSkeleton(outer), [outer])
  const pose = useRef<Pose>(glovePose({ grip: 0, trigger: 0 }))
  const time = useRef(0)
  const color = useMemo(() => new Color(), [])

  // The starting colours, before the first frame: without them the mesh is born without
  // `instanceColor` and the material is compiled without it.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (mesh == null) return
    for (let i = 0; i < skeleton.parts.length; i++) mesh.setColorAt(i, GLOVE)
  }, [skeleton])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (mesh == null) return
    time.current += delta
    pose.current = approachPose(pose.current, glovePose(read()), delta)
    const { fingers, index, thumb } = pose.current

    // The fingers bend around the handle, which is vertical: they turn about Y, from −Z
    // (the front) towards the side of the side trigger, which is the opposite of `outer`.
    skeleton.fingers.forEach((joints, f) => {
      const angles = fingerAngles(FINGERS[f].index ? index : fingers)
      joints.forEach((joint, i) => {
        joint.rotation.y = outer * angles[i]
      })
    })
    // And the thumb comes down over the head of the controller: it turns about its own X (see `buildSkeleton`).
    skeleton.thumb.forEach((joint, i) => {
      joint.rotation.x = -THUMB_BEND[i] * thumb
    })

    skeleton.root.updateMatrixWorld(true)
    skeleton.parts.forEach((part, i) => mesh.setMatrixAt(i, part.matrixWorld))
    mesh.instanceMatrix.needsUpdate = true

    const closed = fingers >= CLOSED
    const pulse = 0.5 + 0.5 * Math.sin(time.current * Math.PI * 2 * PULSE_HZ)
    if (closed) color.copy(GREEN)
    else if (highlight) color.copy(GLOVE).lerp(AMBER, 0.35 + 0.65 * pulse)
    else color.copy(GLOVE)
    for (const fingertip of skeleton.fingertips) mesh.setColorAt(fingertip, color)
    if (mesh.instanceColor != null) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, skeleton.parts.length]}
      // It moves every frame and its bounding sphere would be computed once: without this,
      // three would take it to be out of view with the hand somewhere else.
      frustumCulled={false}
      // The hand is not a target: the ray and the grab go through it.
      pointerEvents={DECOR_POINTER_EVENTS}
    >
      <boxGeometry />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#9aa6b6"
        emissiveIntensity={0.25}
        roughness={0.85}
        flatShading
      />
    </instancedMesh>
  )
}
