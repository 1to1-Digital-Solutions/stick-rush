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
  waitForGameOver,
} from './helpers'

test.describe('Partida', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('al jugar, el menú deja paso al marcador sobre la escena', async ({
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

  test('la cuenta atrás precede a la partida y no deja atrapar nada', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '13', exact: true }).click()
    await page.getByRole('button', { name: 'Easy', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    // Mientras cuenta, los palos cuelgan quietos: sin esta guarda se podía
    // vaciar el aro entero a clics antes de que empezara a caer nada.
    await expect(page.getByRole('timer')).toBeVisible()
    expect(await findCatchableStick(page)).toBeNull()

    await expect(page.getByRole('timer')).toBeHidden()

    // Y al acabar la cuenta, se juega con normalidad.
    await catchStick(page)
    expect(await readScore(page)).toBe(1)
  })

  test('al arrancar la partida el cursor ofrece el palo sin mover el ratón', async ({
    page,
  }) => {
    // Un palo se coge hasta que toca el suelo, colgando incluido, así que quien
    // deja el ratón sobre un palo mientras cuenta atrás tiene que ver el cursor
    // encenderse solo: nadie mueve el ratón durante la cuenta, y sin eso el
    // navegador no vuelve a avisar de que hay un palo debajo.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })
    const hanging = await findHangingStick(page)

    await openGame(page)
    await page.getByRole('button', { name: '13', exact: true }).click()
    await page.getByRole('button', { name: 'Easy', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    await expect(page.getByRole('timer')).toBeVisible()
    // Por pasos, como llega un ratón de verdad: con un solo salto la escena no
    // llega a registrar que hay un palo debajo.
    await page.mouse.move(hanging.x, hanging.y, { steps: 8 })
    expect(await isPointingAtStick(page)).toBe(false)

    await expect(page.getByRole('timer')).toBeHidden()
    await expect.poll(() => isPointingAtStick(page)).toBe(true)
  })

  test('un palo que todavía cuelga del aro se puede atrapar', async ({
    page,
  }) => {
    // La decisión de producto de la partida: adelantarse al palo es jugar, no
    // hacer trampa. `canCatchStick` lo fija como regla, pero solo un clic de
    // verdad sobre un palo que aún cuelga demuestra que el juego la cumple: si
    // algún día la ventana se cierra a los palos que caen, este test es el que
    // tiene que ponerse rojo, porque el resto se apoya en el palo que pilla.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    await catchHangingStick(page)

    expect(await readScore(page)).toBe(1)
  })

  test('atrapar un palo suma en el marcador', async ({ page }) => {
    // Muchos palos y caída lenta: siempre hay alguno colgando o cayendo.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    await catchStick(page)

    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      /Caught 1 of 13$/,
    )
  })

  test('atrapar un palo suma puntos', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })
    expect(await readPoints(page)).toBe(0)

    await catchStick(page)

    expect(await readPoints(page)).toBeGreaterThan(0)
  })

  test('la racha aparece al encadenar y no antes', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const streak = page.getByText(/^Streak ×/)
    await catchStick(page)
    await expect(streak).toHaveCount(0)

    await catchStick(page)
    await expect(streak).toBeVisible()
  })

  test('un palo solo se puede atrapar una vez', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const target = await catchStick(page)
    expect(await readScore(page)).toBe(1)

    // Insistir sobre el palo ya atrapado no puede volver a sumar: es el mismo
    // caso que dos mandos XR apuntando a la vez al mismo palo.
    await page.mouse.click(target.x, target.y)
    await page.mouse.click(target.x, target.y)

    expect(await readScore(page)).toBe(1)
  })

  test('atrapar varios palos los cuenta uno a uno', async ({ page }) => {
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    for (let expected = 1; expected <= 3; expected++) {
      await catchStick(page)
      expect(await readScore(page)).toBe(expected)
    }
  })

  test('la partida termina sola cuando caen todos los palos', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })

    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Game over!')
    await expect(dialog).toContainText('You caught')
    await expect(dialog).toContainText('Impossible')
    // El resumen sitúa la puntuación: un número suelto no dice si es buena.
    await expect(dialog).toContainText('possible')
    await expect(dialog).toContainText('Best streak')
  })

  test('desde el fin de partida se vuelve al menú con la selección intacta', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Impossible', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: '5', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('se puede jugar otra partida con el marcador a cero', async ({ page }) => {
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

  test('la escena no ensucia la consola con errores', async ({ page }) => {
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
