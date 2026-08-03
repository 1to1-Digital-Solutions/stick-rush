import { expect, test } from '@playwright/test'
import { openGame, startGame } from './helpers'

// Pantalla de móvil sobre el mismo Chromium: solo se cambia el viewport y el
// modo táctil, sin arrastrar el motor WebKit del preset de dispositivo.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test.describe('En móvil', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('el menú cabe a lo ancho, sin scroll horizontal', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('todos los controles llegan al tamaño táctil mínimo', async ({ page }) => {
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const name = (await button.textContent())?.trim()

      // Se mide con `poll` y no de una sola lectura: si la hoja de estilos aún
      // no se ha aplicado (pasa en el primer arranque tras un build limpio), el
      // botón se mide sin su tamaño real y el test falla por un motivo falso.
      // WCAG 2.2 (objetivo mínimo) y la regla de diseño del proyecto.
      await expect
        .poll(async () => (await button.boundingBox())?.height ?? 0, {
          message: `alto insuficiente en "${name}"`,
        })
        .toBeGreaterThanOrEqual(44)
      await expect
        .poll(async () => (await button.boundingBox())?.width ?? 0, {
          message: `ancho insuficiente en "${name}"`,
        })
        .toBeGreaterThanOrEqual(44)
    }
  })

  test('se puede jugar tocando la pantalla', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })
  })
})
