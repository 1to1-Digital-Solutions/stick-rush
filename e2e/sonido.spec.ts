import { expect, test, type Page } from '@playwright/test'
import { catchStick, openGame, startGame, waitForGameOver } from './helpers'

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
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const afterCountdown = await readSpy(page)
    expect(afterCountdown.contexts).toBe(1)
    expect(afterCountdown.oscillators).toBeGreaterThan(0)

    await catchStick(page)

    // Se espera al sonido en vez de leerlo de golpe: el juego se pinta dentro
    // del Canvas y R3F entrega sus actualizaciones en su propio ciclo, así que
    // el marcador del DOM puede ir un fotograma por delante del oscilador.
    // Lo que se comprueba sigue siendo lo mismo —que atrapar un palo suena—,
    // no cuándo exactamente.
    await expect
      .poll(async () => (await readSpy(page)).oscillators)
      .toBeGreaterThan(afterCountdown.oscillators)
  })

  test('terminar la partida suena, que antes era silencio', async ({ page }) => {
    // Se acababa el último palo y no sonaba nada: la pantalla de fin llegaba sin avisar, y
    // con el visor puesto el marcador está donde uno no siempre está mirando.
    await installAudioSpy(page)
    await openGame(page)
    // La partida más corta que se puede elegir, para llegar al final sin esperar de más.
    await startGame(page, { sticks: 5, difficulty: 'Easy' })

    const jugando = await readSpy(page)
    await waitForGameOver(page)

    await expect
      .poll(async () => (await readSpy(page)).oscillators, {
        message: 'terminar la partida no puso a sonar nada',
      })
      .toBeGreaterThan(jugando.oscillators)
  })

  test('silenciado desde los ajustes del arcade, el juego no abre el audio', async ({
    page,
  }) => {
    // Silenciar no es bajar el volumen: sin contexto no hay nodos ni permiso
    // de reproducción que pedir. El silencio ya no se elige aquí sino en
    // xrcade, y viaja en el almacenamiento del navegador.
    await page.addInitScript(() => {
      window.localStorage.setItem('xrcade:volume:sfx', '0')
    })
    await installAudioSpy(page)
    await openGame(page)

    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)

    expect(await readSpy(page)).toEqual({ contexts: 0, oscillators: 0 })
  })

  test('el silencio se recuerda en la visita siguiente', async ({ page }) => {
    // Es para lo que se guarda: con el visor puesto, volver a apagar el sonido
    // cada vez que uno se pone las gafas es el gesto más incómodo del juego.
    // De paso vigila la consola: el botón se prerenderiza en el servidor, que
    // no ve el almacenamiento, así que leer la preferencia por el camino
    // equivocado daría un error de hidratación aunque el botón se vea bien.
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await installAudioSpy(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('xrcade:volume:sfx', '0')
    })
    await openGame(page)

    // Calla de verdad, no solo en el ajuste.
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)
    expect(await readSpy(page)).toEqual({ contexts: 0, oscillators: 0 })

    expect(errors).toEqual([])
  })

  test('sin poder leer el almacenamiento se juega con sonido, no en silencio', async ({ page }) => {
    // Modo privado y visores con el almacenamiento vetado: `localStorage`
    // existe pero lanza al tocarlo. Ahí no hay de dónde sacar los ajustes del
    // arcade, y lo que no puede pasar es que el juego se quede mudo por eso.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('bloqueado', 'SecurityError')
        },
      })
    })
    await installAudioSpy(page)
    await openGame(page)

    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)

    const spy = await readSpy(page)
    expect(spy.contexts).toBe(1)
    expect(spy.oscillators).toBeGreaterThan(0)
  })

  test('quitar el silencio devuelve el sonido sin recargar', async ({ page }) => {
    // El fallo caro de devolver el sonido: que el juego quede mudo el resto de
    // la sesión porque el contexto nace ya suspendido.
    // El unitario corre contra un contexto de mentira, así que esta —contra la
    // política de reproducción de un navegador de verdad— es la comprobación
    // que cuenta.
    await installAudioSpy(page)
    await openGame(page)

    // Se entra callado y se devuelve el sonido sin recargar, que es lo que
    // pasa al tocar el volumen en el menú del arcade con el juego montado.
    await page.evaluate(() => {
      window.localStorage.setItem('xrcade:volume:sfx', '0')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })
    await page.evaluate(() => {
      window.localStorage.removeItem('xrcade:volume:sfx')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    await startGame(page, { sticks: 5, difficulty: 'Easy' })

    // Uno solo: el clic que silencia no llega a abrirlo, y el que devuelve el
    // sonido es el gesto que el navegador exige.
    const spy = await readSpy(page)
    expect(spy.contexts).toBe(1)
    expect(spy.oscillators).toBeGreaterThan(0)
  })
})
