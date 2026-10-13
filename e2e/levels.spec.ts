import { expect, test } from '@playwright/test'
import { LEVEL_COUNT } from '@/lib/levels'
import { UNLOCKED_LEVEL_KEY } from '@/lib/progress'
import { catchStick, modeButton, openGame, startGame, waitForGameOver } from './helpers'

/**
 * Levels mode.
 *
 * The whole journey: the ladder in the menu with only the first one open,
 * playing the level with the sticks and the speed it says, the stars at
 * the end and the next one that opens and stays open on coming back. The ladder and
 * the stars themselves are fixed by the unit tests of `levels.ts` and `progress.ts`.
 */

test.describe('Levels mode', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('the ladder starts with only the first level open and says what it brings', async ({
    page,
  }) => {
    await modeButton(page, 'Levels').click()

    const section = page.getByRole('region', { name: 'Level' })
    await expect(section.getByRole('button')).toHaveCount(LEVEL_COUNT)
    await expect(section.getByRole('button', { name: 'Level 1, 0 stars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section.getByRole('button', { name: 'Level 2, locked' })).toBeDisabled()
    await expect(section).toContainText('Level 1: 5 sticks on Easy.')

    // The sticks and the speed are said by the level: their selectors go away.
    await expect(page.getByRole('region', { name: 'Number of sticks' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Difficulty' })).toBeHidden()
  })

  test('clearing the level gives stars, opens the next one and the menu moves onto it', async ({
    page,
  }) => {
    // The first level is the slowest and with five sticks, which hang catchable
    // from the first second: there is time to empty the hoop.
    await startGame(page, { sticks: 5, mode: 'Levels' })
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Level 1\./)

    const dialog = page.getByRole('dialog')
    for (let attempt = 0; attempt < 5 && !(await dialog.isVisible()); attempt++) {
      await catchStick(page)
    }
    await waitForGameOver(page)

    await expect(dialog).toContainText('Level 1 cleared!')
    await expect(dialog.getByRole('img', { name: /star/ })).toBeVisible()
    await expect(dialog).toContainText('Level 2 unlocked')

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    const section = page.getByRole('region', { name: 'Level' })
    await expect(section.getByRole('button', { name: /^Level 2, \d stars?$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section).toContainText('Level 2: 9 sticks on Easy.')
  })

  test('not clearing the level opens nothing', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, '3'), UNLOCKED_LEVEL_KEY)
    await openGame(page)
    await modeButton(page, 'Levels').click()

    const section = page.getByRole('region', { name: 'Level' })
    // What is saved is remembered: it is entered by the highest one open.
    await expect(section.getByRole('button', { name: 'Level 3, 0 stars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section).toContainText('Level 3: 13 sticks on Easy.')

    // One can go back to one below, but not jump to a locked one.
    await section.getByRole('button', { name: 'Level 1, 0 stars' }).click()
    await expect(section).toContainText('Level 1: 5 sticks on Easy.')
    await expect(section.getByRole('button', { name: 'Level 4, locked' })).toBeDisabled()

    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Caught 0 of 5$/)
    // Without touching anything the five sticks crash: zero stars.
    await waitForGameOver(page, 90_000)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Level 1 not cleared')
    await expect(dialog.getByRole('img', { name: '0 stars' })).toBeVisible()
    await expect(dialog).not.toContainText('unlocked')
  })
})
