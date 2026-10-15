'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type Scene } from 'three'

/**
 * The background of the scene: what is seen where nothing is drawn.
 *
 * **What it fixes.** The walls end at the height they end, and above them there was the black
 * of the compositor: not the black of a place in the dark, but the absence of a place. From a
 * screen it is barely noticeable; with the headset on it is noticed at once, because the eye uses
 * precisely the background to know where it is.
 *
 * **Why not `<color attach="background">`.** That shortcut attaches the colour to **its parent**,
 * and only gets it right if the parent is the scene. Inside any `<group>` —and here the world
 * hangs from several— it is attached to the group, where `background` means nothing: it does not
 * fail, it does not warn, it simply does nothing. This puts it where it goes, whatever it hangs
 * from.
 *
 * **And it gives it back on leaving.** Mounted in the hall, the game is unmounted on going back
 * to the arch: without restoring what was there, the cabinet would take the hub's background
 * with it.
 *
 * The scene is taken from the frame and not from `useThree` on purpose: what a hook returns is
 * not touched (`react-hooks/immutability`), and what has to be done here is exactly to touch it.
 */
export function Backdrop({ color }: { color: string }) {
  const background = useMemo(() => new Color(color), [color])
  const sceneRef = useRef<Scene | null>(null)
  const previous = useRef<Scene['background']>(null)

  useFrame(({ scene }) => {
    if (sceneRef.current !== scene) {
      sceneRef.current = scene
      previous.current = scene.background
    }
    // Only when needed: assigning on each of the ninety frames breaks
    // nothing, but it does nothing either.
    if (scene.background !== background) scene.background = background
  })

  useEffect(
    () => () => {
      const scene = sceneRef.current
      if (scene != null) scene.background = previous.current
    },
    [],
  )

  return null
}
