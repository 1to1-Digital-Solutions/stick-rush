import { expect, test } from '@playwright/test'
import {
  catchHangingStick,
  catchStick,
  findCatchableStick,
  findHangingStick,
  isPointingAtStick,
  openGame,
  readPoints,
  readScore,
  startGame,
  showMoreOptions,
  waitForGameOver,
} from './helpers'

test.describe('Run', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('on playing, the menu gives way to the scoreboard over the scene', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Easy' })

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeHidden()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      /Caught 0 of 5$/,
    )
    await expect(page.getByText('Easy', { exact: true })).toBeVisible()
  })

  test('the countdown precedes the run and lets nothing be caught', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '13', exact: true }).click()
    await page.getByRole('button', { name: 'Easy', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    // While it counts, the sticks hang still: without this guard the
    // whole hoop could be emptied by clicking before anything started falling.
    await expect(page.getByRole('timer')).toBeVisible()
    expect(await findCatchableStick(page)).toBeNull()

    await expect(page.getByRole('timer')).toBeHidden()

    // And when the count ends, it is played normally.
    await catchStick(page)
    expect(await readScore(page)).toBe(1)
  })

  test('on starting the run the cursor offers the stick without moving the mouse', async ({
    page,
  }) => {
    // A stick is caught until it touches the floor, hanging included, so whoever
    // leaves the mouse over a stick while it counts down has to see the cursor
    // light up by itself: nobody moves the mouse during the count, and without that the
    // browser does not report again that there is a stick underneath.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })
    const hanging = await findHangingStick(page)

    await openGame(page)
    await page.getByRole('button', { name: '13', exact: true }).click()
    await page.getByRole('button', { name: 'Easy', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    await expect(page.getByRole('timer')).toBeVisible()
    // In steps, as a real mouse arrives: with a single jump the scene does not
    // get to register that there is a stick underneath.
    await page.mouse.move(hanging.x, hanging.y, { steps: 8 })
    expect(await isPointingAtStick(page)).toBe(false)

    await expect(page.getByRole('timer')).toBeHidden()
    await expect.poll(() => isPointingAtStick(page)).toBe(true)
  })

  test('a stick that still hangs from the hoop can be caught', async ({
    page,
  }) => {
    // The product decision of the run: getting ahead of the stick is playing, not
    // cheating. `canCatchStick` fixes it as a rule, but only a real
    // click on a stick that still hangs proves the game complies with it: if
    // some day the window closes down to the sticks that fall, this test is the one that
    // has to turn red, because the rest lean on whichever stick they catch.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    await catchHangingStick(page)

    expect(await readScore(page)).toBe(1)
  })

  test('catching a stick adds to the scoreboard', async ({ page }) => {
    // Many sticks and a slow fall: there is always one hanging or falling.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    await catchStick(page)

    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      /Caught 1 of 13$/,
    )
  })

  test('catching a stick adds points', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })
    expect(await readPoints(page)).toBe(0)

    await catchStick(page)

    expect(await readPoints(page)).toBeGreaterThan(0)
  })

  test('the streak appears on chaining and not before', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const streak = page.getByText(/^Streak ×/)
    await catchStick(page)
    await expect(streak).toHaveCount(0)

    await catchStick(page)
    await expect(streak).toBeVisible()
  })

  test('a stick can only be caught once', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const target = await catchStick(page)
    expect(await readScore(page)).toBe(1)

    // Insisting on the stick already caught cannot add again: it is the same
    // case as two XR controllers pointing at the same stick at once.
    await page.mouse.click(target.x, target.y)
    await page.mouse.click(target.x, target.y)

    expect(await readScore(page)).toBe(1)
  })

  test('catching several sticks counts them one by one', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    for (let expected = 1; expected <= 3; expected++) {
      await catchStick(page)
      expect(await readScore(page)).toBe(expected)
    }
  })

  test('the run ends by itself when all the sticks fall', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })

    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Game over!')
    await expect(dialog).toContainText('You caught')
    await expect(dialog).toContainText('Impossible')
    // The summary places the score: a lone number does not say whether it is good.
    await expect(dialog).toContainText('possible')
    await expect(dialog).toContainText('Best streak')
  })

  test('from the end of run one goes back to the menu with the selection intact', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    // The menu opens folded again: what was chosen is still behind «Más opciones».
    await showMoreOptions(page)
    await expect(
      page.getByRole('button', { name: 'Impossible', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: '5', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('another run can be played with the scoreboard at zero', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await waitForGameOver(page)
    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await page.getByRole('button', { name: 'Play', exact: true }).click()

    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      /Caught 0 of 5$/,
    )
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('the scene does not dirty the console with errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await waitForGameOver(page)

    expect(errors).toEqual([])
  })
})
