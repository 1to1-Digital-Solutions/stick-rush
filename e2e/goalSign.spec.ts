import { expect, test } from '@playwright/test'

import { XR_SIGN_POSITION } from '../src/lib/xrLayout'
import type { Goal } from '../src/lib/goal'
import { installDrawCallCounter, medianDrawCalls } from './support/scenery'
import { findInScene, hideInScene, lookAtInScene, openHost, finishedRuns } from './support/host'
import { drawCallBudget } from './support/budget'

/**
 * The goal sign, mounted as the hall mounts it: the scene inside someone else's Canvas,
 * with the `challenge` and the medal thresholds (`goal`).
 *
 * What it says and whether it can be read is measured by the unit tests (`machineSign.legible.test.ts`); here
 * what is checked is what is only seen with the scene painting: that it hangs where the layout says
 * from the countdown to the end, and **what it costs**: one draw call, two at
 * most (`xrcade.budget.drawCalls` of the manifest).
 */

/** Stick Rush's thresholds in the hall. */
const GOAL: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: null,
  mode: 'challenge',
}

const SIGN = drawCallBudget('goal-sign')
const NAME = 'cartel-de-objetivo'

/**
 * Where the sign ends up with no headset: the ui is planted in front of the host's camera
 * (`XRGazeAnchor`), which is 60 cm behind the origin.
 */
const CAMERA_Z = 0.6
const WHERE: readonly [number, number, number] = [XR_SIGN_POSITION[0], XR_SIGN_POSITION[1], CAMERA_Z + XR_SIGN_POSITION[2]]

test('with the hall\'s challenge, the sign hangs above the scoreboard and costs one draw call', async ({ page }) => {
  // A whole run in real time: with software WebGL the fall stretches.
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installDrawCallCounter(page)
  await openHost(page, undefined, { challenge: 20260925, goal: GOAL })

  // From the countdown: the mission is read before the first stick falls.
  await expect
    .poll(() => findInScene(page, NAME), { message: 'the goal sign never got hung' })
    .toMatchObject({ visible: true })
  const sign = await findInScene(page, NAME)
  expect(sign!.x).toBeCloseTo(WHERE[0], 2)
  expect(sign!.y).toBeCloseTo(WHERE[1], 2)
  expect(sign!.z).toBeCloseTo(WHERE[2], 2)

  // Without touching anything the challenge ends by itself with the third life, and the sign is still there to say
  // what was missing. With the run over the scene is still: that is where it is measured.
  await expect
    .poll(() => finishedRuns(page), { timeout: 90_000, message: 'the scene did not report the end of the challenge' })
    .toEqual([{ mode: 'challenge', points: 0, challenge: true }])
  await expect.poll(() => findInScene(page, NAME)).toMatchObject({ visible: true })

  // What the sign costs: the calls with it minus the calls without it, looking at it head on
  // so that the camera's culling does not discard it.
  await lookAtInScene(page, WHERE)
  const withSign = await medianDrawCalls(page)
  expect(await hideInScene(page, NAME, true)).toBe(true)
  const withoutSign = await medianDrawCalls(page)
  expect(await hideInScene(page, NAME, false)).toBe(true)

  console.log(`[sign] the goal sign: ${withSign - withoutSign} calls (${withoutSign} without it, ${withSign} with it)`)
  expect(withSign - withoutSign).toBeGreaterThanOrEqual(SIGN.min)
  expect(withSign - withoutSign).toBeLessThanOrEqual(SIGN.max)
  expect(errors).toEqual([])
})

test('with no challenge nor run, in the menu, there is no sign', async ({ page }) => {
  await openHost(page, undefined, { goal: GOAL })

  // The menu is the first thing the scene mounts; the sign only hangs with the run under way.
  await expect.poll(() => findInScene(page, 'world-anchor')).not.toBeNull()
  expect(await findInScene(page, NAME)).toBeNull()
})
