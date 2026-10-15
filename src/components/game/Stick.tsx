'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  STICK_CAUGHT_COLOR,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  STICK_MISSED_COLOR,
  STICK_RADIUS,
  fallAcceleration,
  fallDrop,
  stickFallProgress,
} from '../../lib/gameConfig'
import { pulseCatch } from '../../lib/haptics'
import { isBehindBack } from '../../lib/feats'
import { publishStick, stickProbeRequested } from '../../lib/sceneProbe'
import { stickPointerEvents } from '../../lib/pointers'
import { STICK_BEHIND_MENU, opacityToward } from '../../lib/xrLayout'
import { SWING_RELEASE_DECAY, hangingSwing } from '../../lib/stickSwing'
import {
  type StickState,
  canCatchStick,
  canCatchWithPointer,
} from '../../lib/xrInteraction'

/**
 * Where the stick lands in the world, to publish it. It is reused across sticks and
 * frames: a new one per stick and frame would be ninety vectors per second
 * thrown away.
 */
const stickPoint = new Vector3()

/** Where the eyes are and where they look when a stick is caught, for its feat (`feats.ts`). */
const eyes = new Vector3()
const gaze = new Vector3()
const caughtStick = new Vector3()

/**
 * Type of pointer that fired the event, if it carries one. Mouse events
 * do not carry it; those of @pmndrs/pointer-events (the XR ones) do.
 */
function pointerTypeOf(event: unknown): string | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerType } = event as { pointerType?: unknown }
  return typeof pointerType === 'string' ? pointerType : undefined
}

export interface StickProps {
  /**
   * Key of the stick within the run, to publish where it is to whoever
   * asked for it from outside the Canvas (see `@/lib/sceneProbe`).
   */
  probeId: string
  /** Anchor point on the hoop the stick hangs from. */
  anchor: [number, number, number]
  color: string
  /**
   * Relief and roughness of the wood. StickMachine loads and shares them: the
   * material is indeed each stick's own (the flash when it is caught changes its
   * emission), but the textures, which is the expensive part, are loaded only once.
   */
  normalMap: Texture
  roughnessMap: Texture
  /**
   * Average fall speed in units per second (depending on difficulty). The
   * stick does not go at this speed: it starts from rest and accelerates, and this sets how long
   * it takes to reach the ground (see `fallAcceleration`).
   */
  speed: number
  /** Delay, in seconds, before it starts to fall. */
  delay: number
  /** Its own slot within the cycle of the swing, in [0, 1). */
  swingPhase: number
  /**
   * Whether the stick sways while it hangs. It is turned off when the system asks to reduce
   * motion: the swing is decoration, and whoever disables it prefers the
   * machine still to having it breathe.
   */
  swaying: boolean
  /**
   * With the run stopped (menu or end) the stick stays hanging: its clock does not
   * run. Otherwise, the sticks were released while the player chose options and
   * by the start they were already on the ground.
   */
  paused: boolean
  /**
   * Almost transparent: the headset's menu is behind and is read between the hanging sticks
   * (`stickCoversMenu`). It dims and comes back little by little, never all at once.
   */
  dimmed?: boolean
  /**
   * Caught by the player (click or XR controller). It receives how long the stick had been
   * falling, as a fraction of its fall time: from 0 (just released) to 1 (level
   * with the ground). Catching it early scores more. `behindBack`, whether it was caught with
   * the back to it: with a headset, the camera is the head.
   */
  onCatch: (fallProgress: number, behindBack: boolean) => void
  /** It got away and has touched the ground. */
  onMiss: () => void
}

export function Stick({
  probeId,
  anchor,
  color,
  normalMap,
  roughnessMap,
  speed,
  delay,
  swingPhase,
  swaying,
  paused,
  dimmed = false,
  onCatch,
  onMiss,
}: StickProps) {
  const groupRef = useRef<Group>(null)
  const camera = useThree((three) => three.camera)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const meshRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const ringMaterialRef = useRef<MeshBasicMaterial>(null)
  // How much the missed stick has been tinted red, from 0 to 1.
  const missTint = useRef(0)

  // The colours are created once per stick: instantiating them inside the render
  // loop would generate garbage on each of the headset's 90 frames.
  const { baseColor, caughtColor, missedColor } = useMemo(
    () => ({
      baseColor: new Color(color),
      caughtColor: new Color(STICK_CAUGHT_COLOR),
      missedColor: new Color(STICK_MISSED_COLOR),
    }),
    [color],
  )

  const [state, setState] = useState<StickState>('hanging')
  // Visibility: it is hidden when the catch animation ends.
  const [visible, setVisible] = useState(true)
  // Time accumulated since the start (to handle the staggered delay).
  const elapsed = useRef(0)
  // Seconds it has been falling. The height is computed from here every frame, not
  // by adding steps: that way the stick takes the same time to get down whether the headset runs at
  // 72 or at 120 frames per second.
  const fallTime = useRef(0)
  // Clock of the swing. It is separate from the previous one because it also runs with the
  // run stopped: swaying while the player chooses or counts down is
  // precisely what it is there for.
  const swingTime = useRef(0)
  // How much of the swing is applied, from 1 (hanging) to 0 (released or still). It is born
  // at 0 if the system was already asking to reduce motion: starting at 1 left the
  // stick being born tilted and straightening up for a quarter of a second, which
  // is exactly the motion that preference wants to avoid.
  const swingLevel = useRef(swaying ? 1 : 0)
  // Intensity of the glow when caught, which decays with time.
  const flash = useRef(0)
  // What is seen of the hanging stick: 1 whole, `STICK_BEHIND_MENU` with the headset's menu behind.
  const veil = useRef(1)
  // A stick can only be resolved once. A ref is needed on top of the
  // state because `setState` is not applied until the next render: two
  // catches in the same frame (the two XR controllers pointing at the same stick,
  // or a catch right when it touches the ground) would both see 'falling'.
  const resolved = useRef(false)
  // Whether the pointer is over the stick, to keep the cursor up to date and
  // give it back on unmount.
  const hovering = useRef(false)

  const [anchorX, anchorY, anchorZ] = anchor
  // With the acceleration of its own travel: the hoop fits itself to whoever plays
  // and the fall has to last the same from any height.
  const acceleration = fallAcceleration(speed, anchorY - STICK_MISS_Y)

  // When a stick lets itself be caught: see `canCatchStick`.
  const catchable = canCatchStick(state, paused)

  const releaseCursor = () => {
    if (!hovering.current) return
    hovering.current = false
    document.body.style.cursor = 'auto'
  }

  // The stick disappears when caught and is unmounted when the run ends:
  // if the pointer was on top, `onPointerOut` no longer arrives and the cursor would
  // stay on 'pointer'.
  useEffect(() => releaseCursor, [])

  // What is left to vibrate of the last catch is cancelled when the stick is unmounted: a scheduled
  // pulse that went out afterwards would vibrate for something that is no longer there.
  const cancelPulses = useRef<() => void>(() => {})
  useEffect(() => () => cancelPulses.current(), [])

  // And it stops announcing itself on leaving: a key that stays set tells whoever
  // looks from outside that there is still a stick there, still forever.
  useEffect(() => () => publishStick(probeId, null), [probeId])

  // The missed stick stays on the ground even if the hoop changes height.
  //
  // The hoop fits itself to whoever plays (see `@/lib/hoopHeight`) and can go up or
  // down from the menu with the sticks of the previous run still lying on
  // the ground. When the anchor moves, React rewrites the position of the group and would
  // take the already resolved sticks with it: they would rise from the ground up to the
  // height of the hoop and stay hanging there, red and with no cord, until the
  // next run.
  useEffect(() => {
    const group = groupRef.current
    if (!group || state !== 'missed') return
    group.position.y = STICK_MISS_Y
  }, [anchorY, state])

  // The catch window also opens and closes by itself, with the pointer
  // still on top: the mouse stays over a stick while the countdown
  // runs, and when the run starts no new `pointerover` arrives to
  // light up the cursor. The same the other way round when the stick under the pointer touches
  // the ground or the run ends: the cursor would keep offering a stick that
  // can no longer be caught.
  useEffect(() => {
    if (!hovering.current) return
    document.body.style.cursor = catchable ? 'pointer' : 'auto'
  }, [catchable])

  const handleCatch = (event?: ThreeEvent<PointerEvent | MouseEvent>) => {
    // It is caught with the hand, not by pointing: see `canCatchWithPointer`.
    if (!canCatchWithPointer(pointerTypeOf(event))) return
    event?.stopPropagation()
    if (resolved.current) return
    if (!catchable) return
    resolved.current = true
    setState('caught')
    flash.current = 1
    // The green comes in all at once: the flash is already the confirmation, and a
    // transition from the yellow would make it lukewarm.
    const material = materialRef.current
    if (material) {
      material.color.copy(caughtColor)
      material.emissive.copy(caughtColor)
    }
    releaseCursor()
    // When the stick was caught decides the reflex bonus. It is taken from the
    // live position and not from the state, which has not been rendered again yet, and
    // it is measured against its own anchor: the hoop fits itself to whoever plays, so
    // not all the sticks start from the same height.
    const fallProgress = stickFallProgress(groupRef.current?.position.y ?? anchorY, anchorY)
    // Behind the back or not, with the camera, which with a headset is the head. Without a headset it always looks at the
    // machine, so on desktop it never comes up.
    camera.getWorldPosition(eyes)
    camera.getWorldDirection(gaze)
    const body = meshRef.current ?? groupRef.current
    if (body) body.getWorldPosition(caughtStick)
    const behindBack = body != null && isBehindBack({ head: eyes, gaze, stick: caughtStick })
    onCatch(fallProgress, behindBack)
    // The tap on the controller goes after counting the stick: the vibration is the
    // ornament and the score is the game, so a controller that misbehaves
    // cannot take the catch down with it. The hand that caught it vibrates, and
    // more if it was at the last moment (`lib/haptics.ts`).
    cancelPulses.current = pulseCatch(event, fallProgress)
  }

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    if (!group) return

    // Caps the delta to avoid jumps after background tabs.
    const delta = Math.min(rawDelta, 0.05)
    if (!paused) {
      elapsed.current += delta
    }

    // Where the stick is, for whoever looks from outside the Canvas. The body is
    // published and not the group: the group is at the hoop and the cylinder hangs a
    // hand's breadth below, which is where the hand has to be taken.
    if (stickProbeRequested()) {
      const body = meshRef.current
      if (body != null) {
        body.getWorldPosition(stickPoint)
        publishStick(probeId, {
          x: stickPoint.x,
          y: stickPoint.y,
          z: stickPoint.z,
          catchable,
        })
      }
    }

    // Swing: the hanging stick sways; as soon as it is released it straightens up, because
    // one that falls while tilting is hard to follow with the hand.
    if (swaying && state === 'hanging') {
      swingTime.current += delta
      swingLevel.current = 1
    } else if (swingLevel.current > 0) {
      swingLevel.current = Math.max(
        0,
        swingLevel.current - delta * SWING_RELEASE_DECAY,
      )
    }
    if (swingLevel.current > 0) {
      const tilt = hangingSwing(swingTime.current, swingPhase)
      group.rotation.x = tilt.x * swingLevel.current
      group.rotation.z = tilt.z * swingLevel.current
    } else if (group.rotation.x !== 0 || group.rotation.z !== 0) {
      // Only the two axes of the swing: the turn about Y is not its own and erasing it
      // would undo any orientation the stick may come to have.
      group.rotation.x = 0
      group.rotation.z = 0
    }

    // Hit: the stick lights up green, gives a kick of scale and
    // fades, while a wave goes out from where it was. It is the only moment in
    // which the game says "good" in the headset, where there is no scoreboard to read without
    // taking the eyes off the sticks.
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - delta * CATCH_FLASH_DECAY)
      const t = flash.current
      group.scale.setScalar(1 + (1 - t) * 0.5)

      const material = materialRef.current
      if (material) {
        material.emissiveIntensity = t * 2.4
        material.opacity = Math.min(t * 1.6, 1)
      }

      const ring = ringRef.current
      const ringMaterial = ringMaterialRef.current
      if (ring && ringMaterial) {
        ring.visible = true
        ring.scale.setScalar(0.3 + (1 - t) * 2.6)
        ringMaterial.opacity = t * 0.7
      }

      if (flash.current <= 0 && state === 'caught') {
        setVisible(false)
      }
    }

    // Miss: the stick that has touched the ground is tinted red. It stays there, so at
    // the end of the run the ground tells what got away.
    if (state === 'missed' && missTint.current < 1) {
      missTint.current = Math.min(1, missTint.current + delta * MISS_TINT_SPEED)
      const material = materialRef.current
      if (material) {
        material.color.copy(baseColor).lerp(missedColor, missTint.current)
        material.emissive.copy(missedColor)
        material.emissiveIntensity = 0.35 * missTint.current
      }
    }

    if (state === 'hanging') {
      // With the headset's menu behind, almost transparent and without covering in depth what the
      // panel paints in front of its plate; on pressing Jugar it comes back whole before being released.
      const material = materialRef.current
      const toward = dimmed ? STICK_BEHIND_MENU : 1
      if (material && veil.current !== toward) {
        veil.current = opacityToward(veil.current, toward, delta)
        material.opacity = veil.current
        material.depthWrite = veil.current >= 1
      }
      if (!paused && elapsed.current >= delay) {
        setState('falling')
      }
      return
    }

    if (state === 'falling' && !resolved.current && !paused) {
      fallTime.current += delta
      group.position.y = anchorY - fallDrop(fallTime.current, acceleration)
      if (group.position.y <= STICK_MISS_Y) {
        group.position.y = STICK_MISS_Y
        resolved.current = true
        setState('missed')
        onMiss()
      }
    }
  })

  return (
    // **And it is only there for the ray while it can be caught** (`lib/pointers.ts`). Turning a stick off
    // with `visible` does not take it away from the pointer: the already caught one stayed listening, invisible,
    // half a metre from the face and right between the hand and the menu.
    <group
      ref={groupRef}
      position={[anchorX, anchorY, anchorZ]}
      visible={visible}
      pointerEvents={stickPointerEvents(catchable)}
    >
      {/* Cord that joins the arch to the stick. Only while it hangs: as soon as the
          stick is released there is nothing holding it any more. */}
      <mesh position={[0, -STICK_CORD_LENGTH / 2, 0]} visible={state === 'hanging' && !dimmed}>
        <cylinderGeometry args={[0.005, 0.005, STICK_CORD_LENGTH, 6]} />
        <meshStandardMaterial color="#4a4038" metalness={0.1} roughness={0.9} />
      </mesh>

      {/* The stick itself, hanging under the cord. */}
      <mesh
        ref={meshRef}
        position={[0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0]}
        onClick={handleCatch}
        // The grab is resolved on closing the hand, without waiting for the release: with the
        // stick falling, demanding a full click (press and release over the same
        // object) would make grabs fail that the player feels as good ones.
        onPointerDown={handleCatch}
        onPointerOver={(e) => {
          e.stopPropagation()
          hovering.current = true
          // The cursor promises that the stick can be caught, so it answers to the
          // same rule as the catch and not to a copy of it. A stick that can no longer
          // be caught turns the cursor off instead of leaving it as it was: the pointer
          // may come from another stick that did count.
          document.body.style.cursor = catchable ? 'pointer' : 'auto'
        }}
        onPointerOut={releaseCursor}
      >
        <cylinderGeometry args={[STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, 16]} />
        {/* Painted wood, not plastic: the grain in relief and the uneven
            roughness are what give the feeling of weight. */}
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          normalMap={normalMap}
          normalScale={[0.8, 0.8]}
          roughnessMap={roughnessMap}
          emissive={color}
          emissiveIntensity={0}
          metalness={0}
          roughness={0.75}
          // Transparent from the start to be able to fade the stick when it is
          // caught: toggling `transparent` on the fly recompiles the shader and
          // gives a hitch right at the moment of the flash.
          transparent
          opacity={1}
        />
      </mesh>

      {/* Wave of the hit: it goes out from where the stick was and opens. It starts
          hidden and only the flash turns it on. */}
      <mesh
        ref={ringRef}
        position={[0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.05, 0.006, 6, 24]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={STICK_CAUGHT_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** At what rate the flash of the hit goes out (1/s). */
const CATCH_FLASH_DECAY = 1.8
/** At what rate the missed stick is tinted red (1/s). */
const MISS_TINT_SPEED = 3.5
