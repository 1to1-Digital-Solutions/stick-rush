'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGetXRSpaceMatrix, useXR, useXRInputSourceState } from '@react-three/xr'
import { Group, Matrix4, SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { assetUrl } from '../../lib/assets'
import { useGame } from '../../lib/gameStore'
import { pressAmount } from '../../lib/glove'
import {
  JOINTS,
  HANDS,
  placeAtOrigin,
  triggerSide,
  carriesTheHint,
  handPath,
  type Hand,
} from '../../lib/hands'
import { NO_RAYCAST } from '../raycast'
import { Glove } from './Glove'

/**
 * The hands of whoever plays: the glove with controllers and the articulated hand without them.
 *
 * **The scene mounts them, not the store.** What hangs from the `XRStore` (its `controller`, its
 * `hand.model`) only exists on the game's own website: inside the xrcade hall the store is the hall's,
 * which draws no hands, and that is where the game is played the most. Mounted here they show up the same
 * in both places, and whoever plays sees where their hands are when going for a stick, which is what they are for.
 *
 * Each part is placed like `RealController`: the pose WebXR gives, in the origin's space,
 * with whatever the parents put undone (`placeAtOrigin`), so it does not matter where they
 * hang from. They are named (`glove-left`, `bare-hand-right`…) so they can be looked up from outside.
 */
export function PlayerHands() {
  return (
    <>
      {HANDS.map((hand) => (
        <GloveOnHand key={`glove-${hand}`} hand={hand} />
      ))}
      {HANDS.map((hand) => (
        <BareHand key={`bare-hand-${hand}`} hand={hand} />
      ))}
    </>
  )
}

/** Reused every frame: a new matrix per frame is garbage to collect. */
const POSE = new Matrix4()
const SCRATCH = new Matrix4()

/** Puts the group at the origin's pose, undoing its parents. */
function place(group: Object3D, pose: Matrix4): void {
  const parent = group.parent
  parent?.updateWorldMatrix(true, false)
  placeAtOrigin(group.matrix, parent?.matrixWorld ?? null, pose, SCRATCH)
}

/**
 * The glove on that hand's controller, in the grip's space (`grip-space`), which is where
 * `Glove` has the handle measured.
 */
function GloveOnHand({ hand }: { hand: Hand }) {
  const controller = useXRInputSourceState('controller', hand)
  const groupRef = useRef<Group>(null)
  const { gameState, score } = useGame()
  const locate = useGetXRSpaceMatrix(controller?.inputSource.gripSpace)

  // Before anybody else (negative priority, like the library itself and `RealController`): the glove
  // has to be in place when `Glove` copies its parts and the frame is painted.
  useFrame((_state, _delta, frame) => {
    const node = groupRef.current
    if (node == null) return
    const placed = locate?.(POSE, frame) ?? false
    node.visible = placed
    if (placed) place(node, POSE)
  }, -100)

  if (controller == null) return null

  return (
    <group ref={groupRef} name={`glove-${hand}`} matrixAutoUpdate={false} visible={false}>
      <Glove
        side={triggerSide(hand)}
        highlight={carriesTheHint(gameState, score)}
        read={() => ({
          grip: pressAmount(controller.gamepad['xr-standard-squeeze']),
          trigger: pressAmount(controller.gamepad['xr-standard-trigger']),
        })}
      />
    </group>
  )
}

/** One for both hands: each `.glb` is requested once per session at most. */
const loader = new GLTFLoader()

/**
 * The articulated hand, bone by bone: the same thing the library's `XRHandModel` does, but without
 * depending on the store that mounts it.
 *
 * **Loaded by hand and not with `useLoader`**, which suspends: a `.glb` that fails would leave an
 * error screen on top of the game, and here the right thing is not to draw the hand and carry on.
 */
function BareHand({ hand }: { hand: Hand }) {
  const state = useXRInputSourceState('hand', hand)
  const origin = useXR((xr) => xr.originReferenceSpace)
  const groupRef = useRef<Group>(null)
  const model = useHandModel(state == null ? null : assetUrl(handPath(hand)))

  const bones = useMemo(
    () =>
      model == null
        ? null
        : JOINTS.map((name) => {
            const bone = model.getObjectByName(name)
            if (bone != null) bone.matrixAutoUpdate = false
            return bone
          }),
    [model],
  )
  const poses = useMemo(() => new Float32Array(JOINTS.length * 16), [])

  useFrame((_state, _delta, frame) => {
    const node = groupRef.current
    const xrHand = state?.inputSource.hand
    if (node == null || bones == null || xrHand == null || origin == null || frame == null) return
    // `fillPoses` says whether the headset is tracking the hand in this frame: if not, a frozen
    // hand is not shown where it was.
    const placed = frame.fillPoses?.(xrHand.values(), origin, poses) ?? false
    node.visible = placed
    if (!placed) return
    place(node, POSE.identity())
    for (let i = 0; i < bones.length; i++) bones[i]?.matrix.fromArray(poses, i * 16)
  }, -100)

  if (model == null) return null

  return (
    <group ref={groupRef} name={`bare-hand-${hand}`} matrixAutoUpdate={false} visible={false}>
      <primitive object={model} />
    </group>
  )
}

/** The model already cloned, or `null` while there is none (or if it could not be loaded). */
function useHandModel(path: string | null): Object3D | null {
  const [loaded, setLoaded] = useState<{ path: string; model: Object3D } | null>(null)

  useEffect(() => {
    if (path == null) return
    let alive = true
    loader
      .loadAsync(path)
      .then((gltf) => {
        if (!alive) return
        const model = cloneSkeleton(gltf.scene)
        model.traverse((part) => {
          // Invisible to the ray: the pointer starts in this very hand and it would swallow it.
          part.raycast = NO_RAYCAST
          // The bones move outside the box it was loaded with: without this, the hand
          // disappears as soon as the headset thinks it has left the frame.
          if (part instanceof SkinnedMesh) part.frustumCulled = false
        })
        setLoaded({ path, model })
      })
      // Without a model there is no hand to draw, and the game goes on: the grab does not depend on seeing it.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [path])

  if (loaded == null || loaded.path !== path) return null
  return loaded.model
}
