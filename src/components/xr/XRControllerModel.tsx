'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'

/**
 * The controller drawn with its own geometry, and the mark of which button grabs.
 *
 * **Why not the library's model.** @react-three/xr downloads the real
 * model of each controller from `cdn.jsdelivr.net`, and this game has to work
 * on a headset with no way out to the internet —besides, the CSP blocks it—. It had been
 * solved with `model: false`, but that left the hands **invisible**: with no
 * controller and nothing in front that the ray could touch, the player had no way
 * of knowing where they were pointing. So it is drawn here, with four primitives
 * and zero downloads.
 *
 * It does not try to be a portrait of the controller: it is enough that there is a solid object
 * where the hand is and that the side trigger stands out.
 *
 * It lives apart from `XRController` because it is not used by the real hand alone: the
 * tutorial shows this same controller and this same trigger (see `XRTutorial`), and
 * the button that brings the tutorial back from the menu carries it in miniature. Showing
 * a drawing different from the one later held in the hand would be teaching something else.
 */

/** Grey of the body, with some emission so it does not get lost in the night. */
const BODY_COLOR = '#2b3442'
/** Amber of the mark: the same visual language as the sticks. */
export const HINT_COLOR = '#fbbf24'
/** Confirmation green when the trigger is squeezed. */
const PRESSED_COLOR = '#22c55e'

/** Cycles per second of the mark's pulse. */
const HINT_PULSE_HZ = 1.6

/**
 * Body of the controller, along the Y axis of the `grip-space`: according to the WebXR
 * spec that axis comes out of the top of the fist, so the handle falls towards −Y and the
 * head (where the thumb is) ends up on top.
 */
export function ControllerBody() {
  return (
    <group>
      {/* Handle: slightly tilted towards the wrist, like the real one. */}
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

      {/* Head: the disc where the thumbstick and the buttons live. */}
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

      {/* Index trigger, on the front face. It is not used to grab:
          it is there so the controller reads as a controller and the player locates the
          side one by contrast. */}
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
 * The side trigger —the one that closes the hand— and its mark.
 *
 * It pulses in amber while there is something to teach, and it turns green and still as
 * soon as the player squeezes it: besides pointing out the button, it confirms that the
 * headset is reading the press.
 *
 * @param side      −1 or 1 depending on the hand, so the button comes out on the side
 *   it belongs on (the one the fingers squeeze, towards the inside).
 * @param highlight whether the trigger is marked in amber or dimmed like the rest.
 * @param pulsing   whether that mark pulses and emits the wave. In a still miniature
 *   —the menu's button— the pulse distracts and the mark stays fixed.
 * @param isPressed it is queried every frame. It is a function and not a value
 *   because the gamepad's state changes without React rendering again.
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

    // Squeezed: fixed green, no pulse. It is the confirmation that it is working.
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
        // The ring grows and fades, like a wave coming out of the button.
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

      {/* A wave that points out the button without needing a single letter. */}
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

/** The whole controller: body and grab trigger. */
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
