import { expect, test } from '@playwright/test'
import { openGame, startGame } from './helpers'

// Mobile screen on the same Chromium: only the viewport and the
// touch mode are changed, without dragging in the device preset's WebKit engine.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test.describe('On mobile', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('the menu fits across, with no horizontal scroll', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('all the controls reach the minimum touch size', async ({ page }) => {
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const name = (await button.textContent())?.trim()

      // It is measured with `poll` and not from a single reading: if the stylesheet has not
      // been applied yet (it happens on the first start after a clean build), the
      // button is measured without its real size and the test fails for a false reason.
      // WCAG 2.2 (minimum target) and the project's design rule.
      await expect
        .poll(async () => (await button.boundingBox())?.height ?? 0, {
          message: `insufficient height in "${name}"`,
        })
        .toBeGreaterThanOrEqual(44)
      await expect
        .poll(async () => (await button.boundingBox())?.width ?? 0, {
          message: `insufficient width in "${name}"`,
        })
        .toBeGreaterThanOrEqual(44)
    }
  })

  test('it can be played by touching the screen', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })
  })
})
