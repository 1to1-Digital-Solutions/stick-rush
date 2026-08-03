import { test } from '@playwright/test'
import { catchStick, openGame, startGame } from './helpers'

/**
 * Genera la captura que ilustra el README. No es una comprobación: se salta
 * salvo que se pida expresamente, para no reescribir el PNG en cada `test:e2e`.
 *
 *   npm run capture
 */
test.describe('Captura para el README', () => {
  test.skip(!process.env.CAPTURE, 'ejecuta `npm run capture` para regenerarla')

  test('partida en curso con los palos cayendo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 810 })
    await openGame(page)
    await startGame(page, { sticks: 11, difficulty: 'Fácil' })

    // Un par de palos atrapados para que se vea el marcador en marcha, y una
    // espera para pillar varios ya sueltos a media caída.
    await catchStick(page)
    await catchStick(page)
    await page.waitForTimeout(3500)

    await page.screenshot({
      path: 'docs/partida.jpg',
      quality: 84,
      animations: 'disabled',
    })
  })
})
