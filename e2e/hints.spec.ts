import { expect, test, type Page } from '@playwright/test'

import { CROSSFADE } from '../src/lib/hints'
import { HINT_SCRIPT } from '../src/lib/hintScript'
import { TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE } from '../src/lib/tutorial'
import { openGame } from './helpers'
import { installDrawCallCounter, letSettle, storeBeforeOpen, medianDrawCalls } from './support/scenery'
import { findInScene, enterHostBooth, enterHostVR, openHost } from './support/host'
import { enterVR, installXREmulator, lookAt } from './support/xr'

/**
 * The visual hints, inside the headset.
 *
 * **What is checked here and what is not.** That the script turns itself off, that what floats goes away
 * before anything falls and that no height covers the machine nor the sticks is measured by
 * `src/lib/hintScript.test.ts`, with no browser and with figures. What is only seen here is that
 * **they really get painted** —which is different from the script turning them on— and that **they stop
 * being painted** when it is time.
 *
 * **And they are measured by what they cost**, which is the only thing a hint lets be seen from outside the
 * headset: the draw calls per frame (`e2e/support/scenery.ts`). A hint turned on
 * costs; turned off it is invisible and costs nothing. **It is measured in the menu**, which is the still phase:
 * the sticks hang and none falls, so the only thing that changes between the two measurements are the
 * hints.
 *
 * Whether they are **read** —whether the ghost is understood as a stick that falls or as an amber blur— no
 * number says: that is what the screenshots are for, and the answer comes with the goggles on.
 *
 * **It is entered with the tutorial already seen** so that its panel and its controller over the hand do not count in
 * the measurement. The hints' controller goes beside the ghost, so they do not step on each other.
 */

const SCREENSHOTS = 'test-results/capturas'

/**
 * Where to look to see them: at the stick in front and a little down, which is where the
 * ghost falls and where the controller is. **The two measurements of a comparison are taken with the head in
 * the same place**: otherwise, what is compared are two views and not two scenes.
 */
const AT_THE_MACHINE = { yaw: 0, pitch: -18 }
/** And at the feet, which is where the footprints are: only for the screenshot. */
const AT_THE_FEET = { yaw: 0, pitch: -70 }

/** How long the most patient hint takes to leave by itself, plus the crossfade it fades out with. */
const UNTIL_THEY_LEAVE = Math.max(...HINT_SCRIPT.map((hint) => hint.expiresAfter)) + CROSSFADE + 2

/**
 * How many draw calls per frame all the hints at once may cost.
 *
 * The two eyes of an immersive session double every mesh, and the controller's model brings its
 * own —it is, by far, the expensive one: that is why it leaves with the ghost—. The rest are three meshes: the
 * two footprints and the ghost.
 */
const HINTS_CEILING = 60

/** Lets the crossfade they appear or leave with finish, which lasts almost half a second. */
async function letCrossfade(page: Page) {
  await page.waitForTimeout(CROSSFADE * 1000 + 300)
  await letSettle(page)
}

test.describe('The visual hints', () => {
  test('in the menu they are painted, and they leave by themselves when their deadline runs out', async ({ page }) => {
    test.setTimeout(UNTIL_THEY_LEAVE * 1000 + 90_000)
    await installDrawCallCounter(page)
    await installXREmulator(page)
    await storeBeforeOpen(page, TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    await openGame(page)
    await enterVR(page)

    await lookAt(page, AT_THE_MACHINE.yaw, AT_THE_MACHINE.pitch)
    await letCrossfade(page)
    const withHints = await medianDrawCalls(page)
    await page.screenshot({ path: `${SCREENSHOTS}/hints-menu-machine.png` })
    await lookAt(page, AT_THE_FEET.yaw, AT_THE_FEET.pitch)
    await letCrossfade(page)
    await page.screenshot({ path: `${SCREENSHOTS}/hints-menu-feet.png` })

    // They are left to expire, which is the only way of turning them off without touching the scene. **The head
    // goes back to the same place for the second measurement.**
    await lookAt(page, AT_THE_MACHINE.yaw, AT_THE_MACHINE.pitch)
    await page.waitForTimeout(UNTIL_THEY_LEAVE * 1000)
    await letSettle(page)
    const withoutHints = await medianDrawCalls(page)
    await page.screenshot({ path: `${SCREENSHOTS}/hints-exhausted.png` })

    console.log(`[hints] calls per frame: with hints ${withHints}, expired ${withoutHints}`)
    expect(withHints, 'the hints cost nothing: are they being painted?').toBeGreaterThan(withoutHints)
    expect(
      withHints - withoutHints,
      `${withHints} calls with hints and ${withoutHints} without them: they have got too expensive`,
    ).toBeLessThanOrEqual(HINTS_CEILING)
  })

  test('what floats leaves before the first stick falls, and the footprints stay', async ({
    page,
  }) => {
    // With the challenge the run starts by itself on mounting the scene, so the whole countdown
    // is seen without pressing anything in the headset's menu.
    await installXREmulator(page)
    await openHost(page, undefined, { onDemand: true, challenge: 7 })
    await enterHostVR(page)
    await enterHostBooth(page)

    await expect
      .poll(() => findInScene(page, 'hint-stick'), {
        // The countdown leaves two seconds to see it: it is looked at often.
        intervals: [100],
        message: 'the ghost never got painted',
      })
      .toMatchObject({ visible: true })
    expect(await findInScene(page, 'hint-controller')).toMatchObject({ visible: true })

    // In the last second of the countdown both leave; the footprints, painted on the floor, stay.
    await expect
      .poll(async () => (await findInScene(page, 'hint-stick'))?.visible, { timeout: 6_000 })
      .toBe(false)
    expect(await findInScene(page, 'hint-controller')).toMatchObject({ visible: false })
    expect(await findInScene(page, 'hint-footprint-0')).toMatchObject({ visible: true })
  })
})
