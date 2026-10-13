'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { BACKDROP_COLOR } from '../../lib/gameConfig'
import { DECOR_POINTER_EVENTS } from '../../lib/pointers'
import type { SceneryMode } from '../../lib/gameStore'

/**
 * Fades between the scenery and the passthrough.
 *
 * Changing the decor all at once is violent: it goes from a square at night to the
 * player's room in one frame. Here it is done in two beats —close,
 * change, open— with a curtain that wraps the head.
 *
 * **Why a curtain and not a fade of the background itself.** The skybox of
 * `<Environment background>` cannot be made transparent: it is either there or not,
 * and removing it is precisely what reveals the passthrough. A sphere around the
 * camera can be faded out, and along the way it covers the instant of the change.
 *
 * The mode that has to be painted is handed to the children as a render prop, so that
 * the change happens with the curtain closed and the jump is not seen.
 */

/** How long each half of the transition lasts, in seconds. */
const FADE_SECONDS = 0.32

/** Radius of the curtain: close to the head, but outside the clipping plane. */
const CURTAIN_RADIUS = 0.35

export function SceneryFade({
  mode,
  children,
}: {
  mode: SceneryMode
  children: (applied: SceneryMode) => ReactNode
}) {
  // The decor being painted right now, which lags behind what
  // the player has asked for while the fade lasts.
  const [applied, setApplied] = useState(mode)
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)
  const opacity = useRef(0)
  const phase = useRef<'idle' | 'closing' | 'opening'>('idle')

  useEffect(() => {
    if (applied !== mode) phase.current = 'closing'
  }, [mode, applied])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (mesh == null || material == null) return

    // The curtain is stuck to the head. In the headset the player moves around the
    // room, and a sphere anchored at the origin of the scene would be left
    // behind precisely during the change.
    //
    // **And the world position is translated to its parent's space.** The curtain hangs from the
    // decor, which is shifted forwards and —mounted in the hall— turned towards where
    // the arch was (`HostAnchored`): assigned as is, the sphere lands displaced
    // by exactly what the world has moved, and with a 35 cm radius that is leaving the head
    // outside. `worldToLocal` walks the whole chain of parents, which is what has to be
    // undone.
    state.camera.getWorldPosition(mesh.position)
    const parent = mesh.parent
    if (parent != null) {
      // three only brings the matrices up to date on painting, and the decor is placed in its own
      // render: without this it would be translated with the world of the previous frame.
      parent.updateWorldMatrix(true, false)
      parent.worldToLocal(mesh.position)
    }

    const step = delta / FADE_SECONDS

    if (phase.current === 'closing') {
      opacity.current = Math.min(1, opacity.current + step)
      if (opacity.current >= 1) {
        // With the curtain closed the decor is changed: the jump is not seen.
        setApplied(mode)
        phase.current = 'opening'
      }
    } else if (phase.current === 'opening') {
      opacity.current = Math.max(0, opacity.current - step)
      if (opacity.current <= 0) phase.current = 'idle'
    }

    material.opacity = opacity.current
    // Fully invisible when it does nothing: otherwise, in AR a black sphere at
    // 0 % opacity would keep writing to the depth buffer.
    mesh.visible = opacity.current > 0.001
  })

  return (
    <>
      {/* And out of reach of the pointers, said here as well as inheriting it from the world: it is a
          35 cm sphere **around the head**, and a shape that wraps the hand counts
          as touched at distance zero. Being invisible does not set it aside: to the pointer library
          visibility says nothing (`lib/pointers.ts`). */}
      <mesh ref={meshRef} visible={false} pointerEvents={DECOR_POINTER_EVENTS}>
        {/* Seen from inside: the sphere wraps the player. */}
        <sphereGeometry args={[CURTAIN_RADIUS, 16, 12]} />
        <meshBasicMaterial
          ref={materialRef}
          color={BACKDROP_COLOR}
          side={BackSide}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {children(applied)}
    </>
  )
}
