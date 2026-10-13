import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStoredPreference, gameStorage } from './storage'

const KEY = 'stick-rushest-flag'

/**
 * A fake preference with the same shape as the real ones: it is stored
 * as text and read as something else, so that it shows whether the parser and the
 * serialiser are used.
 */
function flagPreference(key: string = KEY) {
  return createStoredPreference<boolean>({
    key,
    parse: (raw) => raw === 'yes',
    serialize: (value) => (value ? 'yes' : 'no'),
  })
}

/** Leaves the storage throwing on each access, as in a private window. */
function blockStorage(): void {
  const boom = () => {
    throw new Error('storage blocked')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('gameStorage', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')

  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original)
  })

  it('gives the storage of the browser', () => {
    expect(gameStorage()).toBe(window.localStorage)
  })

  it('gives null when it cannot even be looked at', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage banned by policy')
      },
    })

    expect(gameStorage()).toBeNull()
  })
})

describe('createStoredPreference', () => {
  it('remembers what was chosen, translated to what is stored', () => {
    const flag = flagPreference()
    flag.save(true)

    expect(window.localStorage.getItem(KEY)).toBe('yes')
    expect(flag.get()).toBe(true)
  })

  it('starts with what the parser makes of nothing stored', () => {
    const flag = flagPreference()

    expect(flag.get()).toBe(false)
    expect(flag.getServer()).toBe(false)
  })

  it('notifies whoever looks after writing', () => {
    const flag = flagPreference()
    const listener = vi.fn()
    const unsubscribe = flag.subscribe(listener)

    flag.save(true)
    unsubscribe()

    expect(listener).toHaveBeenCalled()
  })

  it('also notifies when another tab changes it', () => {
    const flag = flagPreference()
    const listener = vi.fn()
    const unsubscribe = flag.subscribe(listener)

    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    unsubscribe()

    expect(listener).toHaveBeenCalled()
  })

  it('stops notifying whoever unsubscribes', () => {
    const flag = flagPreference()
    const listener = vi.fn()

    flag.subscribe(listener)()
    flag.save(true)
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))

    expect(listener).not.toHaveBeenCalled()
  })

  it('stores each variant under its key', () => {
    const flag = createStoredPreference<boolean, [string]>({
      key: (variant) => `${KEY}:${variant}`,
      parse: (raw) => raw === 'yes',
      serialize: (value) => (value ? 'yes' : 'no'),
    })

    flag.save(true, 'one')

    expect(flag.get('one')).toBe(true)
    expect(flag.get('two')).toBe(false)
  })

  it('with the storage blocked it starts with the initial value', () => {
    const flag = flagPreference()
    blockStorage()

    expect(flag.get()).toBe(false)
  })

  it('with the storage blocked, changing a preference holds at least for this visit', () => {
    // Before, the write failed silently and the re-read returned what was there
    // before: pressing «izquierda» or the mute did absolutely nothing, and
    // with the headset on the menu is the only way of changing it.
    const flag = flagPreference()
    const listener = vi.fn()
    blockStorage()
    const unsubscribe = flag.subscribe(listener)

    expect(() => flag.save(true)).not.toThrow()
    expect(flag.get()).toBe(true)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })

  it('as soon as the storage accepts again, it rules once more', () => {
    const flag = flagPreference()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exhausted')
    })
    flag.save(true)
    expect(flag.get()).toBe(true)

    setItem.mockRestore()
    flag.save(false)
    expect(flag.get()).toBe(false)
    // And what the storage says is what counts: another tab changes it.
    window.localStorage.setItem(KEY, 'yes')
    expect(flag.get()).toBe(true)
  })
})

describe('with no browser to ask', () => {
  it('there is no storage, and that is what keeps the HTML the same', () => {
    // If something were read on the server, React would warn that the HTML it
    // prerenders and the one it hydrates do not match.
    vi.stubGlobal('window', undefined)
    expect(gameStorage()).toBeNull()
  })
})
