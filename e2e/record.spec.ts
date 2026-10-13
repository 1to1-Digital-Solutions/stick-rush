import { expect, test, type Page } from '@playwright/test'
import { HIGH_SCORE_KEYS } from '@/lib/highScore'
import {
  catchStick,
  openGame,
  readPoints,
  startGame,
  waitForGameOver,
} from './helpers'

/** Figure of the record the menu shows, without the thousands format. */
async function readMenuRecord(page: Page): Promise<number> {
  const text = await page.getByText(/^Best score/).innerText()
  const digits = text.replace(/\D/g, '')
  if (!digits) throw new Error(`Unreadable record in the menu: ${text}`)
  return Number(digits)
}

test.describe('Best score', () => {
  test('the menu shows no record before the first run', async ({
    page,
  }) => {
    await openGame(page)

    await expect(page.getByText(/^Best score/)).toHaveCount(0)
  })

  test('the best score is saved and is still there on reloading', async ({
    page,
  }) => {
    await openGame(page)
    // Easy and few sticks: there is time to catch one with the mouse and the run
    // closes by itself as soon as the rest fall.
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)
    const points = await readPoints(page)
    expect(points).toBeGreaterThan(0)

    await waitForGameOver(page)
    await expect(page.getByRole('dialog')).toContainText('New record!')

    await page.getByRole('button', { name: 'Back to the menu' }).click()
    expect(await readMenuRecord(page)).toBe(points)

    // What tells saving from remembering: reloading throws React's state away,
    // so if the record is still in the menu it came from the browser.
    await openGame(page)
    expect(await readMenuRecord(page)).toBe(points)
  })

  test('a run that does not beat the record recalls the best to beat', async ({
    page,
  }) => {
    // The record is seeded in the browser instead of playing a first run:
    // what is tested here is what the end of run shows on not beating it, and
    // one more run would only add seconds and chance. With a best this
    // high, the run ends without getting close even catching all the sticks.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '99999'),
      HIGH_SCORE_KEYS.practice,
    )

    await openGame(page)
    expect(await readMenuRecord(page)).toBe(99999)

    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).not.toContainText('New record!')
    await expect(dialog).toContainText('Your record')
    await expect(dialog).toContainText('99,999')

    // And a worse run does not lower what is saved.
    await page.getByRole('button', { name: 'Back to the menu' }).click()
    expect(await readMenuRecord(page)).toBe(99999)
  })

  test('with storage blocked it is played all the same, with no record', async ({
    page,
  }) => {
    // Private mode and headsets with storage vetoed: `localStorage`
    // exists but throws on touching it. There the record is lost, not the game.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    })

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)
    expect(await readPoints(page)).toBeGreaterThan(0)

    await waitForGameOver(page)
    // With nowhere to save it there is no record: announcing it in every run would be
    // promising a best that on going back to the menu is no longer there.
    await expect(page.getByRole('dialog')).not.toContainText('New record!')

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    // The run is played and closes normally; the only thing missing is the
    // record, because there was nowhere to write it.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByText(/^Best score/)).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
