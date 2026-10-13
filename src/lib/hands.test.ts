import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  JOINTS,
  HANDS,
  placeAtOrigin,
  triggerSide,
  carriesTheHint,
  handPath,
} from './hands'

describe('the glove of each hand', () => {
  it('the side trigger falls inwards', () => {
    expect(triggerSide('left')).toBe(1)
    expect(triggerSide('right')).toBe(-1)
  })

  it('the grip hint, from the countdown until the first stick', () => {
    expect(carriesTheHint('menu', 0)).toBe(false)
    expect(carriesTheHint('countdown', 0)).toBe(true)
    expect(carriesTheHint('playing', 0)).toBe(true)
    expect(carriesTheHint('playing', 1)).toBe(false)
    expect(carriesTheHint('finished', 0)).toBe(false)
  })
})

describe('the bare hand', () => {
  it('the model of both hands is in public, outside the controller profiles', () => {
    // Relative to the game's base (in the hall, its prefix) and outside `webxr-profiles/`, which the
    // hall deletes from each game when installing it because it serves its own.
    for (const hand of HANDS) {
      const path = handPath(hand)
      expect(path).not.toMatch(/^\//)
      expect(path).not.toMatch(/webxr-profiles/)
      expect(existsSync(join(process.cwd(), 'public', path)), path).toBe(true)
    }
  })

  it('the twenty-five WebXR joints, without repeats', () => {
    expect(JOINTS).toHaveLength(25)
    expect(new Set(JOINTS).size).toBe(25)
    expect(JOINTS[0]).toBe('wrist')
    expect(JOINTS.at(-1)).toBe('pinky-finger-tip')
  })
})

describe('placing what WebXR gives under a moved parent', () => {
  const pose = new Matrix4().compose(
    new Vector3(0.3, 1.1, -0.4),
    new Quaternion().setFromEuler(new Euler(0.2, -0.7, 0.1)),
    new Vector3(1, 1, 1),
  )

  it('ends up at the origin pose even if the parent is lowered and turned', () => {
    // As in the scene: the world lowered to the height of whoever plays and turned by the anchor.
    const parent = new Object3D()
    parent.position.set(0, -0.35, 0.08)
    parent.rotation.set(0, 0.9, 0)
    parent.updateMatrixWorld(true)

    const child = new Object3D()
    child.matrixAutoUpdate = false
    parent.add(child)
    placeAtOrigin(child.matrix, parent.matrixWorld, pose, new Matrix4())
    child.updateMatrixWorld(true)

    const expected = new Vector3().setFromMatrixPosition(pose)
    const actual = new Vector3().setFromMatrixPosition(child.matrixWorld)
    expect(actual.distanceTo(expected)).toBeLessThan(1e-9)
    const rotation = new Quaternion().setFromRotationMatrix(child.matrixWorld)
    expect(rotation.angleTo(new Quaternion().setFromRotationMatrix(pose))).toBeLessThan(1e-6)
  })

  it('without a parent, the pose as is', () => {
    const target = new Matrix4()
    placeAtOrigin(target, null, pose, new Matrix4())
    expect(target.equals(pose)).toBe(true)
  })
})
