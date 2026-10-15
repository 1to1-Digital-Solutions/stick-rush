import { expect, test } from '@playwright/test'
import { catchHangingStick, modeButton, openGame, waitForGameOver } from './helpers'

/**
 * The two-player match, from end to end in the browser: choosing the challenge and two players, playing the
 * first one's round, seeing the notice to pass the controller, playing the second one's and seeing who wins and what
 * the pair has so far.
 *
 * The rules —the same seed, who wins, the tie— are tested by `lib/duel.ts` with no browser;
 * here it is checked that they reach the screen. Each round ends by itself with the third life.
 */
test('two players: the first one plays, passes the controller to the second and at the end who wins comes up', async ({ page }) => {
  await openGame(page)
  await modeButton(page, 'Challenge').click()
  await expect(page.getByRole('region', { name: 'Players' })).toBeVisible()
  await page.getByRole('button', { name: /^Duel/ }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // The scoreboard says whose round it is.
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toBeHidden()
  await catchHangingStick(page)
  await waitForGameOver(page)

  // The notice to pass the controller, and the start button worded for whoever is going to press it.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Pass the controller to Player 2.')
  await page.getByRole('button', { name: 'Player 2, your turn' }).click()

  await expect(page.getByText('Player 2', { exact: true })).toBeVisible()
  await waitForGameOver(page)

  // The first one caught one and the second none: the first wins, and it is noted down for the pair.
  await expect(dialog.getByRole('heading', { name: 'Player 1 wins' })).toBeVisible()
  await expect(dialog).toContainText('Duels won: 1–0 · tied: 0')

  // Back in the menu, what the pair has so far is still there, and the challenge's record has not been touched.
  await page.getByRole('button', { name: 'Back to the menu' }).click()
  await expect(page.getByText('Duels won: 1–0 · tied: 0')).toBeVisible()
  await page.getByRole('button', { name: /^Solo/ }).click()
  await expect(page.getByText(/Best score in/)).toHaveCount(0)
})
