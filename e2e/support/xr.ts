import { expect, type Page } from '@playwright/test'
import { XR_EMULATOR_BUNDLE } from './globalSetup'

export type Point = { x: number; y: number; z: number }

/** Converts an `xrLayout` position (tuple) to the point the emulator uses. */
export function toPoint([x, y, z]: [number, number, number]): Point {
  return { x, y, z }
}
type Hand = 'left' | 'right'

/** API the emulator exposes on the page under `window.__xrTest`. */
interface XRTestApi {
  hasSession: () => boolean
  place: (hand: Hand, target: Point) => void
  aim: (hand: Hand, target: Point) => void
  press: (hand: Hand, button: 'squeeze' | 'trigger', value?: number) => void
  seat: (eyeHeight: number) => void
  /** Turns the head, in degrees: to the left and upwards as positive. */
  lookAt: (yaw: number, pitch?: number) => void
  useHands: () => void
  placeBareHand: (hand: Hand, target: Point) => void
  pinch: (hand: Hand, pressed: boolean) => void
  endSession: () => Promise<void>
}

declare global {
  interface Window {
    __xrTest: XRTestApi
  }
}

/**
 * Installs the WebXR emulator. It has to be called **before** `page.goto`: the
 * runtime has to exist when the app checks `navigator.xr`.
 */
export async function installXREmulator(page: Page) {
  await page.addInitScript({ path: XR_EMULATOR_BUNDLE })
}

/**
 * Enters an immersive session by pressing the real button of the menu.
 *
 * There is a single entry button: the session opens in `immersive-ar` when the
 * headset supports it, because it is the one that lets scenery and passthrough be toggled without
 * reopening it (see `XRWrapper`).
 *
 * Besides waiting for the session to exist, it waits for the app to have settled
 * its state: `XRSessionController` reacts to the entry with an effect that
 * leads to the menu, and acting before it runs makes that effect cancel
 * afterwards what the test had just done.
 */
export async function enterVR(page: Page) {
  await page.getByRole('button', { name: 'Enter the headset' }).click()
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'the immersive session did not start',
    })
    .toBe(true)
  await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
}

/** Leaves the immersive session, as when taking the headset off. */
export async function exitXR(page: Page) {
  await page.evaluate(() => window.__xrTest.endSession())
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'the immersive session did not close',
    })
    .toBe(false)
}

/** Places the hand at a point and orients it towards where the player looks. */
export async function placeHand(page: Page, hand: Hand, target: Point) {
  await page.evaluate(
    ([h, t]) => window.__xrTest.place(h as Hand, t as Point),
    [hand, target] as const,
  )
  // A couple of frames for the runtime to propagate the pose to the scene.
  await page.waitForTimeout(120)
}

/**
 * Seats the player: puts their head at that height above the floor.
 *
 * It is the only thing that tells whoever plays standing from whoever plays seated. With the
 * world «a la altura de mis ojos», the game measures this height and lowers the scene
 * down to it (see `XRWorldHeight`).
 */
export async function seatPlayer(page: Page, eyeHeight: number) {
  await page.evaluate((h) => window.__xrTest.seat(h as number), eyeHeight)
  await page.waitForTimeout(200)
}

/**
 * Puts the controllers down and switches to bare hands.
 *
 * It is the headset's other input mode: whoever has no controllers at hand —or cannot
 * hold them— plays like this. From here on `moveBareHand` and `pinchHand`
 * are the only thing that moves the player; `placeHand` and `pressAndRelease` command
 * controllers that are already disconnected.
 */
export async function useBareHands(page: Page) {
  await page.evaluate(() => window.__xrTest.useHands())
  await page.waitForTimeout(200)
}

/** Takes a bare hand to a point of the world. */
export async function moveBareHand(page: Page, hand: Hand, target: Point) {
  await page.evaluate(
    ([h, t]) => window.__xrTest.placeBareHand(h as Hand, t as Point),
    [hand, target] as const,
  )
  await page.waitForTimeout(120)
}

/** Closes or opens the bare hand on whatever is in front of it. */
export async function pinchHand(page: Page, hand: Hand, pressed: boolean) {
  await page.evaluate(
    ([h, p]) => window.__xrTest.pinch(h as Hand, p as boolean),
    [hand, pressed] as const,
  )
  await page.waitForTimeout(120)
}

/** Points the hand's ray towards a point, without moving it from its place. */
export async function aimHandAt(page: Page, hand: Hand, target: Point) {
  await page.evaluate(
    ([h, t]) => window.__xrTest.aim(h as Hand, t as Point),
    [hand, target] as const,
  )
  await page.waitForTimeout(120)
}

/** Presses and releases a button of the controller. */
export async function pressAndRelease(
  page: Page,
  hand: Hand,
  button: 'squeeze' | 'trigger',
) {
  await page.evaluate(
    ([h, b]) => window.__xrTest.press(h as Hand, b as 'squeeze' | 'trigger', 1),
    [hand, button] as const,
  )
  await page.waitForTimeout(120)
  await page.evaluate(
    ([h, b]) => window.__xrTest.press(h as Hand, b as 'squeeze' | 'trigger', 0),
    [hand, button] as const,
  )
  await page.waitForTimeout(120)
}

/**
 * Presses «empezar» while already inside the immersive session.
 *
 * The immersive canvas swallows the clicks, so the keyboard is used on the
 * overlay. It is retried because on entering the session the document may lose
 * focus for an instant and the key press goes into the void.
 *
 * The run starts with its countdown, and the first time in this browser
 * also **with the lesson on** as soon as sticks start falling (see
 * `XRTutorial`): whoever wants the screen clean uses `startGameInsideSession`.
 */
export async function pressPlayInsideSession(page: Page, attempts = 8) {
  const score = page.getByRole('status')
  for (let attempt = 0; attempt < attempts; attempt++) {
    await page.getByRole('button', { name: 'Play', exact: true }).focus()
    await page.keyboard.press('Enter')

    // It is not enough for the scoreboard to appear: if the run starts in the gap
    // between the session existing and `XRSessionController` registering that there was a
    // session, its effect discards it right afterwards (entering the headset with a
    // run half way through goes back to the menu on purpose). It is confirmed that it persists.
    await page.waitForTimeout(400)
    if (await score.count()) return

    await page.waitForTimeout(200)
  }
  throw new Error(
    `The run could not be started inside the session in ${attempts} attempts`,
  )
}

/**
 * The lesson's buttons and the phrase they explain. They are the DOM reflection of
 * what the 3D panel paints: both call the same thing, and these are also
 * reached with the keyboard (the 3D ones have to be pointed at with the controller, which the
 * emulator cannot do).
 */
export function tutorialSkipButton(page: Page) {
  return page.getByRole('button', { name: 'Skip tutorial' })
}

export function tutorialNextButton(page: Page) {
  return page.getByRole('button', { name: 'Next' })
}

export function tutorialPhrase(page: Page) {
  return page.getByRole('note')
}

/**
 * Takes the lesson out of the way if the game has put it up (only the first time).
 *
 * **It waits until it can come out** instead of looking at whether it is there: it does not come out until
 * real play happens, and asking before the first stick falls would always say
 * there is nothing to skip —and the lesson would appear later, on top of what
 * the test was checking.
 */
export async function skipTutorialIfShown(page: Page) {
  const skip = tutorialSkipButton(page)
  await expect(page.getByRole('timer')).toHaveCount(0, { timeout: 10_000 })
  if ((await skip.count()) === 0) return

  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(skip).toHaveCount(0)
}

/**
 * Starts a run while already inside the immersive session and leaves the
 * screen clean, taking the lesson away if it is the first time in this browser.
 */
export async function startGameInsideSession(page: Page, attempts = 8) {
  await pressPlayInsideSession(page, attempts)
  await skipTutorialIfShown(page)
}

/**
 * Turns the headset's head: `yaw` to the left and `pitch` upwards, in degrees.
 *
 * The emulator always enters looking straight ahead, and what has to be seen is sometimes not there: the
 * floor hints, at the feet.
 */
export async function lookAt(page: Page, yaw: number, pitch = 0) {
  await page.evaluate(([y, p]) => window.__xrTest.lookAt(y, p), [yaw, pitch] as const)
}
