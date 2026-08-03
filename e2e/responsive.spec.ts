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
      const box = await button.boundingBox()
      const name = await button.textContent()
      expect(box, `sin caja: ${name}`).not.toBeNull()
      // WCAG 2.2 (objetivo mínimo) y la regla de diseño del proyecto.
      expect(box!.height, `alto insuficiente en "${name?.trim()}"`).toBeGreaterThanOrEqual(44)
      expect(box!.width, `ancho insuficiente en "${name?.trim()}"`).toBeGreaterThanOrEqual(44)
    }
  })

  test('se puede jugar tocando la pantalla', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })
  })
})
