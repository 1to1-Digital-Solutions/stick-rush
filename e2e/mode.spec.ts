import { expect, test } from '@playwright/test'
import { HIGH_SCORE_KEYS } from '@/lib/highScore'
import { DIFFICULTY_LABELS } from '@/lib/gameConfig'
import { CHALLENGE_SETUP } from '@/lib/gameMode'
import {
  catchStick,
  modeButton,
  openGame,
  readLives,
  startGame,
  waitForGameOver,
} from './helpers'

/**
 * Practice and challenge.
 *
 * What is played here is the whole journey of the new mode: choosing it in the
 * menu, seeing the lives during the run and the challenge closing on spending
 * the third. The rules themselves (when it ends, how many lives are left) are
 * fixed by the unit tests of `gameMode.ts`, which do not depend on the clock.
 */

test.describe('Game mode', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('the menu opens on the challenge: Play without touching anything starts it, with the mission in front', async ({ page }) => {
    await openGame(page, '/', { mode: null })

    const section = page.getByRole('region', { name: 'Mode' })
    await expect(section.getByRole('button')).toHaveCount(3)
    await expect(modeButton(page, 'Challenge')).toHaveAttribute('aria-pressed', 'true')
    await expect(modeButton(page, 'Practice')).toHaveAttribute('aria-pressed', 'false')
    // What each one puts at stake, and whether it counts for a medal, is read without entering the run.
    await expect(modeButton(page, 'Challenge')).toContainText('Counts for a medal. Three lives')
    await expect(modeButton(page, 'Practice')).toContainText('No medal')
    await expect(modeButton(page, 'Levels')).toContainText('No medal')

    await page.getByRole('button', { name: 'Play', exact: true }).click()

    // The mission is read head on while it counts, and what is played is the challenge: thirteen sticks and three lives.
    await expect(page.getByText('Catch 13 sticks. Drop three and out')).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      new RegExp(`Caught 0 of ${CHALLENGE_SETUP.stickCount}$`),
    )
    expect(await readLives(page)).toBe(3)

    // With the first stick resolved the mission makes room: what has been scored so far is already on the scoreboard.
    await expect.poll(() => readLives(page)).toBe(2)
    await expect(page.getByText('Catch 13 sticks. Drop three and out')).toBeHidden()
  })

  test('at the end, what is highlighted is «another»: it repeats the challenge without going through the menu', async ({ page }) => {
    await openGame(page, '/', { mode: null })
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    const another = dialog.getByRole('button', { name: 'Another challenge' })
    // The first of the buttons, and with the fill of the main button.
    await expect(dialog.getByRole('button').first()).toHaveText('Another challenge')
    await expect(another).toHaveClass(/cta-gradient/)
    await expect(dialog.getByRole('button', { name: 'Back to the menu' })).not.toHaveClass(/cta-gradient/)

    await another.click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeHidden()
    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      new RegExp(`Lives 3 of 3\\. Caught 0 of ${CHALLENGE_SETUP.stickCount}$`),
    )
  })

  test('the menu offers the three modes, and practice is one tap away', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Mode' })
    await expect(section.getByRole('button')).toHaveCount(3)
    await expect(modeButton(page, 'Practice')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // What each one puts at stake is read without entering the run.
    await expect(section).toContainText('Three lives')
  })

  test('choosing challenge leaves the selection in view, and nothing else to ask', async ({ page }) => {
    await modeButton(page, 'Challenge').click()

    // The challenge is fixed: from practice to Play, with no sticks nor speed to choose.
    await expect(page.getByRole('region', { name: 'Number of sticks' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Difficulty' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Practice')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('in practice the scoreboard does not speak of lives', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Easy', mode: 'Practice' })

    expect(await readLives(page)).toBeNull()
  })

  test('in challenge the scoreboard shows the lives and they go down when a stick gets away', async ({
    page,
  }) => {
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })

    expect(await readLives(page)).toBe(3)
    // Without touching anything, the first stick crashes and takes a life.
    await expect.poll(() => readLives(page)).toBe(2)
  })

  test('the challenge ends on spending the last life, before practice', async ({
    page,
  }) => {
    // The same run in both modes: in practice one has to wait for
    // all the sticks to fall and in challenge it closes with the third miss. The
    // times are compared with each other, and not against a number of seconds, because
    // a loaded machine stretches both equally. The challenge is fixed, so
    // practice is set the same as it.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    const challengeStart = Date.now()
    await waitForGameOver(page)
    const challengeMs = Date.now() - challengeStart

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You are out of lives')
    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await startGame(page, {
      sticks: CHALLENGE_SETUP.stickCount,
      difficulty: DIFFICULTY_LABELS[CHALLENGE_SETUP.difficulty],
      mode: 'Practice',
    })
    const practiceStart = Date.now()
    await waitForGameOver(page)
    const practiceMs = Date.now() - practiceStart

    await expect(dialog).toContainText('Game over!')
    // Three sticks out of five: the third touches the floor before the last one. If
    // some day the challenge stopped cutting off, it shows here.
    expect(challengeMs).toBeLessThan(practiceMs)
  })

  test('on finishing, the challenge shows the score and the lives that were left', async ({
    page,
  }) => {
    // They are the two pieces of data that sum up a challenge, and the ones that are shared later.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You are out of lives')
    await expect(dialog).toContainText('Lives')
    await expect(dialog).toContainText('0 / 3')
    await expect(dialog).toContainText('possible')
    await expect(dialog).toContainText(DIFFICULTY_LABELS[CHALLENGE_SETUP.difficulty])
  })

  test('emptying the hoop with lives to spare is clearing the challenge', async ({
    page,
  }) => {
    // The other half of the mode: a challenge is not only lost. The sticks hang
    // catchable from the first second, so catching them as one can there is
    // time to empty the hoop, and there the ending is another and the lives survive.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })

    const dialog = page.getByRole('dialog')
    // It catches until the run closes by itself: if some stick gets away
    // along the way the challenge is still alive —that is what three lives are for— and there are
    // fewer left to catch, so the cap is the number of sticks.
    for (
      let attempt = 0;
      attempt < CHALLENGE_SETUP.stickCount && !(await dialog.isVisible());
      attempt++
    ) {
      await catchStick(page)
    }

    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Challenge cleared!')
    // Surviving with lives is the result, not how many exactly: a stick
    // lost along the way does not change the outcome.
    await expect(dialog).toContainText(/[1-3] \/ 3/)
  })

  test('the chosen mode is still set on going back to the menu', async ({ page }) => {
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('each mode has its record and the menu says which one it speaks of', async ({
    page,
  }) => {
    // A challenge is cut off on running out of lives, so it could never beat the
    // best of a practice with the same sticks: with a shared record, the
    // mode with something at stake would be the only one with nothing to beat.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '99999'),
      HIGH_SCORE_KEYS.practice,
    )
    await openGame(page)

    await expect(page.getByText(/^Best score/)).toContainText('Practice')
    await expect(page.getByText(/^Best score/)).toContainText('99,999')

    await modeButton(page, 'Challenge').click()

    // The challenge starts with no best of its own, and the practice one is not lent to it.
    await expect(page.getByText(/^Best score/)).toHaveCount(0)
  })
})
