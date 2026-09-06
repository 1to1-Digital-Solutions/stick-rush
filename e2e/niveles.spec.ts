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
    await modeButton(page, 'Niveles').click()

    const section = page.getByRole('region', { name: 'Nivel' })
    await expect(section.getByRole('button')).toHaveCount(LEVEL_COUNT)
    await expect(section.getByRole('button', { name: 'Nivel 1, 0 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section.getByRole('button', { name: 'Nivel 2, bloqueado' })).toBeDisabled()
    await expect(section).toContainText('Nivel 1: 5 palos en Fácil.')

    // Los palos y la velocidad los dice el nivel: sus selectores se van.
    await expect(page.getByRole('region', { name: 'Número de palos' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Dificultad' })).toBeHidden()
  })

  test('superar el nivel da estrellas, abre el siguiente y el menú se pone en él', async ({
    page,
  }) => {
    // El primer nivel es el más lento y con cinco palos, que cuelgan atrapables
    // desde el primer segundo: da tiempo a vaciar el aro.
    await startGame(page, { sticks: 5, mode: 'Niveles' })
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Nivel 1\./)

    const dialog = page.getByRole('dialog')
    for (let attempt = 0; attempt < 5 && !(await dialog.isVisible()); attempt++) {
      await catchStick(page)
    }
    await waitForGameOver(page)

    await expect(dialog).toContainText('¡Nivel 1 superado!')
    await expect(dialog.getByRole('img', { name: /estrella/ })).toBeVisible()
    await expect(dialog).toContainText('Nivel 2 desbloqueado')

    await page.getByRole('button', { name: 'Volver al menú' }).click()

    const section = page.getByRole('region', { name: 'Nivel' })
    await expect(section.getByRole('button', { name: /^Nivel 2, \d estrellas?$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section).toContainText('Nivel 2: 9 palos en Fácil.')
  })

  test('no superar el nivel no abre nada', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, '3'), UNLOCKED_LEVEL_KEY)
    await openGame(page)
    await modeButton(page, 'Niveles').click()

    const section = page.getByRole('region', { name: 'Nivel' })
    // Lo guardado se recuerda: se entra por el más alto abierto.
    await expect(section.getByRole('button', { name: 'Nivel 3, 0 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section).toContainText('Nivel 3: 13 palos en Fácil.')

    // Se puede volver a uno de abajo, pero no saltar a uno cerrado.
    await section.getByRole('button', { name: 'Nivel 1, 0 estrellas' }).click()
    await expect(section).toContainText('Nivel 1: 5 palos en Fácil.')
    await expect(section.getByRole('button', { name: 'Nivel 4, bloqueado' })).toBeDisabled()

    await page.getByRole('button', { name: 'Jugar' }).click()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Atrapados 0 de 5$/)
    // Sin tocar nada los cinco palos se estrellan: cero estrellas.
    await waitForGameOver(page, 90_000)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Nivel 1 sin superar')
    await expect(dialog.getByRole('img', { name: '0 estrellas' })).toBeVisible()
    await expect(dialog).not.toContainText('desbloqueado')
  })
})
