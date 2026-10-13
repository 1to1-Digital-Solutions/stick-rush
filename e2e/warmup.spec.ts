import { expect, test } from '@playwright/test'
import { COUNTDOWN_SECONDS } from '@/lib/gameStore'
import { openGame } from './helpers'
import { enterVR, installXREmulator, pressPlayInsideSession, tutorialSkipButton } from './support/xr'

/**
 * The warm-up, with the emulated headset and **without the tutorial seen** (`lib/warmup.ts`).
 *
 * The emulator does not take the hand up to the sticks, so the missed gesture is the easiest one to
 * provoke: catching nothing and letting the sticks reach the floor. With the lesson in front, in the
 * challenge, that costs no lives nor ends the run; on closing it, the challenge starts from zero.
 */
test.describe('The warm-up', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    // Where the sticks are and whether they can be caught: the one on the floor no longer can.
    await page.addInitScript(() => {
      window.__stickRushSticks = {}
    })
    // The challenge, which is the one that gives a medal and the one the menu opens with.
    await openGame(page, '/', { mode: 'Challenge' })
  })

  test('three sticks on the floor with the lesson in front leave the challenge intact', async ({ page }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)
    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: (COUNTDOWN_SECONDS + 5) * 1000 })

    await expect
      .poll(
        () => page.evaluate(() => Object.values(window.__stickRushSticks ?? {}).filter((stick) => !stick.catchable).length),
        { message: 'three sticks have not reached the floor', timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(3)

    // The warm-up goes on: the lesson in front, the three lives and no ending.
    await expect(tutorialSkipButton(page)).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Lives 3 of 3/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Skipping the lesson starts the challenge from zero: another countdown, no stick resolved.
    await tutorialSkipButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('timer')).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Lives 3 of 3\. Caught 0 of 13/)
    // And the sign says so, in its reflection on the website, during the countdown.
    await expect(page.getByText('Now it counts for a medal')).toBeVisible()
  })
})
