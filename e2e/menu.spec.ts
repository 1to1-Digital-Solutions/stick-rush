import { expect, test, type Page } from '@playwright/test'
import { openGame } from './helpers'

/**
 * Leaves the machine in view and waits for it to be painted.
 *
 * The desktop menu is an opaque panel that covers the whole canvas, so
 * to look at the scene it has to be moved aside. And one has to wait: until the
 * HDRI and the wood textures arrive, the canvas is a rectangle of colour, and a
 * screenshot of that weighs a few kilobytes against the hundreds of the square.
 */
async function revealScene(page: Page) {
  await page.evaluate(() => {
    const menu = document.querySelector('main')
    if (menu instanceof HTMLElement) menu.style.display = 'none'
  })

  await expect
    .poll(async () => (await page.locator('canvas').screenshot()).length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(100_000)
}

/** How long is let pass between the two screenshots that are compared. */
const MOVEMENT_WINDOW = 600

async function canvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (box == null) throw new Error('the 3D scene is not mounted')
  return box
}

/**
 * Clip centred on the machine, in page coordinates.
 *
 * The measurements go in proportion to the **height** of the canvas —the camera's `fov` is
 * vertical— so that the clip keeps falling on the machine even if the
 * aspect ratio changes.
 */
function machineClip({ x, y, width, height }: Awaited<ReturnType<typeof canvasBox>>) {
  return {
    x: x + width / 2 - height * 0.195,
    y: y + height * 0.21,
    width: height * 0.39,
    height: height * 0.25,
  }
}

/**
 * Whether the scene changes between two instants.
 *
 * With the menu's panel moved aside and the DOM animations frozen, in the
 * menu only two things can move: the sticks swaying and the fairground's Ferris
 * wheel, which turns slowly on the periphery. Looking at the whole canvas, a
 * change can come from either of the two; with `onlyMachine` the screenshot is
 * clipped to the machine, very far from the Ferris wheel, and then it can only be the
 * swaying.
 */
async function sceneMoves(
  page: Page,
  { onlyMachine = false } = {},
): Promise<boolean> {
  const canvas = await canvasBox(page)
  const clip = onlyMachine ? machineClip(canvas) : canvas
  const before = await page.screenshot({ clip, animations: 'disabled' })
  await page.waitForTimeout(MOVEMENT_WINDOW)
  const after = await page.screenshot({ clip, animations: 'disabled' })
  return !before.equals(after)
}

test.describe('Start menu', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('presents the game over the 3D scene already mounted', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(
      page.getByText('Catch the sticks before they hit the ground.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })

  test('offers from 5 to 13 sticks, with 5 preselected', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Number of sticks' })
    const options = section.getByRole('button')
    await expect(options).toHaveCount(9)
    await expect(options.first()).toHaveText('5')
    await expect(options.last()).toHaveText('13')
    await expect(options.first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('changes the number of sticks and reflects it in the state of the button', async ({
    page,
  }) => {
    const nine = page.getByRole('button', { name: '9', exact: true })
    await nine.click()

    await expect(nine).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('offers the five difficulties, with Easy preselected', async ({
    page,
  }) => {
    const section = page.getByRole('region', { name: 'Difficulty' })
    await expect(section.getByRole('button')).toHaveCount(5)
    await expect(section.getByRole('button')).toHaveText([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Impossible',
    ])
    await expect(section.getByRole('button', { name: 'Easy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('only one difficulty is active at a time', async ({ page }) => {
    await page.getByRole('button', { name: 'Hard', exact: true }).click()

    await expect(
      page.getByRole('button', { name: 'Hard', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: 'Easy', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  test('the hanging sticks sway, so the machine does not look frozen', async ({
    page,
  }) => {
    await revealScene(page)

    expect(await sceneMoves(page, { onlyMachine: true })).toBe(true)
  })

  test('with reduced motion, nothing of the scene moves', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await revealScene(page)
    // The sticks that were already swaying take an instant to straighten up.
    await page.waitForTimeout(MOVEMENT_WINDOW)

    // Here the whole canvas is looked at: the preference has to stop both the
    // swaying of the sticks and the fairground's Ferris wheel.
    expect(await sceneMoves(page)).toBe(false)
  })

  test('hides the entry to the headset in a browser with no WebXR', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: /Enter/ })).toHaveCount(0)
  })

  test('requests nothing from external domains', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.hostname !== '127.0.0.1' && url.protocol.startsWith('http')) {
        external.push(request.url())
      }
    })

    await page.reload()
    await openGame(page)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('status')).toBeVisible()

    expect(external).toEqual([])
  })

  test('the /game route opens the same scene', async ({ page }) => {
    await openGame(page, '/game')
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })

  test('it can be walked through and played with the keyboard alone', async ({ page }) => {
    await page.getByRole('button', { name: '5', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '6', exact: true })).toBeFocused()

    await page.getByRole('button', { name: 'Play', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toBeVisible()
  })
})
