import { describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from './gameConfig'
import { CHALLENGE_LIVES } from './gameMode'
import {
  SHARE_TITLE,
  type ShareResultInput,
  type ShareTarget,
  buildShareText,
  shareOrCopy,
} from './shareResult'

/**
 * El texto de compartir es lo único del juego que lee alguien que no ha jugado:
 * si dice mal la dificultad, se olvida las vidas o se deja el enlace, no hay
 * pantalla donde se note. Por eso se arma en una función pura y se comprueba
 * aquí, entera, en vez de mirarla en el navegador.
 */

const URL = 'https://stick-rush.example/'

/**
 * Una partida de práctica corriente, sobre la que varían los demás casos. La
 * puntuación pasa de las cinco cifras a propósito: es a partir de ahí donde el
 * español agrupa los miles, así que es lo que prueba el formato.
 */
const PRACTICE: ShareResultInput = {
  points: 12400,
  score: 4,
  stickCount: 5,
  difficulty: 'easy',
  gameMode: 'practice',
  lives: null,
  bestPoints: 0,
  isRecord: false,
  url: URL,
}

/** El mismo resultado, jugado como desafío y acabado con una vida. */
const CHALLENGE: ShareResultInput = {
  ...PRACTICE,
  gameMode: 'challenge',
  lives: 1,
}

describe('lo que cuenta el texto', () => {
  it('dice el juego, el modo y la dificultad en la primera línea', () => {
    const [first] = buildShareText(PRACTICE).split('\n')
    expect(first).toBe(`${SHARE_TITLE} — Práctica en Fácil`)
  })

  it('dice la puntuación y los palos atrapados', () => {
    // Con el mismo formato de miles que el marcador: la cifra que se comparte
    // tiene que ser la que el jugador acaba de ver en pantalla.
    expect(buildShareText(PRACTICE)).toContain('12.400 puntos · 4 de 5 palos')
  })

  it('acaba con el enlace al juego', () => {
    const lines = buildShareText(PRACTICE).split('\n')
    expect(lines.at(-1)).toBe(URL)
    // Una sola vez: repetido, los mensajes lo enseñan dos veces.
    expect(buildShareText(PRACTICE).split(URL)).toHaveLength(2)
  })

  it('nombra cada dificultad como la nombra el juego', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const [first] = buildShareText({ ...PRACTICE, difficulty }).split('\n')
      expect(first).toBe(
        `${SHARE_TITLE} — Práctica en ${DIFFICULTY_LABELS[difficulty]}`,
      )
    }
  })

  it('es corto: cuatro líneas como mucho y ninguna vacía', () => {
    // Acaba en un mensaje, así que se lee de un vistazo o no se lee. El caso
    // más largo posible: desafío, con récord que contar y enlace.
    const lines = buildShareText({
      ...CHALLENGE,
      difficulty: 'impossible',
      points: 999999,
      bestPoints: 999999,
      isRecord: true,
    }).split('\n')
    expect(lines.length).toBeLessThanOrEqual(4)
    for (const line of lines) expect(line.trim()).not.toBe('')
  })
})

describe('las vidas, solo donde significan algo', () => {
  it('el desafío cuenta con cuántas vidas se acabó', () => {
    expect(buildShareText(CHALLENGE)).toContain(
      `1 de ${CHALLENGE_LIVES} vidas`,
    )
  })

  it('un desafío perdido dice que se acabó sin vidas', () => {
    expect(buildShareText({ ...CHALLENGE, lives: 0 })).toContain(
      `0 de ${CHALLENGE_LIVES} vidas`,
    )
  })

  it('la práctica no habla de vidas', () => {
    // No hay nada que perder: decir "sin vidas" sonaría a haber fracasado.
    expect(buildShareText(PRACTICE)).not.toMatch(/vida/i)
  })

  it('sin el dato de las vidas se calla en vez de inventárselo', () => {
    expect(buildShareText({ ...CHALLENGE, lives: null })).not.toMatch(/vida/i)
  })
})

describe('la marca', () => {
  it('sin récord previo no menciona ninguno', () => {
    // La primera partida del navegador: no hay marca que enseñar, y un
    // "récord: 0" contaría como logro no haber jugado nunca.
    expect(buildShareText(PRACTICE)).not.toMatch(/récord/i)
  })

  it('anuncia el récord recién batido', () => {
    const text = buildShareText({
      ...PRACTICE,
      bestPoints: PRACTICE.points,
      isRecord: true,
    })
    expect(text).toContain('¡Nuevo récord!')
    expect(text).not.toContain('Mi récord')
  })

  it('con récord sin batir enseña la marca que había', () => {
    const text = buildShareText({ ...PRACTICE, bestPoints: 99999 })
    expect(text).toContain('Mi récord: 99.999')
    expect(text).not.toContain('¡Nuevo récord!')
  })
})

describe('cifras imposibles', () => {
  it('una puntuación corrupta se cuenta como cero, no como NaN', () => {
    // El récord sale del almacenamiento, que cualquiera puede editar: un NaN
    // en el texto que se comparte sería el fallo a la vista de todos.
    expect(buildShareText({ ...PRACTICE, points: Number.NaN })).toContain(
      '0 puntos',
    )
    expect(buildShareText({ ...PRACTICE, points: -50 })).toContain('0 puntos')
  })
})

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
