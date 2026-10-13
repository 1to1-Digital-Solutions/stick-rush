import { expect, test } from '@playwright/test'
import { COUNTDOWN_SECONDS } from '@/lib/gameStore'
import { openGame } from './helpers'
import { enterVR, installXREmulator, pressPlayInsideSession, tutorialSkipButton } from './support/xr'

/**
 * El calentamiento, con el visor emulado y **sin el tutorial visto** (`lib/warmup.ts`).
 *
 * El emulador no lleva la mano hasta los palos, así que el gesto fallado es el más fácil de
 * provocar: no atrapar nada y dejar que los palos lleguen al suelo. Con la lección delante, en el
 * reto, eso no cuesta vidas ni acaba la partida; al cerrarla, el reto empieza de cero.
 */
test.describe('El calentamiento', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    // Dónde están los palos y si se pueden coger: el que está en el suelo ya no.
    await page.addInitScript(() => {
      window.__stickRushSticks = {}
    })
    // El reto, que es el que da medalla y con el que abre el menú.
    await openGame(page, '/', { mode: 'Challenge' })
  })

  test('tres palos al suelo con la lección delante dejan el reto intacto', async ({ page }) => {
    await enterVR(page)
    await pressPlayInsideSession(page)
    await expect(tutorialSkipButton(page)).toBeVisible({ timeout: (COUNTDOWN_SECONDS + 5) * 1000 })

    await expect
      .poll(
        () => page.evaluate(() => Object.values(window.__stickRushSticks ?? {}).filter((palo) => !palo.catchable).length),
        { message: 'no han llegado tres palos al suelo', timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(3)

    // Sigue el calentamiento: la lección delante, las tres vidas y ningún final.
    await expect(tutorialSkipButton(page)).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Lives 3 of 3/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Saltar la lección empieza el reto de cero: otra cuenta atrás, ningún palo resuelto.
    await tutorialSkipButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('timer')).toBeVisible()
    await expect(page.getByRole('status')).toHaveAttribute('aria-label', /Lives 3 of 3\. Caught 0 of 13/)
    // Y el cartel lo dice, en su reflejo de la web, durante la cuenta atrás.
    await expect(page.getByText('Now it counts for a medal')).toBeVisible()
  })
})
