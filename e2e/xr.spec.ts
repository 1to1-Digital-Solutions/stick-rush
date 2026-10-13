import { expect, test } from '@playwright/test'
import { HOOP_ADJUST_KEY } from '@/lib/hoopHeight'
import { COUNTDOWN_SECONDS } from '@/lib/gameStore'
import {
  TUTORIAL_SECONDS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
} from '@/lib/tutorial'
import { xrPlayButtonPosition } from '@/lib/xrLayout'
import { openGame } from './helpers'
import {
  aimHandAt,
  enterVR,
  exitXR,
  installXREmulator,
  placeHand,
  pressAndRelease,
  pressPlayInsideSession,
  startGameInsideSession,
  toPoint,
  tutorialNextButton,
  tutorialPhrase,
  tutorialSkipButton,
} from './support/xr'

/**
 * How long the lesson takes to be able to come out: the whole countdown and the margin
 * the run is started with inside the session. Before that there are no
 * sticks falling, and the lesson is learnt by catching them.
 */
const WAIT_UNTIL_PLAYING = (COUNTDOWN_SECONDS + 5) * 1000

/**
 * How long the lesson lasts if nobody catches anything: from safety deadline to safety
 * deadline, which is the worst case `TUTORIAL_SECONDS` counts.
 */
const TOTAL_DEADLINE = TUTORIAL_SECONDS

/**
 * Immersive mode, on a Quest 3 emulated with IWER.
 *
 * Chromium ships no WebXR, so without the emulator these paths never
 * run: the other tests enter through the mouse, which is different code. Here a
 * real session is opened and it is checked what state it leaves the game in.
 *
 * The state is observed through the DOM: in an immersive session the player does not see it,
 * but the overlays are still mounted, so the desktop menu and the
 * scoreboard serve as a mirror of which phase the run is in.
 *
 * **What these tests do NOT cover:** moving the controllers and pressing their buttons. The
 * emulator delivers a session, two `inputSources`, ~125 fps and `controller` mode,
 * but the pointers of @react-three/xr do not get to emit events on the
 * objects of the scene (checked with a sweep of positions, with grip,
 * touch and ray, and with the buttons listening to `pointerdown`). So the
 * grip of the sticks **with a controller** and the buttons of the 3D menu can only be
 * validated on hardware. Beware: this must no longer be used as an alibi. For a long
 * time it covered a real failure —the controllers did not get registered because their
 * profile was downloaded from a CDN the CSP blocks—, which could indeed have been
 * detected by looking at the console inside the session. Hence the test that
 * watches it. And with **bare hands** it does engage: `hands.spec.ts` catches a
 * real stick, so the limitation belongs to the emulator's `controller` mode and
 * not to the game not receiving events.
 *
 * What is indeed covered with no browser, in `src/lib`: which pointer can
 * catch a stick (`xrInteraction.test.ts`), and that the ui always ends up
 * in front of the player and inside their field of view (`xrAnchor.test.ts` and the
 * layout block of `xrInteraction.test.ts`) — which is just the failure that made
 * the immersive mode unusable.
 */

test.describe('Immersive session', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await openGame(page)
  })

  test('with WebXR available the entry to the headset appears', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Enter the headset' }),
    ).toBeVisible()
  })

  test('entering VR leads to the menu and does not start a run by itself', async ({
    page,
  }) => {
    await enterVR(page)

    // If it had started, the menu would have given way to the scoreboard. This was the
    // behaviour that was seen with the headset on.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('the sticks are not released while in the menu', async ({ page }) => {
    await enterVR(page)

    // Time to spare for them, with the clock running, to have already fallen.
    await page.waitForTimeout(4000)

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  // Pending because of a limitation of the emulator, not of the app. It has been retried
  // after fixing the registration of controllers (which was a real failure: without the local
  // profile the `XRControllerState` was not created and there were no pointers that were any good),
  // with the buttons listening to `pointerdown` and with the session confirmed in
  // `controller` mode, two `inputSources` and the console clean. Even so IWER does not get
  // to propagate its poses to the pointers. It is left written to enable it if the
  // emulator improves, and because it describes what has to be tried by hand in the headset.
  test.fixme('the run can be started by pointing at the button of the 3D menu', async ({
    page,
  }) => {
    await enterVR(page)

    // Hand to one side, at chest height, pointing at the start button.
    await placeHand(page, 'right', { x: 0.25, y: 1.25, z: -0.15 })
    await aimHandAt(page, 'right', toPoint(xrPlayButtonPosition()))
    await pressAndRelease(page, 'right', 'trigger')

    // If the ray engaged, the run starts and the scoreboard appears.
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('the session mounts controllers and ui without dirtying the console', async ({
    page,
  }) => {
    // Inside the session code is mounted that no desktop test touches:
    // the hand-drawn controller, the trigger's hint and the anchor that follows the
    // gaze. If any of them blew up, it would show here.
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await enterVR(page)
    await startGameInsideSession(page)
    // A few seconds of run: the anchor and the hint run on every frame.
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })

  test('leaving the session goes back to the desktop menu', async ({ page }) => {
    await enterVR(page)

    await startGameInsideSession(page)
    await expect(page.getByRole('status')).toBeVisible()

    await exitXR(page)

    // Going back to the menu on leaving only happens if the app detected the immersive mode
    // (`XRSessionController` remembers that there was a session), so this test
    // also proves that the mode is recognised.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})

/**
 * First-time tutorial.
 *
 * What whoever plays sees is the panel inside the headset with the gesture drawn, and
 * that can only be judged with the goggles on. What is indeed checked here
 * is the contract: that it comes out the first time and only the first, that it comes out **with
 * the run under way** and not before, that one can move on a step and that one can
 * always get out. The buttons that are pressed are the DOM reflection of the ones of the
 * panel —both call the same thing—, because the emulator does not propagate the
 * controllers' pointers (see the note above).
 */
test.describe('Tutorial in the headset', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await openGame(page)
  })

  test('the first run teaches, but only when play is already under way', async ({
    page,
  }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)

    // During the countdown there is nothing to catch: the lesson is learnt
    // by catching sticks, so it waits for them to start falling.
    await expect(page.getByRole('timer')).toBeVisible()
    await expect(tutorialSkipButton(page)).toHaveCount(0)

    // And as soon as play starts, it comes out with its two exits at hand.
    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    await expect(tutorialNextButton(page)).toBeVisible()
  })

  test('the run does not stop in order to teach', async ({ page }) => {
    // It is the difference from the demonstration of before: whoever watched it without doing
    // anything came out just as they went in. Now the sticks fall while it is explained.
    await enterVR(page)
    await pressPlayInsideSession(page)

    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    await expect(page.getByRole('timer')).toHaveCount(0)
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('the next button moves on a step, and the second one finishes it', async ({
    page,
  }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)

    const next = tutorialNextButton(page)
    await expect(next).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    const first = (await tutorialPhrase(page).textContent()) ?? ''

    await next.focus()
    await page.keyboard.press('Enter')
    await expect(tutorialPhrase(page)).not.toHaveText(first)

    await next.focus()
    await page.keyboard.press('Enter')
    await expect(next).toHaveCount(0)
  })

  test('and if nobody does anything, it withdraws by itself on deadline', async ({ page }) => {
    // A step that is not achieved —because the sticks get away— would leave someone
    // locked in it with the panel in front of their face the whole run.
    await enterVR(page)
    await pressPlayInsideSession(page)

    const skip = tutorialSkipButton(page)
    await expect(skip).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    await expect(skip).toHaveCount(0, { timeout: (TOTAL_DEADLINE + 6) * 1000 })
    // And the run goes on where it was: it never got to stop.
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('it can be skipped as soon as it appears', async ({ page }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)

    const skip = tutorialSkipButton(page)
    await expect(skip).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    await skip.focus()
    await page.keyboard.press('Enter')

    // Skipping it does not touch the run, which goes on exactly where it was.
    await expect(skip).toHaveCount(0)
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('only the first time: on opening the game again it no longer appears', async ({
    page,
  }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)

    // The first time it does come out, and skipping it counts it as seen.
    const skip = tutorialSkipButton(page)
    await expect(skip).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(skip).toHaveCount(0)

    // Reloading rebuilds the game from scratch: the only thing that survives is what
    // was saved in the browser.
    await openGame(page)
    await enterVR(page)
    await pressPlayInsideSession(page)

    await page.waitForTimeout(WAIT_UNTIL_PLAYING)
    await expect(tutorialSkipButton(page)).toHaveCount(0)
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('whoever already saw it on another visit goes straight in to play', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE] as [string, string],
    )
    await openGame(page)
    await enterVR(page)
    await pressPlayInsideSession(page)

    await page.waitForTimeout(WAIT_UNTIL_PLAYING)
    await expect(tutorialSkipButton(page)).toHaveCount(0)
  })

  test('whoever saw the old lesson sees it again: it is not the same one', async ({
    page,
  }) => {
    // What is saved is the version of the lesson. Version 1 was the demonstration by
    // clock, with the run queued, and it was not done by playing.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '1'),
      TUTORIAL_SEEN_KEY,
    )
    await openGame(page)
    await enterVR(page)
    await pressPlayInsideSession(page)

    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
  })

  test('the lesson is painted without dirtying the console', async ({ page }) => {
    // It mounts geometry no other test touches: the panel with the gesture drawn
    // and the model of the real controller put over the two hands, which arrives in
    // a `.glb` with the textures inside the file.
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await enterVR(page)
    await pressPlayInsideSession(page)
    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: WAIT_UNTIL_PLAYING })
    // Enough to go through the two steps of the script.
    await page.waitForTimeout((TOTAL_DEADLINE + 1) * 1000)

    expect(errors).toEqual([])
    await expect(page.getByRole('status')).toBeVisible()
  })
})

/**
 * Hoop height saved from another visit.
 *
 * What can be checked here is the **start**: that a correction already
 * saved enters the scene without breaking it, even if what is saved is an
 * outrage nobody could have chosen in the menu. Pressing the buttons that
 * change it is still a matter for the hardware (see the note above about the
 * emulator); the rule of what is accepted and what is discarded is covered with no
 * browser in `src/lib/hoopHeight.test.ts`.
 */
test.describe('Saved hoop height', () => {
  test('a tampered correction breaks neither the scene nor the session', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await installXREmulator(page)
    // What can really knock the scene down: something that is not a number. Without the
    // guard of `parseHoopAdjustment`, the `NaN` travels as far as the positions of the
    // hoop and three starts complaining through the console about impossible radii and boxes,
    // with the machine not drawn.
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [HOOP_ADJUST_KEY, 'a hand span higher'] as const,
    )

    await openGame(page)
    await enterVR(page)
    await startGameInsideSession(page)
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
    await expect(page.getByRole('status')).toBeVisible()
  })
})
