import { expect, test } from '@playwright/test'
import {
  catchStick,
  openGame,
  readScore,
  startGame,
  waitForGameOver,
} from './helpers'

test.describe('Partida', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('al jugar, el menú deja paso al marcador sobre la escena', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeHidden()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Atrapados 0 de 5',
    )
    await expect(page.getByText('Fácil', { exact: true })).toBeVisible()
  })

  test('atrapar un palo suma en el marcador', async ({ page }) => {
    // Muchos palos y caída lenta: siempre hay alguno colgando o cayendo.
    await startGame(page, { sticks: 13, difficulty: 'Fácil' })

    await catchStick(page)

    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Atrapados 1 de 13',
    )
  })

  test('un palo solo se puede atrapar una vez', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Fácil' })

    const target = await catchStick(page)
    expect(await readScore(page)).toBe(1)

    // Insistir sobre el palo ya atrapado no puede volver a sumar: es el mismo
    // caso que dos mandos XR apuntando a la vez al mismo palo.
    await page.mouse.click(target.x, target.y)
    await page.mouse.click(target.x, target.y)

    expect(await readScore(page)).toBe(1)
  })

  test('atrapar varios palos los cuenta uno a uno', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Fácil' })

    for (let expected = 1; expected <= 3; expected++) {
      await catchStick(page)
      expect(await readScore(page)).toBe(expected)
    }
  })

  test('la partida termina sola cuando caen todos los palos', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })

    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('¡Partida terminada!')
    await expect(dialog).toContainText('Has atrapado')
    await expect(dialog).toContainText('Dificultad: Imposible')
  })

  test('desde el fin de partida se vuelve al menú con la selección intacta', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Volver al menú' }).click()

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Imposible', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: '5', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('se puede jugar otra partida con el marcador a cero', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await waitForGameOver(page)
    await page.getByRole('button', { name: 'Volver al menú' }).click()

    await page.getByRole('button', { name: 'Jugar' }).click()

    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Atrapados 0 de 5',
    )
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('la escena no ensucia la consola con errores', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await waitForGameOver(page)

    expect(errors).toEqual([])
  })
})
