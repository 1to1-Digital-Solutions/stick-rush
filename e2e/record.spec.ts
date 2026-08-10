import { expect, test, type Page } from '@playwright/test'
import {
  catchStick,
  openGame,
  readPoints,
  startGame,
  waitForGameOver,
} from './helpers'

/** Cifra del récord que enseña el menú, sin el formato de miles. */
async function readMenuRecord(page: Page): Promise<number> {
  const text = await page.getByText(/^Mejor puntuación/).innerText()
  const digits = text.replace(/\D/g, '')
  if (!digits) throw new Error(`Récord ilegible en el menú: ${text}`)
  return Number(digits)
}

test.describe('Mejor puntuación', () => {
  test('el menú no enseña récord antes de la primera partida', async ({
    page,
  }) => {
    await openGame(page)

    await expect(page.getByText(/^Mejor puntuación/)).toHaveCount(0)
  })

  test('la mejor puntuación se guarda y sigue ahí al recargar', async ({
    page,
  }) => {
    await openGame(page)
    // Fácil y pocos palos: da tiempo a atrapar uno con el ratón y la partida
    // se cierra sola en cuanto caen los demás.
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await catchStick(page)
    const points = await readPoints(page)
    expect(points).toBeGreaterThan(0)

    await waitForGameOver(page)
    await expect(page.getByRole('dialog')).toContainText('¡Nuevo récord!')

    await page.getByRole('button', { name: 'Volver al menú' }).click()
    expect(await readMenuRecord(page)).toBe(points)

    // Lo que distingue guardar de recordar: recargar tira el estado de React,
    // así que si el récord sigue en el menú es que salió del navegador.
    await openGame(page)
    expect(await readMenuRecord(page)).toBe(points)
  })

  test('con el almacenamiento bloqueado se juega igual, sin récord', async ({
    page,
  }) => {
    // Modo privado y visores con el almacenamiento vetado: `localStorage`
    // existe pero lanza al tocarlo. Ahí se pierde el récord, no el juego.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('bloqueado', 'SecurityError')
        },
      })
    })

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await catchStick(page)
    expect(await readPoints(page)).toBeGreaterThan(0)

    await waitForGameOver(page)
    await page.getByRole('button', { name: 'Volver al menú' }).click()

    // La partida se juega y se cierra con normalidad; lo único que falta es el
    // récord, porque no hubo dónde escribirlo.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByText(/^Mejor puntuación/)).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
