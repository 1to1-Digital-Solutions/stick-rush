import { expect, test } from '@playwright/test'

import {
  ASSETS_BASE,
  findInScene,
  enterHostBooth,
  enterHostVR,
  openHost,
  finishedRuns,
} from './support/host'
import { installXREmulator, placeHand, useBareHands } from './support/xr'

/**
 * The hands, mounted inside the hall.
 *
 * The glove and the articulated hand used to hang from the game's own WebXR store (its
 * `controller`, its `hand.model`), and inside the hall the store is the hall's, which draws no
 * hands: right where it is played most, whoever went for a stick could not see where their hand was. Now
 * the scene mounts them (`PlayerHands`), and this checks it with the scene put inside
 * someone else's Canvas whose store, like the hall's, draws nothing in the hand.
 *
 * From outside the Canvas the geometry is not seen, so the host lets us look up by name
 * (`glove-right`, `bare-hand-right`): whether it is there, whether it is painted and where.
 */

/** Where the hand is put: in front and a little to the right, at chest height. */
const IN_FRONT = { x: 0.2, y: 1.3, z: -0.35 }

test('with controllers, the glove goes on the hand even though the store is the host\'s', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openHost(page)
  await enterHostVR(page)
  await placeHand(page, 'right', IN_FRONT)

  await expect
    .poll(() => findInScene(page, 'glove-right'), {
      message: 'the right hand\'s glove never got painted',
    })
    .toMatchObject({ visible: true })

  // And where the controller is, not where the world is: the scene lowers it and shifts it, and the glove
  // has to stay on the hand all the same.
  const glove = await findInScene(page, 'glove-right')
  expect(glove).not.toBeNull()
  const away = Math.hypot(glove!.x - IN_FRONT.x, glove!.y - IN_FRONT.y, glove!.z - IN_FRONT.z)
  expect(away).toBeLessThan(0.12)

  // One per hand, not two: the host's `controller` draws nothing of its own.
  expect(await findInScene(page, 'glove-left')).not.toBeNull()
  expect(errors).toEqual([])
})

test('with bare hands, the articulated hand comes from the game and not from the root', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  const { requested } = await openHost(page)
  await enterHostVR(page)
  // It is entered with controllers and they are put down, which is what is done with the headset. We have to wait until
  // they are registered: @react-three/xr registers them on loading their profile, and if they are disconnected
  // before, it signs them up all the same afterwards and they are left hanging (in the headset the pose of a controller
  // that is no longer there does not arrive, and the glove hides; in the emulator it does arrive).
  await expect.poll(() => findInScene(page, 'glove-right')).not.toBeNull()
  await useBareHands(page)

  await expect
    .poll(() => findInScene(page, 'bare-hand-right'), {
      message: 'the right bare hand never got painted',
    })
    .toMatchObject({ visible: true })
  await expect
    .poll(() => findInScene(page, 'bare-hand-left'))
    .toMatchObject({ visible: true })

  // The model is requested under the game's prefix —the hall's root does not have it— and outside its
  // `webxr-profiles/`, which the hall deletes from each game on installing it because it serves its own.
  expect(requested).toContain(`${ASSETS_BASE}manos/generic-hand/right.glb`)
  const otherPaths = requested.filter(
    (requestedPath) => requestedPath.includes('/generic-hand/') && !requestedPath.startsWith(`${ASSETS_BASE}manos/`),
  )
  expect(otherPaths).toEqual([])

  // On putting the controllers down, the glove goes away.
  await expect.poll(() => findInScene(page, 'glove-right')).toBeNull()
  expect(errors).toEqual([])
})

test('with a challenge, the scene mounted inside the session enters playing and reports on finishing', async ({
  page,
}) => {
  // As in the hall: the session is entered and then the cabinet is chosen. The scene is born inside
  // an open session, and that cannot be taken as «the headset was entered with a desktop
  // run half way through», which discarded it and left the challenge in the menu.
  // A whole run in real time: with software WebGL the fall stretches.
  test.setTimeout(150_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openHost(page, undefined, { onDemand: true, challenge: 20260925 })
  await enterHostVR(page)
  await enterHostBooth(page)

  // Without touching anything: the countdown runs by itself, the sticks fall and none is caught. With three
  // lives, the third one that touches the floor ends the challenge, and it is reported once, as a challenge.
  await expect
    .poll(() => finishedRuns(page), {
      timeout: 75_000,
      message: 'the scene did not report the end of the challenge',
    })
    .toEqual([{ mode: 'challenge', points: 0, challenge: true }])
  expect(errors).toEqual([])
})
