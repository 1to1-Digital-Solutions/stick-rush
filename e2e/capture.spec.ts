import { test } from '@playwright/test'
import { catchStick, openGame, startGame } from './helpers'

/**
 * Generates the screenshot that illustrates the README. It is not a check: it is skipped
 * unless it is asked for expressly, so as not to rewrite the PNG on every `test:e2e`.
 *
 *   npm run capture
 */
test.describe('README capture', () => {
  test.skip(!process.env.CAPTURE, 'run `npm run capture` to regenerate it')

  test('run in progress with the sticks falling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 810 })
    await openGame(page)
    await startGame(page, { sticks: 11, difficulty: 'Easy' })

    // A couple of sticks caught so that the scoreboard is seen running, and a
    // wait to catch several already released in mid fall.
    await catchStick(page)
    await catchStick(page)
    await page.waitForTimeout(3500)

    await page.screenshot({
      path: 'docs/gameplay.jpg',
      quality: 84,
      animations: 'disabled',
    })
  })
})
