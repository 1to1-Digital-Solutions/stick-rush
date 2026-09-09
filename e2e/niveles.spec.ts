import { expect, test } from '@playwright/test'
import { LEVEL_COUNT } from '@/lib/levels'
import { UNLOCKED_LEVEL_KEY } from '@/lib/progress'
import { catchStick, modeButton, openGame, startGame, waitForGameOver } from './helpers'

/**
 * Modo Niveles.
 *
 * El recorrido entero: la escalera en el menú con solo el primero abierto,
 * jugar el nivel con los palos y la velocidad que él dice, las estrellas al
 * acabar y el siguiente que se abre y queda abierto al volver. La escalera y
 * las estrellas en sí las fijan los unitarios de `levels.ts` y `progress.ts`.
 */

test.describe('Modo Niveles', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('la escalera empieza con solo el primer nivel abierto y dice lo que trae', async ({
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

    // Los palos y la velocidad los dice el nivel: sus selectores se van.
    await expect(page.getByRole('region', { name: 'Number of sticks' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Difficulty' })).toBeHidden()
  })

  test('superar el nivel da estrellas, abre el siguiente y el menú se pone en él', async ({
    page,
  }) => {
    // El primer nivel es el más lento y con cinco palos, que cuelgan atrapables
    // desde el primer segundo: da tiempo a vaciar el aro.
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

  test('no superar el nivel no abre nada', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, '3'), UNLOCKED_LEVEL_KEY)
    await openGame(page)
    await modeButton(page, 'Levels').click()

    const section = page.getByRole('region', { name: 'Level' })
    // Lo guardado se recuerda: se entra por el más alto abierto.
    await expect(section.getByRole('button', { name: 'Level 3, 0 stars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section).toContainText('Level 3: 13 sticks on Easy.')

    // Se puede volver a uno de abajo, pero no saltar a uno cerrado.
    await section.getByRole('button', { name: 'Level 1, 0 stars' }).click()
    await expect(section).toContainText('Level 1: 5 sticks on Easy.')
    await expect(section.getByRole('button', { name: 'Level 4, locked' })).toBeDisabled()

    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Caught 0 of 5$/)
    // Sin tocar nada los cinco palos se estrellan: cero estrellas.
    await waitForGameOver(page, 90_000)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Level 1 not cleared')
    await expect(dialog.getByRole('img', { name: '0 stars' })).toBeVisible()
    await expect(dialog).not.toContainText('unlocked')
  })
})
