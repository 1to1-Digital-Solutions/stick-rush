import { expect, test } from '@playwright/test'

import type { StickProbe } from '@/lib/sceneProbe'
import { openGame } from './helpers'
import {
  enterVR,
  installXREmulator,
  moveBareHand,
  pinchHand,
  pressPlayInsideSession,
  startGameInsideSession,
  tutorialSkipButton,
  useBareHands,
} from './support/xr'

/**
 * Playing with bare hands, with no controllers.
 *
 * **It is the input mode that left people out.** Whoever has no controllers at
 * hand —or cannot hold them— enters the headset with their hands, and the game has
 * to let itself be played all the same: the stick is caught by closing the hand over it, which is
 * exactly what the tutorial promises («close your hand around the stick»).
 *
 * Here the controllers are turned off, the hands are turned on with their joints and the
 * whole gesture is made: taking the hand up to a stick and closing it. What is
 * checked is that the stick counts as caught, which is the only thing that says
 * from outside the Canvas whether the grip engaged — with a bare hand there is no
 * button to press nor focus to follow.
 */
test('with bare hands the sticks are caught too', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openGame(page)
  await enterVR(page)
  await useBareHands(page)
  await startGameInsideSession(page)

  // The snapshot of the sticks is requested: the scene does not publish it if nobody has
  // asked for it, so the property has to be created before looking at it.
  await page.evaluate(() => {
    window.__stickRushSticks = {}
  })

  // A stick that can be caught right now, and where it is. Hanging is fine: the
  // catch window opens as soon as the run starts (see
  // `canCatchStick`), and a still stick is the one that lets the gesture be tested without
  // the test depending on hitting something that falls.
  const found = await page.waitForFunction(
    () => {
      // The highest of the ones that can be caught, which is one that still hangs: the falling
      // turn comes from a new seed in each run, and the first of the list may be
      // just the one that is already falling.
      const sticks = Object.values(window.__stickRushSticks ?? {}).filter((stick) => stick.catchable)
      return sticks.length === 0 ? null : sticks.reduce((highest, stick) => (stick.y > highest.y ? stick : highest))
    },
    undefined,
    { timeout: 15_000 },
  )
  const hanging = (await found.jsonValue()) as StickProbe

  // The hand reaches the stick and closes. Both things are needed: closing it
  // from afar catches nothing, and arriving without closing it does not either.
  await moveBareHand(page, 'right', { x: hanging.x, y: hanging.y, z: hanging.z })
  await pinchHand(page, 'right', true)

  await expect(page.getByRole('status')).toContainText(/[1-9]\d* \//, {
    timeout: 10_000,
  })

  expect(errors).toEqual([])
})

/**
 * And what is shown is what is held in the hand.
 *
 * The tutorial drew a controller with its side trigger marked. Whoever enters with
 * their hands saw an object they do not have and a button they cannot squeeze, right
 * on the only screen of the game that exists to explain the gesture. With
 * hands a closing hand is drawn (see `XRHandModel`).
 *
 * From outside the Canvas there is no way of looking at which geometry there is —there is no text nor
 * DOM that reflects it—, so what is checked is that the demonstration
 * starts, runs and is painted without blowing up with the hands on.
 */
test('the tutorial is painted with hands without dirtying the console', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openGame(page)
  await enterVR(page)
  await useBareHands(page)
  await pressPlayInsideSession(page)

  // The tutorial is put before the run the first time, and its skip button
  // is the DOM reflection of the demonstration that runs in 3D.
  await expect(tutorialSkipButton(page)).toHaveCount(1)
  // A few seconds: the hand closes and opens twice per cycle, and the stretch
  // lasts for two cycles.
  await page.waitForTimeout(4000)

  expect(errors).toEqual([])
})
