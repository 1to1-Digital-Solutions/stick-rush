import { expect, test, type Page } from '@playwright/test'
import { HIGH_SCORE_KEYS } from '@/lib/highScore'
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

  test('una partida que no bate el récord recuerda la marca a batir', async ({
    page,
  }) => {
    // El récord se siembra en el navegador en vez de jugar una primera partida:
    // lo que se prueba aquí es qué enseña el fin de partida al no batirlo, y
    // una partida de más solo añadiría segundos y azar. Con una marca así de
    // alta, la partida termina sin acercarse ni atrapando todos los palos.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '99999'),
      HIGH_SCORE_KEYS.practice,
    )

    await openGame(page)
    expect(await readMenuRecord(page)).toBe(99999)

    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).not.toContainText('¡Nuevo récord!')
    await expect(dialog).toContainText('Tu récord')
    await expect(dialog).toContainText('99.999')

    // Y una partida peor no rebaja lo guardado.
    await page.getByRole('button', { name: 'Volver al menú' }).click()
    expect(await readMenuRecord(page)).toBe(99999)
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
    // Sin dónde guardarlo no hay récord: anunciarlo en cada partida sería
    // prometer una marca que al volver al menú ya no está.
    await expect(page.getByRole('dialog')).not.toContainText('¡Nuevo récord!')

    await page.getByRole('button', { name: 'Volver al menú' }).click()

    // La partida se juega y se cierra con normalidad; lo único que falta es el
    // récord, porque no hubo dónde escribirlo.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByText(/^Mejor puntuación/)).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
