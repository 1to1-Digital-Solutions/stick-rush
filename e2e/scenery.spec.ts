import { expect, test, type Page } from '@playwright/test'
import { SCENERY_KEY } from '../src/lib/settings'
import { OWN_SCENERY_KEY } from '../src/lib/sceneryPreference'
import {
  lightCombinations,
  installDrawCallCounter,
  letSettle,
  chooseInSalon,
  storeBeforeOpen,
  readKey,
  medianDrawCalls,
  linkedPrograms,
  watchPrograms,
} from './support/scenery'
import { openGame } from './helpers'
import { enterVR, installXREmulator } from './support/xr'

/**
 * The scenery is chosen by the hall (`xrcade:scenery`), not by the kind of session nor by a setting of the game.
 *
 * The game's website is opened and it is entered through its button, which opens augmented reality when the headset
 * has it, like the hall: that way it is also checked that outside the hall the setting works the same, on
 * the game's origin and with the drawn place by default. There the kind of session is the same with
 * both choices, so the only thing that can take the square away is the scenery.
 */

/**
 * How many draw calls per frame, at the least, separate the square from the room.
 *
 * Here the margin is shorter than in other games: the fairground is instanced —one call per
 * family of parts—, so the whole square, with its ground and its backdrop, measures some
 * sixteen per frame, counting both eyes. The scenery selector does not change
 * parts on changing, only place, and adds none.
 */
const WHAT_THE_STAGE_PAINTS = 8

/**
 * Enters through the website's button, which opens augmented reality if the headset has it: the emulator's
 * Quest 3 has it, so it is the same session the hall enters.
 */
async function enterThroughTheWeb(page: Page) {
  await enterVR(page)
}

async function hasSession(page: Page) {
  return page.evaluate(() => window.__xrTest.hasSession())
}

test.describe('The scenery is chosen by the hall', () => {
  test.beforeEach(async ({ page }) => {
    await installDrawCallCounter(page)
    await installXREmulator(page)
  })

  test('with «room» the square is not painted and with «place» it is, without leaving the session', async ({ page }) => {
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openGame(page)
    await enterThroughTheWeb(page)

    const inTheRoom = await medianDrawCalls(page)
    await chooseInSalon(page, 'place')
    const withStage = await medianDrawCalls(page)
    console.log(`[scenery] calls per frame: room ${inTheRoom}, stage ${withStage}`)

    expect(withStage, 'with «place» in augmented reality the square was not painted').toBeGreaterThan(
      inTheRoom + WHAT_THE_STAGE_PAINTS,
    )
    // And going back to the room takes it away again, in the same session.
    await chooseInSalon(page, 'room')
    expect(await medianDrawCalls(page), 'with «room» the square kept being painted').toBeLessThan(
      withStage - WHAT_THE_STAGE_PAINTS,
    )
    expect(await hasSession(page), 'changing the scenery closed the session').toBe(true)
  })

  test('the game\'s own key does not rule: on «passthrough» and with nothing from the hall, the square is painted', async ({
    page,
  }) => {
    await storeBeforeOpen(page, OWN_SCENERY_KEY, 'passthrough')
    await openGame(page)
    await enterThroughTheWeb(page)

    const withTheOwnKey = await medianDrawCalls(page)
    // It was deleted on mounting the run, and without passing over to the hall's one: what the hall says rules.
    expect(await readKey(page, OWN_SCENERY_KEY), 'the game\'s own key is still stored').toBeNull()
    expect(await readKey(page, SCENERY_KEY), 'the game\'s own key was moved over to the hall\'s one').toBeNull()

    await chooseInSalon(page, 'room')
    const inTheRoom = await medianDrawCalls(page)
    console.log(`[scenery] calls per frame: own key ${withTheOwnKey}, room ${inTheRoom}`)

    expect(withTheOwnKey, 'the game\'s own key took the square away').toBeGreaterThan(
      inTheRoom + WHAT_THE_STAGE_PAINTS,
    )
  })

  test('toggling the scenery does not change the lights nor recompile any shader', async ({ page }) => {
    // The hitch on changing scenery with the headset on. Removing a light or the fog with
    // the square changes the program of everything that is lit, and unmounting the stage frees
    // its shaders, which are compiled again on coming back. The lights stay mounted —turned off
    // where they do not shine—, the fog moves away and the stage is hidden.
    await watchPrograms(page)
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openGame(page)
    await enterThroughTheWeb(page)
    await letSettle(page)

    // One whole lap first: what only exists in one of the two sceneries is compiled the
    // first time it is seen, and that happens once per visit, not on every change.
    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)
    const afterTheFirstLap = await linkedPrograms(page)

    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)

    const lights = await lightCombinations(page)
    console.log(`[scenery] lights it is painted with: ${lights.join(' | ')}`)
    expect(lights, 'the number of lights changed with the scenery').toHaveLength(1)
    expect(
      (await linkedPrograms(page)) - afterTheFirstLap,
      'changing scenery again recompiled shaders: that is a hitch with the headset on',
    ).toBe(0)
    expect(await hasSession(page), 'changing the scenery closed the session').toBe(true)
  })
})
