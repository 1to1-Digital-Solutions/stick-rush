import { expect, test, type Page } from '@playwright/test'
import { catchStick, openGame, startGame } from './helpers'

/**
 * El sonido se sintetiza con la Web Audio API, así que no hay ficheros ni
 * peticiones que espiar: lo que se cuenta son los osciladores que el juego
 * pone a sonar. Es lo más cerca que se puede estar de "se oyó" sin oídos.
 */

interface AudioSpy {
  /** Contextos de audio creados. */
  contexts: number
  /** Osciladores puestos a sonar. */
  oscillators: number
}

declare global {
  interface Window {
    __audioSpy?: AudioSpy
  }
}

/** Instrumenta la Web Audio API antes de que cargue la página. */
async function installAudioSpy(page: Page) {
  await page.addInitScript(() => {
    const spy: AudioSpy = { contexts: 0, oscillators: 0 }
    window.__audioSpy = spy

    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options)
        spy.contexts++
      }

      createOscillator(): OscillatorNode {
        spy.oscillators++
        return super.createOscillator()
      }
    }
  })
}

async function readSpy(page: Page): Promise<AudioSpy> {
  return page.evaluate(() => window.__audioSpy ?? { contexts: 0, oscillators: 0 })
}

test.describe('Sonido', () => {
  test('no arranca el audio antes de que el jugador toque nada', async ({
    page,
  }) => {
    // Crear el contexto sin un gesto previo lo deja suspendido para siempre:
    // el juego se quedaría mudo el resto de la sesión.
    await installAudioSpy(page)
    await openGame(page)

    expect((await readSpy(page)).contexts).toBe(0)
  })

  test('la cuenta atrás y los palos suenan de verdad', async ({ page }) => {
    await installAudioSpy(page)
    await openGame(page)

    // `startGame` pulsa "Jugar" y espera a que se agote la cuenta atrás.
    await startGame(page, { sticks: 13, difficulty: 'Fácil' })

    const afterCountdown = await readSpy(page)
    expect(afterCountdown.contexts).toBe(1)
    expect(afterCountdown.oscillators).toBeGreaterThan(0)

    await catchStick(page)

    expect((await readSpy(page)).oscillators).toBeGreaterThan(
      afterCountdown.oscillators,
    )
  })

  test('silenciado desde el menú, el juego no abre el audio', async ({
    page,
  }) => {
    // Silenciar no es bajar el volumen: sin contexto no hay nodos ni permiso
    // de reproducción que pedir.
    await installAudioSpy(page)
    await openGame(page)

    await page.getByRole('button', { name: 'Silenciar' }).click()
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await catchStick(page)

    expect(await readSpy(page)).toEqual({ contexts: 0, oscillators: 0 })
  })
})
