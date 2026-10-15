import { expect, test, type Page } from '@playwright/test'
import { catchStick, openGame, startGame, waitForGameOver } from './helpers'

/**
 * The sound is synthesised with the Web Audio API, so there are no files nor
 * requests to spy on: what is counted are the oscillators the game
 * sets sounding. It is the closest one can get to "it was heard" without ears.
 */

interface AudioSpy {
  /** Audio contexts created. */
  contexts: number
  /** Oscillators set sounding. */
  oscillators: number
}

declare global {
  interface Window {
    __audioSpy?: AudioSpy
  }
}

/** Instruments the Web Audio API before the page loads. */
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

test.describe('Sound', () => {
  test('it does not start the audio before the player touches anything', async ({
    page,
  }) => {
    // Creating the context without a previous gesture leaves it suspended for ever:
    // the game would stay mute for the rest of the session.
    await installAudioSpy(page)
    // Without choosing a mode: that click would already be touching something.
    await openGame(page, '/', { mode: null })

    expect((await readSpy(page)).contexts).toBe(0)
  })

  test('the countdown and the sticks really sound', async ({ page }) => {
    await installAudioSpy(page)
    await openGame(page)

    // `startGame` presses "Jugar" and waits for the countdown to run out.
    await startGame(page, { sticks: 13, difficulty: 'Easy' })

    const afterCountdown = await readSpy(page)
    expect(afterCountdown.contexts).toBe(1)
    expect(afterCountdown.oscillators).toBeGreaterThan(0)

    await catchStick(page)

    // The sound is waited for instead of being read at once: the game is painted inside
    // the Canvas and R3F delivers its updates in its own cycle, so
    // the DOM scoreboard can be one frame ahead of the oscillator.
    // What is checked is still the same —that catching a stick sounds—,
    // not when exactly.
    await expect
      .poll(async () => (await readSpy(page)).oscillators)
      .toBeGreaterThan(afterCountdown.oscillators)
  })

  test('finishing the run sounds, which used to be silence', async ({ page }) => {
    // The last stick ended and nothing sounded: the end screen arrived without warning, and
    // with the headset on the scoreboard is where one is not always looking.
    await installAudioSpy(page)
    await openGame(page)
    // The shortest run that can be chosen, to reach the end without waiting more than needed.
    await startGame(page, { sticks: 5, difficulty: 'Easy' })

    const playing = await readSpy(page)
    await waitForGameOver(page)

    await expect
      .poll(async () => (await readSpy(page)).oscillators, {
        message: 'finishing the run set nothing sounding',
      })
      .toBeGreaterThan(playing.oscillators)
  })

  test('muted from the hall\'s settings, the game does not open the audio', async ({
    page,
  }) => {
    // Muting is not turning the volume down: with no context there are no nodes nor playback
    // permission to ask for. Silence is no longer chosen here but in
    // xrcade, and it travels in the browser's storage.
    await page.addInitScript(() => {
      window.localStorage.setItem('xrcade:volume:sfx', '0')
    })
    await installAudioSpy(page)
    await openGame(page)

    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)

    expect(await readSpy(page)).toEqual({ contexts: 0, oscillators: 0 })
  })

  test('the silence is remembered on the next visit', async ({ page }) => {
    // It is what it is saved for: with the headset on, turning the sound off again
    // every time one puts the goggles on is the most awkward gesture of the game.
    // While at it, it watches the console: the button is prerendered on the server, which
    // does not see the storage, so reading the preference by the wrong
    // path would give a hydration error even though the button looks fine.
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

    // It really goes quiet, not only in the setting.
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await catchStick(page)
    expect(await readSpy(page)).toEqual({ contexts: 0, oscillators: 0 })

    expect(errors).toEqual([])
  })

  test('without being able to read the storage it is played with sound, not in silence', async ({ page }) => {
    // Private mode and headsets with storage vetoed: `localStorage`
    // exists but throws on touching it. There there is nowhere to get the hall's
    // settings from, and what cannot happen is the game staying mute because of that.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError')
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

  test('removing the silence gives the sound back without reloading', async ({ page }) => {
    // The costly failure of giving the sound back: the game staying mute for the rest of
    // the session because the context is born already suspended.
    // The unit test runs against a fake context, so this one —against the
    // playback policy of a real browser— is the check
    // that counts.
    await installAudioSpy(page)
    await openGame(page)

    // It is entered quiet and the sound is given back without reloading, which is what
    // happens on touching the volume in the hall's menu with the game mounted.
    await page.evaluate(() => {
      window.localStorage.setItem('xrcade:volume:sfx', '0')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })
    await page.evaluate(() => {
      window.localStorage.removeItem('xrcade:volume:sfx')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    await startGame(page, { sticks: 5, difficulty: 'Easy' })

    // Only one: the click that mutes does not get to open it, and the one that gives the
    // sound back is the gesture the browser demands.
    const spy = await readSpy(page)
    expect(spy.contexts).toBe(1)
    expect(spy.oscillators).toBeGreaterThan(0)
  })
})
