import { expect, test } from '@playwright/test'
import { ENDLESS_STREAK_KEY, HIGH_SCORE_KEYS } from '@/lib/highScore'
import { openGame, startGame, waitForGameOver } from './helpers'

/**
 * Práctica sin fin.
 *
 * Los palos se crean de golpe con la partida, así que «sin fin» funciona por
 * tandas: al resolverse la que cuelga, la máquina se recarga con otra y la
 * partida sigue hasta que el jugador la termina. Lo que se guarda no son los
 * puntos —crecen sin tope— sino la racha más larga.
 */

test.describe('Práctica sin fin', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('la duración solo se elige en práctica, y por defecto es una tanda', async ({
    page,
  }) => {
    const section = page.getByRole('region', { name: 'Duración' })
    await expect(section.getByRole('button', { name: /^Tanda/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(section.getByRole('button', { name: /^Sin fin/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await page.getByRole('button', { name: /^Desafío/ }).click()
    await expect(section).toBeHidden()
  })

  test('al vaciar la tanda la máquina se recarga en vez de acabar, y termina el jugador', async ({
    page,
  }) => {
    // Con la caída más rápida los cinco palos se estrellan en segundos: ahí una
    // tanda normal habría terminado, y esta sigue con palos nuevos.
    await startGame(page, { sticks: 5, difficulty: 'Imposible', mode: 'Práctica', endless: true })

    const status = page.getByRole('status')
    await expect(status).toHaveAttribute('aria-label', /tanda 2$/, { timeout: 30_000 })
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: 'Terminar' }).click()
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('¡Partida terminada!')
    await expect(dialog).toContainText('sin fin')
    // Sin techo no hay «de N posibles» que enseñar.
    await expect(dialog).not.toContainText('posibles')
  })

  test('lo que se guarda es la racha, y el menú la enseña como tal', async ({ page }) => {
    await page.addInitScript(
      ([streakKey, pointsKey]) => {
        window.localStorage.setItem(streakKey, '7')
        window.localStorage.setItem(pointsKey, '99999')
      },
      [ENDLESS_STREAK_KEY, HIGH_SCORE_KEYS.practice] as const,
    )
    await openGame(page)

    await expect(page.getByText(/^Mejor puntuación/)).toContainText('99.999')

    await page.getByRole('button', { name: /^Sin fin/ }).click()

    // La marca de sin fin es la suya: la de la práctica por tandas no se le presta.
    await expect(page.getByText(/^Mejor racha sin fin/)).toContainText('×7')
    await expect(page.getByText(/^Mejor puntuación/)).toHaveCount(0)
  })
})
