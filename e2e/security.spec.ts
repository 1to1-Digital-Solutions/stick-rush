import { expect, test } from '@playwright/test'
import { openGame, startGame } from './helpers'

test.describe('Security headers', () => {
  test('the response brings the security policy and the permissions', async ({
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

  test('the CSP closes the way out to external services', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response!.headers()['content-security-policy']

    // It is what guarantees that the game works in a headset with no way out to
    // the internet, even if a library of the tree brings a hard-wired CDN.
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'self'")
  })

  test('WebXR is still allowed: without this the game does not start in the headset', async ({
    page,
  }) => {
    const response = await page.goto('/')
    const permissions = response!.headers()['permissions-policy']

    expect(permissions).toContain('xr-spatial-tracking=(self)')
    // And what the game does not use, closed.
    expect(permissions).toContain('geolocation=()')
    expect(permissions).toContain('microphone=()')
  })

  test('the CSP does not break the scene: it is played with no violations', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (/Content Security Policy|Refused to/i.test(text)) violations.push(text)
    })

    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Impossible' })
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })

    expect(violations).toEqual([])
  })
})
