import { expect, test } from '@playwright/test'

import { PLAY_HEIGHT_KEY } from '@/lib/settings'
import type { StickProbe } from '@/lib/sceneProbe'
import { openGame } from './helpers'
import {
  enterVR,
  installXREmulator,
  seatPlayer,
  startGameInsideSession,
} from './support/xr'

/**
 * Playing seated.
 *
 * **It was the biggest barrier the hall had**, and the only one that could not be got round
 * by playing worse: the heights of the thirteen games were chosen with a person standing in front,
 * so seated —on a chair, on a sofa, in a wheelchair— the hoop ends up
 * above where the arm reaches and there is no run. Nothing fails, and that is why there was
 * nothing to fix either: it simply could not be played.
 *
 * Here the player is really seated —the head at one metre twenty, which is what someone
 * seated measures— and it is checked **with a stick of the hoop** that the world comes down to them. It is the only
 * thing that says so from outside the Canvas: the scene is geometry and leaves no trace in the DOM.
 */

/** Where a stick of the hoop is right now, in metres of the world. */
async function stickHeight(page: import('@playwright/test').Page) {
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
  return ((await found.jsonValue()) as StickProbe).y
}

test.describe('the world at the height of whoever plays', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
  })

  test('seated and standing, the hoop is at the same height if nobody asks for anything', async ({
    page,
  }) => {
    // The setting is not guessed: for whoever is standing, moving the floor under their feet
    // turns their stomach, and there are short people who prefer the world as it is.
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })
    await startGameInsideSession(page)

    const standing = await stickHeight(page)
    await seatPlayer(page, 1.2)
    await page.waitForTimeout(1500)

    expect(await stickHeight(page)).toBeCloseTo(standing, 2)
  })

  test('asked for from the hall, the world comes down to the eyes', async ({ page }) => {
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })
    await startGameInsideSession(page)

    const standing = await stickHeight(page)

    // Sitting down and asking for it, both things. The setting travels through the browser from the
    // hall's front page, and the notice is what makes it reach a game already mounted: whoever
    // changes it is inside the hall and reloading would close the immersive session.
    await seatPlayer(page, 1.2)
    await requestWorldAtEyes(page)
    // The tracking does not jump: it approaches the measurement and only adopts it when the change
    // holds, so that crouching in the middle of a run does not move the scene.
    await page.waitForTimeout(2500)

    const seated = await stickHeight(page)

    // The forty centimetres that whoever has their eyes at 1.20 is short of to reach
    // a world drawn for 1.60.
    expect(standing - seated).toBeGreaterThan(0.3)
    expect(standing - seated).toBeLessThan(0.5)
  })

  test('chosen before starting, the hoop does not come down twice', async ({ page }) => {
    // This game already accommodated **its hoop** to the stature of whoever plays, measured while the
    // run is being chosen (`XRPlayerHeight`). With the whole world also coming down to the
    // eyes, the hoop took both corrections and ended up below the hands: the
    // fix is that it stops following the stature when the scenery already comes closer by itself.
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })

    // Seated and asked for **from the menu**, which is the real path: it is there that the hoop
    // is measured, and that is why it was there that the double discount showed.
    await seatPlayer(page, 1.2)
    await requestWorldAtEyes(page)
    await page.waitForTimeout(2000)
    await startGameInsideSession(page)

    // A stick of the hoop ends up at an arm's height of whoever is seated, neither above
    // the head nor down by the ankles. With the double correction it fell below 0.8.
    const heightOfTheStick = await stickHeight(page)

    expect(heightOfTheStick).toBeGreaterThan(0.9)
    expect(heightOfTheStick).toBeLessThan(1.5)
  })
})

/** Asks for the world at eye height, as is done from the hall's settings. */
async function requestWorldAtEyes(page: import('@playwright/test').Page) {
  await page.evaluate((key) => {
    window.localStorage.setItem(key, 'eyes')
    window.dispatchEvent(new Event('xrcade:ajustes'))
  }, PLAY_HEIGHT_KEY)
}
