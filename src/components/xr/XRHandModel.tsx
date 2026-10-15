'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshStandardMaterial } from 'three'

import { HINT_COLOR } from './XRControllerModel'

/**
 * The bare hand drawn with its own geometry, closing on the stick.
 *
 * It exists for the same reason as `XRControllerModel`, but the other way round. The tutorial
 * showed **a controller** with its side trigger marked, and whoever enters the headset
 * with their hands —with no controllers to hand, or unable to hold them— saw an object they
 * do not have and a button they cannot squeeze. With the hands the gesture is another: the
 * hand is taken to the stick and closed, with no button at all.
 *
 * It does not try to be a portrait of a hand: it is enough that it reads as one and
 * that **it is seen closing**, which is the whole instruction. The tips of the fingers
 * carry the amber mark —the same language as the controller's trigger and as the
 * sticks— and turn green on closing, which also confirms that the headset is
 * reading the gesture.
 */

/** Tone of the hand, with some emission so it does not get lost in the night. */
const SKIN_COLOR = '#c08b6a'
/** Confirmation green when the hand is closed. */
const CLOSED_COLOR = '#22c55e'

/** Cycles per second of the mark's pulse, the same as the controller's. */
const HINT_PULSE_HZ = 1.6

/** How far the fingers bend on closing, in radians. */
const FULL_CURL = 1.5

/** Speed at which the hand closes and opens, in fraction per second. */
const CURL_SPEED = 7

/** Where each finger starts across the width of the palm, in fractions of its width. */
const FINGER_SPREAD = [-0.33, -0.11, 0.11, 0.33]

/** Measurements of the hand, in metres. The size of the controller it replaces. */
const PALM_WIDTH = 0.05
const PALM_HEIGHT = 0.05
const PALM_DEPTH = 0.02
const FINGER_LENGTH = 0.038
const FINGER_THICKNESS = 0.009

/**
 * The hand, with the fingers closing.
 *
 * @param side      −1 or 1 depending on the hand, so the thumb comes out on the side
 *   it belongs on: it is the only thing that tells one hand from the other at a glance.
 * @param highlight whether the fingertips are marked in amber or dimmed like the rest.
 * @param pulsing   whether that mark pulses. In a still miniature —the menu's
 *   button— the pulse distracts and the mark stays fixed.
 * @param isClosed  it is queried every frame. It is a function and not a value
 *   because whoever closes it —the tutorial's demonstration— runs by reference,
 *   without going through React.
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

    // The hand does not jump between open and closed: it closes. It is the movement that
    // turns the drawing into an instruction, just as in the rest of the
    // demonstration.
    const target = closed ? 1 : 0
    curl.current += (target - curl.current) * Math.min(1, delta * CURL_SPEED)

    for (const finger of fingersRef.current) {
      if (finger != null) finger.rotation.x = curl.current * FULL_CURL
    }
    // The thumb closes less and inwards: it is what makes the hand
    // look like it is grabbing and not just bending.
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
      {/* The palm, edge on: the back faces the player and the fingers close
          towards them, which is how one's own hand looks when picking something up. */}
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
          {/* The fingertip: it is the one that carries the mark, because it is the one that touches the stick. */}
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

      {/* The thumb, on the side that belongs to this hand. */}
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
