import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStoredPreference, gameStorage } from './storage'

const KEY = 'stick-rushest-flag'

/**
 * Una preferencia de mentira con la misma forma que las de verdad: se guarda
 * como texto y se lee como otra cosa, para que se vea si el parseador y el
 * serializador se usan.
 */
function flagPreference(key: string = KEY) {
  return createStoredPreference<boolean>({
    key,
    parse: (raw) => raw === 'sí',
    serialize: (value) => (value ? 'sí' : 'no'),
  })
}

/** Deja el almacenamiento lanzando a cada acceso, como en una ventana privada. */
function blockStorage(): void {
  const boom = () => {
    throw new Error('almacenamiento bloqueado')
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

  it('da el almacenamiento del navegador', () => {
    expect(gameStorage()).toBe(window.localStorage)
  })

  it('da null cuando ni siquiera se puede mirar', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('almacenamiento vetado por política')
      },
    })

    expect(gameStorage()).toBeNull()
  })
})

describe('createStoredPreference', () => {
  it('recuerda lo elegido, traducido a lo que se guarda', () => {
    const flag = flagPreference()
    flag.save(true)

    expect(window.localStorage.getItem(KEY)).toBe('sí')
    expect(flag.get()).toBe(true)
  })

  it('se entra con lo que el parseador hace sin nada guardado', () => {
    const flag = flagPreference()

    expect(flag.get()).toBe(false)
    expect(flag.getServer()).toBe(false)
  })

  it('avisa a quien mira después de escribir', () => {
    const flag = flagPreference()
    const listener = vi.fn()
    const unsubscribe = flag.subscribe(listener)

    flag.save(true)
    unsubscribe()

    expect(listener).toHaveBeenCalled()
  })

  it('avisa también cuando lo cambia otra pestaña', () => {
    const flag = flagPreference()
    const listener = vi.fn()
    const unsubscribe = flag.subscribe(listener)

    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    unsubscribe()

    expect(listener).toHaveBeenCalled()
  })

  it('deja de avisar a quien se da de baja', () => {
    const flag = flagPreference()
    const listener = vi.fn()

    flag.subscribe(listener)()
    flag.save(true)
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))

    expect(listener).not.toHaveBeenCalled()
  })

  it('guarda cada variante en su clave', () => {
    const flag = createStoredPreference<boolean, [string]>({
      key: (variant) => `${KEY}:${variant}`,
      parse: (raw) => raw === 'sí',
      serialize: (value) => (value ? 'sí' : 'no'),
    })

    flag.save(true, 'uno')

    expect(flag.get('uno')).toBe(true)
    expect(flag.get('dos')).toBe(false)
  })

  it('con el almacenamiento bloqueado se entra con el valor de entrada', () => {
    const flag = flagPreference()
    blockStorage()

    expect(flag.get()).toBe(false)
  })

  it('con el almacenamiento bloqueado, cambiar una preferencia vale al menos para esta visita', () => {
    // Antes la escritura fallaba en silencio y la relectura devolvía lo de
    // antes: pulsar «izquierda» o el silencio no hacía absolutamente nada, y
    // con el visor puesto el menú es la única forma de cambiarlo.
    const flag = flagPreference()
    const listener = vi.fn()
    blockStorage()
    const unsubscribe = flag.subscribe(listener)

    expect(() => flag.save(true)).not.toThrow()
    expect(flag.get()).toBe(true)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })

  it('en cuanto el almacenamiento vuelve a aceptar, manda él otra vez', () => {
    const flag = flagPreference()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota agotada')
    })
    flag.save(true)
    expect(flag.get()).toBe(true)

    setItem.mockRestore()
    flag.save(false)
    expect(flag.get()).toBe(false)
    // Y lo que dice el almacenamiento es lo que vale: otra pestaña lo cambia.
    window.localStorage.setItem(KEY, 'sí')
    expect(flag.get()).toBe(true)
  })
})

describe('sin navegador que preguntar', () => {
  it('no hay almacenamiento, y eso es lo que mantiene igual el HTML', () => {
    // Si en el servidor se leyera algo, React avisaría de que el HTML que
    // prerenderiza y el que hidrata no cuadran.
    vi.stubGlobal('window', undefined)
    expect(gameStorage()).toBeNull()
  })
})
