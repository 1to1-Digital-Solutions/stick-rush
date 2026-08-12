import { expect, test } from '@playwright/test'
import { HIGH_SCORE_KEYS } from '@/lib/highScore'
import {
  modeButton,
  openGame,
  readLives,
  startGame,
  waitForGameOver,
} from './helpers'

/**
 * Práctica y desafío.
 *
 * Lo que se juega aquí es el recorrido entero del modo nuevo: elegirlo en el
 * menú, ver las vidas durante la partida y que el desafío se cierre al gastar
 * la tercera. Las reglas en sí (cuándo se acaba, cuántas vidas quedan) las
 * fijan los unitarios de `gameMode.ts`, que no dependen del reloj.
 */

test.describe('Modo de juego', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('el menú ofrece los dos modos, con Práctica puesta', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Modo' })
    await expect(section.getByRole('button')).toHaveCount(2)

    await expect(modeButton(page, 'Práctica')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Desafío')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // Lo que pone en juego cada uno se lee sin entrar a la partida.
    await expect(section).toContainText('Tres vidas')
  })

  test('elegir desafío deja la selección a la vista', async ({ page }) => {
    await modeButton(page, 'Desafío').click()

    await expect(modeButton(page, 'Desafío')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Práctica')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('en práctica el marcador no habla de vidas', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Fácil', mode: 'Práctica' })

    expect(await readLives(page)).toBeNull()
  })

  test('en desafío el marcador enseña las vidas y bajan al escaparse un palo', async ({
    page,
  }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible', mode: 'Desafío' })

    expect(await readLives(page)).toBe(3)
    // Sin tocar nada, el primer palo se estrella y se lleva una vida.
    await expect.poll(() => readLives(page)).toBe(2)
  })

  test('el desafío se acaba al gastar la última vida, mucho antes que la práctica', async ({
    page,
  }) => {
    // La misma partida en los dos modos: en práctica hay que esperar a que
    // caigan los trece palos y en desafío se cierra con el tercer fallo. Se
    // comparan los tiempos entre sí, y no contra un número de segundos, porque
    // una máquina cargada estira las dos por igual.
    const options = { sticks: 13, difficulty: 'Imposible' } as const

    await startGame(page, { ...options, mode: 'Desafío' })
    const challengeStart = Date.now()
    await waitForGameOver(page)
    const challengeMs = Date.now() - challengeStart

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Te has quedado sin vidas')
    await page.getByRole('button', { name: 'Volver al menú' }).click()

    await startGame(page, { ...options, mode: 'Práctica' })
    const practiceStart = Date.now()
    await waitForGameOver(page)
    const practiceMs = Date.now() - practiceStart

    await expect(dialog).toContainText('¡Partida terminada!')
    // Tres palos de trece: el desafío no llega ni a la mitad de lo que dura
    // vaciar el aro entero. Si algún día dejara de cortarse, aquí se ve.
    expect(challengeMs).toBeLessThan(practiceMs * 0.6)
  })

  test('al terminar, el desafío enseña la puntuación y las vidas que quedaron', async ({
    page,
  }) => {
    // Son los dos datos que resumen un desafío, y los que luego se comparten.
    await startGame(page, { sticks: 5, difficulty: 'Imposible', mode: 'Desafío' })
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Te has quedado sin vidas')
    await expect(dialog).toContainText('Vidas')
    await expect(dialog).toContainText('0 / 3')
    await expect(dialog).toContainText('posibles')
    await expect(dialog).toContainText('Imposible')
  })

  test('el modo elegido sigue puesto al volver al menú', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible', mode: 'Desafío' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Volver al menú' }).click()

    await expect(modeButton(page, 'Desafío')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('cada modo tiene su récord y el menú dice de cuál habla', async ({
    page,
  }) => {
    // Un desafío se corta al quedarse sin vidas, así que nunca podría batir la
    // marca de una práctica con los mismos palos: con un récord compartido, el
    // modo con algo en juego sería el único sin nada que superar.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '99999'),
      HIGH_SCORE_KEYS.practice,
    )
    await openGame(page)

    await expect(page.getByText(/^Mejor puntuación/)).toContainText('Práctica')
    await expect(page.getByText(/^Mejor puntuación/)).toContainText('99.999')

    await modeButton(page, 'Desafío').click()

    // El desafío empieza sin marca propia, y la de práctica no se le presta.
    await expect(page.getByText(/^Mejor puntuación/)).toHaveCount(0)
  })
})
