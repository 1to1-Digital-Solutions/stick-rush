import { expect, test } from '@playwright/test'
import { ENDLESS_STREAK_KEY, HIGH_SCORE_KEYS } from '@/lib/highScore'
import { openGame, startGame, waitForGameOver } from './helpers'

/**
 * Endless practice.
 *
 * The sticks are created all at once with the run, so «sin fin» works by
 * rounds: when the one hanging is resolved, the machine reloads with another and the
 * run goes on until the player ends it. What is saved is not the
 * points —they grow with no cap— but the longest streak.
 */

test.describe('Endless practice', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('the length is only chosen in practice, and by default it is one round', async ({
    page,
  }) => {
    const section = page.getByRole('region', { name: 'Length' })
    await expect(section.getByRole('button', { name: /^Set/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section.getByRole('button', { name: /^Endless/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await page.getByRole('button', { name: /^Challenge/ }).click()
    await expect(section).toBeHidden()
  })

  test('on emptying the round the machine reloads instead of ending, and the player ends it', async ({
    page,
  }) => {
    // With the fastest fall the five sticks crash in seconds: there a
    // normal round would have ended, and this one goes on with new sticks.
    await startGame(page, { sticks: 5, difficulty: 'Impossible', mode: 'Practice', endless: true })

    const status = page.getByRole('status')
    await expect(status).toHaveAttribute('aria-label', /set 2$/, { timeout: 30_000 })
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: 'End run' }).click()
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Game over!')
    await expect(dialog).toContainText('endless')
    // With no ceiling there is no «de N posibles» to show.
    await expect(dialog).not.toContainText(/of [\d,]+ possible/)
  })

  test('what is saved is the streak, and the menu shows it as such', async ({ page }) => {
    await page.addInitScript(
      ([streakKey, pointsKey]) => {
        window.localStorage.setItem(streakKey, '7')
        window.localStorage.setItem(pointsKey, '99999')
      },
      [ENDLESS_STREAK_KEY, HIGH_SCORE_KEYS.practice] as const,
    )
    await openGame(page)

    await expect(page.getByText(/^Best score/)).toContainText('99,999')

    await page.getByRole('button', { name: /^Endless/ }).click()

    // The endless best is its own: the one of the practice by rounds is not lent to it.
    await expect(page.getByText(/^Best endless streak/)).toContainText('×7')
    await expect(page.getByText(/^Best score/)).toHaveCount(0)
  })
})
