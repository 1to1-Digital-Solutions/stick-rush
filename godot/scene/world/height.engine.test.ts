/**
 * The hall's fine height (`xrcade:play-height-offset`) reaches the scenery of this game.
 *
 * The kit's player reads it from the game's save, without the port asking for it: this checks
 * that the key the hall writes is the one this game reads and that it raises or lowers its world,
 * with the common files of this repo (`xrLayout.ts` as `uiHeight` and `hostAnchor.ts`).
 */
import { Engine, Node3D, SceneTree } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { IDENTIDAD, vec } from '@kit/lib/xr/pose'
import { aTransform } from '@kit/runtime/xr/pose-godot'
import { XRPlayer } from '@kit/runtime/xr/player'
import { simulateControllers, type Simulation } from '@kit/runtime/xr/simulated'

import { PLAY_HEIGHT_OFFSET_KEY } from '@/lib/settings'
import * as hostAnchor from '@/lib/hostAnchor'
import { gameStorage } from '@/lib/storage'
import * as xrLayout from '@/lib/xrLayout'

let root: Node3D
let sim: Simulation

/** The player as `main.ts` mounts it, standing and with the head at 1.70. */
function worldRise(): number {
  const player = new XRPlayer(root, { common: { uiHeight: xrLayout, hostAnchor }, anclaje: null })
  sim.cabeza(aTransform({ ...IDENTIDAD, origen: vec(0, 1.7, 0) }))
  player.update(1 / 72)
  expect(player.mundo.global_position.y).toBeCloseTo(player.subida, 6)
  return player.subida
}

describe('the hall\'s fine height', () => {
  beforeEach(() => {
    gameStorage()?.clear()
    root = new Node3D()
    ;(Engine.get_main_loop() as SceneTree).root!.add_child(root)
    sim = simulateControllers()
  })

  afterEach(() => {
    sim.quitar()
    root.queue_free()
    gameStorage()?.clear()
  })

  it('without the key the world stays where it is', () => {
    expect(worldRise()).toBeCloseTo(0, 6)
  })

  it('with −15 the world drops fifteen centimetres', () => {
    gameStorage()!.setItem(PLAY_HEIGHT_OFFSET_KEY, '-15')
    expect(worldRise()).toBeCloseTo(-0.15, 6)
  })
})
