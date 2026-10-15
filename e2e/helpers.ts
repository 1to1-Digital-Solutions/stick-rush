import { expect, type Page } from '@playwright/test'

/** A point in pixels inside the canvas. */
export interface ScreenPoint {
  x: number
  y: number
}

/**
 * Opens the game, waits for the 3D scene to be mounted and painting and leaves **practice**
 * chosen, which is what almost all of these tests play: that is where the sticks and the
 * speed are chosen. The menu opens on the challenge —`mode.spec.ts` checks it—; whoever wants
 * what is there on opening passes `mode: null`.
 *
 * The Canvas is loaded with `lazy()` and only in the browser (see `GameScene`), so
 * on reaching the HTML it does not exist yet. Besides, R3F does not size the canvas
 * until the first `requestAnimationFrame`, which does not run if the tab is
 * in the background: waiting for it to have a size is what tells "loading"
 * from "ready".
 */
export async function openGame(
  page: Page,
  path = '/',
  { mode = 'Practice' }: { mode?: ModeName | null } = {},
) {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  if (mode != null) await modeButton(page, mode).click()
  if (mode === 'Practice') await showMoreOptions(page)
}

/**
 * Unfolds what the menu leaves folded behind «Más opciones» (the sticks, the speed and the
 * length of the practice), if it is folded.
 */
export async function showMoreOptions(page: Page) {
  const more = page.getByRole('button', { name: 'More options' })
  if (await more.isVisible()) await more.click()
}

/**
 * A mode's button in the menu. Its accessible name drags the hint line along
 * ("Challenge Counts for a medal. Three lives…"), so it is looked up by how it starts.
 */
export type ModeName = 'Practice' | 'Levels' | 'Challenge'

export function modeButton(page: Page, mode: ModeName) {
  return page.getByRole('button', { name: new RegExp(`^${mode}`) })
}

/**
 * Sets the run up in the menu and starts it.
 *
 * Only practice asks for sticks and difficulty: in Levels the level says them and
 * the challenge is fixed (`CHALLENGE_SETUP`), so there `sticks` is what is
 * expected to be seen on the scoreboard and not what is pressed. Endless, the scoreboard
 * does not say «de N»: the sticks do not run out.
 */
export async function startGame(
  page: Page,
  {
    sticks,
    difficulty,
    mode,
    endless = false,
  }: { sticks: number; difficulty?: string; mode?: ModeName; endless?: boolean },
) {
  // With no mode said, practice is played: the menu opens on the challenge, which is fixed.
  await modeButton(page, mode ?? 'Practice').click()
  if (mode === undefined || mode === 'Practice') {
    await showMoreOptions(page)
    await page.getByRole('button', { name: String(sticks), exact: true }).click()
    if (difficulty) {
      await page.getByRole('button', { name: difficulty, exact: true }).click()
    }
    if (endless) await page.getByRole('button', { name: /^Endless/ }).click()
  }
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByRole('status')).toHaveAttribute(
    'aria-label',
    endless
      ? /Caught 0, endless, set 1$/
      : new RegExp(`Caught 0 of ${sticks}$`),
  )
  // The run does not start on pressing, but when the countdown runs out.
  // Returning earlier would leave the tests trying to catch sticks that still
  // hang still and cannot be caught.
  await expect(page.getByRole('timer')).toBeHidden()
}

/** Sticks caught according to the scoreboard. */
export async function readScore(page: Page): Promise<number> {
  const label = await page.getByRole('status').getAttribute('aria-label')
  const match = label?.match(/Caught (\d+)(?: of (\d+)|, endless)/)
  if (!match) throw new Error(`Unreadable scoreboard: ${label}`)
  return Number(match[1])
}

/**
 * Lives left according to the scoreboard, or `null` if the run is not played with
 * them. They come from the same announcement as the score: the hearts are a drawing
 * and what a screen reader hears is this text.
 */
export async function readLives(page: Page): Promise<number | null> {
  const label = await page.getByRole('status').getAttribute('aria-label')
  const match = label?.match(/Lives (\d+) of (\d+)/)
  return match ? Number(match[1]) : null
}

/** Points accumulated according to the scoreboard. */
export async function readPoints(page: Page): Promise<number> {
  const label = await page.getByRole('status').getAttribute('aria-label')
  const match = label?.match(/^([\d,]+) points/)
  if (!match) throw new Error(`Unreadable scoreboard: ${label}`)
  return Number(match[1].replace(/\./g, ''))
}

/**
 * Locates a catchable stick by sweeping the canvas with the pointer.
 *
 * There is no way of selecting a 3D object from the DOM, so the signal the game
 * itself gives the player is used: `Stick` sets the cursor to `pointer`
 * while the stick can be caught. The sweep goes from top to bottom, so that it
 * finds first the sticks that still hang from the hoop (the highest ones): they sway
 * a few millimetres, so they barely move between finding them and clicking,
 * compared with the ones already falling.
 */
export async function findCatchableStick(
  page: Page,
  { step = 4 }: { step?: number } = {},
): Promise<ScreenPoint | null> {
  return page.evaluate((stepPx) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const cursorBefore = document.body.style.cursor

    for (let y = rect.top + stepPx; y < rect.bottom; y += stepPx * 2) {
      for (let x = rect.left + stepPx; x < rect.right; x += stepPx) {
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        )
        if (document.body.style.cursor === 'pointer') {
          return { x, y }
        }
      }
    }

    document.body.style.cursor = cursorBefore
    return null
  }, step)
}

/** The cursor on `pointer` is the signal that there is a stick under the pointer. */
export async function isPointingAtStick(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.style.cursor === 'pointer')
}

/**
 * Locates a point of the canvas where there is a stick **hanging from the hoop**, not one
 * falling.
 *
 * The sweep does not tell one from the other, so the candidate is confirmed a couple
 * of seconds later by placing the mouse on top: the stick that hangs is still
 * exactly where it was and the one that was falling has already left the spot (on Easy it drops
 * half a metre in that while). As the hoop's anchors depend only on how many
 * sticks the run has, the point is still good in the next one with the same
 * number of sticks.
 */
export async function findHangingStick(
  page: Page,
  { attempts = 4 }: { attempts?: number } = {},
): Promise<ScreenPoint> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = await findCatchableStick(page)
    if (!candidate) continue

    await page.waitForTimeout(2000)
    // In steps: with a single jump the scene does not get to register the stick
    // underneath, just as it would not register a teleported mouse.
    await page.mouse.move(candidate.x, candidate.y, { steps: 8 })
    if (await isPointingAtStick(page)) return candidate
  }

  throw new Error(`No hanging stick was found in ${attempts} attempts`)
}

/**
 * Catches a stick that still hangs from the hoop and returns where it was.
 *
 * It is `catchStick` restricted to the case the product decision fixes: the stick
 * is caught before it is released too. It is retried because between confirming the
 * stick and pressing its turn may have come right then, and there the click
 * lands in a gap.
 */
export async function catchHangingStick(
  page: Page,
  { attempts = 2 }: { attempts?: number } = {},
): Promise<ScreenPoint> {
  const scoreBefore = await readScore(page)

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Leaves the mouse over the stick and confirms the hover: only pressing is left.
    const hanging = await findHangingStick(page)
    await page.mouse.down()
    await page.mouse.up()

    if ((await readScore(page)) > scoreBefore) return hanging
  }

  throw new Error(
    `No hanging stick could be caught in ${attempts} attempts (scoreboard: ${scoreBefore})`,
  )
}

/**
 * Catches a stick and returns the point where the click was made.
 *
 * The sweep locates a candidate with synthetic events (instantaneous), but
 * before pressing the real mouse is placed and the hover is confirmed: between the
 * sweep and the click the stick has kept falling, so the point may have been
 * left behind. If the candidate is no longer good, it sweeps again.
 */
export async function catchStick(
  page: Page,
  { attempts = 12 }: { attempts?: number } = {},
): Promise<ScreenPoint> {
  const scoreBefore = await readScore(page)

  for (let attempt = 0; attempt < attempts; attempt++) {
    const target = await findCatchableStick(page)
    if (!target) continue

    await page.mouse.move(target.x, target.y)
    if (!(await isPointingAtStick(page))) continue

    await page.mouse.down()
    await page.mouse.up()

    if ((await readScore(page)) > scoreBefore) return target
  }

  throw new Error(
    `No stick could be caught in ${attempts} attempts (scoreboard: ${scoreBefore})`,
  )
}

/** Waits for the end-of-run dialog. */
export async function waitForGameOver(page: Page, timeout = 60_000) {
  await expect(page.getByRole('dialog')).toBeVisible({ timeout })
}
