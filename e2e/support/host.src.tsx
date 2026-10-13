import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { Vector3, type Object3D } from 'three'

import { StickRushScene } from '../../src/game/StickRushScene'
import type { HostAnchor } from '../../src/lib/hostAnchor'
import type { Goal } from '../../src/lib/goal'
import type { GameResult } from '../../src/lib/seed'

/**
 * The test host: it mounts `<StickRushScene>` inside a Canvas and a session that are not
 * its own, as the xrcade hall does.
 *
 * It is the place of the suite that exercises the mounting contract: the game's website mounts
 * `<StickRush>`, which brings its own Canvas, its own store and its own drawn controller. Here there
 * is none of that —the store is the host's and, like the hall's, **it draws neither controllers nor
 * hands**—, so whatever is seen in the hand has been put there by the scene.
 */
const mount = document.getElementById('game')
if (mount == null) {
  throw new Error('The test host has nowhere to mount the game')
}
const assetsBase = mount.dataset.assetsBase ?? '/'

/**
 * Mount the scene only when asked, **as in the hall**: there the cabinet is chosen with the headset
 * already on, so the scene is born inside an open session.
 */
const onDemand = mount.dataset.cabinet === 'on-demand'

/** The hall's challenge, if the page brings it: the seed, as the arc of cabinets would pass it. */
const challenge = mount.dataset.challenge == null ? undefined : { seed: Number(mount.dataset.challenge) }

/** Where to plant the world, if the page brings it: the anchor the hall lends. */
const anchor = mount.dataset.anchor == null ? undefined : (JSON.parse(mount.dataset.anchor) as HostAnchor)

/** The game's medal thresholds, if the page brings them: what the hall passes in `goal`. */
const goal = mount.dataset.goal == null ? undefined : (JSON.parse(mount.dataset.goal) as Goal)

const store = createXRStore({
  // What the contract asks to wire to the host: the controller profiles under its own prefix.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  // Like the hall (`xrcade/src/components/salon/salonStore.ts`): with no controller model nor hand model.
  controller: { model: false },
  hand: { model: false },
})

/** What can be known about an object of the scene from outside the Canvas. */
export interface SceneObject {
  /** Whether it is painted: it and all its parents visible. */
  visible: boolean
  /** Where it is, in the scene's space. */
  x: number
  y: number
  z: number
}

declare global {
  interface Window {
    __stickRushHost: {
      enterVR: () => Promise<void>
      /** Looks up by name; `null` if it is not mounted. */
      find: (name: string) => SceneObject | null
      /** Mounts the scene, as on choosing a cabinet. Only does something with `data-cabinet`. */
      enterCabinet: () => void
      /** Unmounts the scene, as on going back to the hall. */
      leaveCabinet: () => void
      /** What the scene has told on finishing each run (`onFinish`), in order. */
      finished: GameResult[]
      /** Stops painting that object, or paints it again: to measure what it costs. `false` if it is not there. */
      hide: (name: string, hidden: boolean) => boolean
      /** Points the host's camera at that point of the scene (outside the immersive session). */
      lookAt: (x: number, y: number, z: number) => void
    }
  }
}

let probedScene: Object3D | null = null
let probedCamera: Object3D | null = null
let enter = () => {}
let leave = () => {}

window.__stickRushHost = {
  async enterVR() {
    await store.enterVR()
  },
  find(name) {
    const object = probedScene?.getObjectByName(name)
    if (object == null) return null
    let visible = true
    for (let node: Object3D | null = object; node != null; node = node.parent) {
      visible &&= node.visible
    }
    object.updateWorldMatrix(true, false)
    const { x, y, z } = new Vector3().setFromMatrixPosition(object.matrixWorld)
    return { visible, x, y, z }
  },
  enterCabinet: () => enter(),
  leaveCabinet: () => leave(),
  finished: [],
  hide(name, hidden) {
    const object = probedScene?.getObjectByName(name)
    if (object == null) return false
    object.visible = !hidden
    return true
  },
  lookAt(x, y, z) {
    probedCamera?.lookAt(x, y, z)
  },
}

/** Leaves the scene within reach of `find`. */
function Probe() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    probedScene = scene
    probedCamera = camera
    return () => {
      probedScene = null
      probedCamera = null
    }
  }, [scene, camera])
  return null
}

/** The cabinet: the scene, mounted when it is time. */
function Cabinet() {
  const [inside, setInside] = useState(!onDemand)
  useEffect(() => {
    enter = () => setInside(true)
    leave = () => setInside(false)
    return () => {
      enter = () => {}
      leave = () => {}
    }
  }, [])

  if (!inside) return null
  // Going back is the host's business, and here there is nowhere to go.
  return (
    <StickRushScene
      assetsBase={assetsBase}
      anchor={anchor}
      onExit={() => {}}
      challenge={challenge}
      goal={goal}
      onFinish={(result) => window.__stickRushHost.finished.push(result)}
    />
  )
}

function Host() {
  return (
    <Canvas camera={{ position: [0, 1.6, 0.6], fov: 55, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        <Probe />
        <Cabinet />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
