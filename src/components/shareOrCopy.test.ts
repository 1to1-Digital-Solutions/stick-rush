import { describe, expect, it, vi } from 'vitest'
import { SHARE_TITLE } from '../lib/shareResult'
import { type ShareTarget, shareOrCopy } from './shareOrCopy'

/**
 * El reparto del texto, probado sin navegador: se le pasa uno de mentira con lo justo que
 * usa —la hoja de compartir y el portapapeles—, que es lo que deja cubrir los cuatro
 * desenlaces. El texto que se reparte se prueba aparte, en `lib/shareResult.test.ts`.
 */

/** Navegador de mentira con lo justo que usa `shareOrCopy`. */
function fakeTarget({
  share,
  writeText,
}: {
  share?: ShareTarget['share']
  writeText?: (text: string) => Promise<void>
} = {}): ShareTarget {
  return {
    ...(share ? { share } : {}),
    ...(writeText ? { clipboard: { writeText } } : {}),
  }
}

/** El error con el que los navegadores cuentan que se cerró el diálogo. */
function abortError(): Error {
  const error = new Error('cancelado')
  error.name = 'AbortError'
  return error
}

describe('compartir o, si no se puede, copiar', () => {
  it('usa la hoja de compartir del sistema cuando la hay', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)

    expect(await shareOrCopy('resultado', fakeTarget({ share, writeText }))).toBe(
      'shared',
    )
    expect(share).toHaveBeenCalledWith({
      title: SHARE_TITLE,
      text: 'resultado',
    })
    // Y no copia además: dos caminos a la vez dejarían el portapapeles pisado
    // sin que nadie lo haya pedido.
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sin hoja de compartir, deja el texto en el portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    expect(await shareOrCopy('resultado', fakeTarget({ writeText }))).toBe(
      'copied',
    )
    expect(writeText).toHaveBeenCalledWith('resultado')
  })

  it('cerrar el diálogo no es un error, y no copia por detrás', async () => {
    const share = vi.fn().mockRejectedValue(abortError())
    const writeText = vi.fn().mockResolvedValue(undefined)

    expect(await shareOrCopy('resultado', fakeTarget({ share, writeText }))).toBe(
      'cancelled',
    )
    expect(writeText).not.toHaveBeenCalled()
  })

  it('si la hoja de compartir no arranca, copia', async () => {
    // Es el caso del visor: la sesión inmersiva no tiene dónde pintar la hoja
    // del sistema, o el navegador no la considera pedida por el jugador. Sin
    // este camino, ahí el botón no haría nada.
    const share = vi
      .fn()
      .mockRejectedValue(
        new DOMException('sin permiso', 'NotAllowedError'),
      )
    const writeText = vi.fn().mockResolvedValue(undefined)

    expect(await shareOrCopy('resultado', fakeTarget({ share, writeText }))).toBe(
      'copied',
    )
    expect(writeText).toHaveBeenCalledWith('resultado')
  })

  it('sin ninguna de las dos cosas, lo dice', async () => {
    expect(await shareOrCopy('resultado', fakeTarget())).toBe('unavailable')
    expect(await shareOrCopy('resultado', null)).toBe('unavailable')
  })

  it('un portapapeles que falla tampoco rompe la partida', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException('sin foco', 'NotAllowedError'))

    expect(await shareOrCopy('resultado', fakeTarget({ writeText }))).toBe(
      'unavailable',
    )
  })
})
