'use client'

import { GROUND_Y } from '../../lib/gameConfig'

/**
 * Ground of the scene. It paints nothing: the visible ground is the cobblestones of the
 * square in the HDRI, projected by <Environment ground>. This plane only exists
 * to receive the shadow of the machine, which is what settles it in place
 * instead of leaving it floating over the photo.
 *
 * It is at y=GROUND_Y, the height at which a stick is considered lost.
 */
export function Ground() {
  return (
    <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <shadowMaterial opacity={0.45} />
    </mesh>
  )
}
