import { expect, test } from '@playwright/test'
import { openGame, startGame } from './helpers'

test.describe('Cabeceras de seguridad', () => {
  test('la respuesta trae la política de seguridad y los permisos', async ({
    page,
  }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const headers = response!.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(headers['content-security-policy']).toBeTruthy()
  })

  test('la CSP cierra la salida a servicios externos', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response!.headers()['content-security-policy']

    // Es lo que garantiza que el juego funcione en un visor sin salida a
    // internet, aunque una librería del árbol traiga un CDN cableado.
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'self'")
  })

  test('WebXR sigue permitido: sin esto el juego no arranca en el visor', async ({
    page,
  }) => {
    const response = await page.goto('/')
    const permissions = response!.headers()['permissions-policy']

    expect(permissions).toContain('xr-spatial-tracking=(self)')
    // Y lo que el juego no usa, cerrado.
    expect(permissions).toContain('geolocation=()')
    expect(permissions).toContain('microphone=()')
  })

  test('la CSP no rompe la escena: se juega sin violaciones', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (/Content Security Policy|Refused to/i.test(text)) violations.push(text)
    })

    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Imposible' })
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })

    expect(violations).toEqual([])
  })
})
