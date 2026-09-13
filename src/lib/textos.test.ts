import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { DIFFICULTY_LABELS } from './gameConfig'
import { TEXT_KEYS, texto, traductor } from './textos'

/**
 * El diccionario del juego.
 *
 * Que las claves existan lo comprueba TypeScript —salen del propio objeto—, así
 * que aquí se mira lo que el tipo no ve: que en inglés se devuelva el original
 * sin guardarlo dos veces, que en español no quede nada sin traducir, y que las
 * etiquetas que vienen de los mapas de configuración estén en el diccionario.
 * Ese último es el que se rompe solo: se añade una dificultad y nadie se acuerda.
 */
describe('el diccionario', () => {
  it('en inglés devuelve la propia clave', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Points')).toBe('Points')
  })

  it('en español traduce', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(traductor('es')('Game over!')).toBe('¡Partida terminada!')
  })

  it('traduce todas las etiquetas de los mapas de configuración', () => {
    // Si un modo o una dificultad gana una entrada y no se traduce, esto cae
    // antes de que nadie vea el juego a medias en español.
    const etiquetas = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
    ]
    const sinTraducir = etiquetas.filter((e) => texto('es', e) === e)
    expect(sinTraducir).toEqual([])
  })
})

/** Dónde vive el código del juego, para leerlo entero. */
const SRC = join(import.meta.dirname, '..')

/** Todo el código del juego en un solo texto, menos el propio diccionario y los tests. */
function codigo(carpeta = ''): string {
  return readdirSync(join(SRC, carpeta), { withFileTypes: true })
    .map((entrada) => {
      const ruta = join(carpeta, entrada.name)
      if (entrada.isDirectory()) return codigo(ruta)
      if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return ''
      if (entrada.name === 'textos.ts') return ''
      return readFileSync(join(SRC, ruta), 'utf8')
    })
    .join('\n')
}

describe('el diccionario no acumula', () => {
  it('ni le falta ninguna de las que se dicen', () => {
    // El reverso del otro, y el que faltaba: aquel caza una clave declarada que ya no usa
    // nadie —molesta pero inofensiva—, y este una que **se usa y no está declarada**, que es
    // la que se ve. En bateo, `t('Fastest')` devolvía `undefined` y el marcador del reto
    // pintaba una fila con su cifra y sin nombre, solo en español.
    const fuente = codigo()
    const usadas = [...fuente.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    const faltan = [...new Set(usadas)].filter(
      (clave) => !(TEXT_KEYS as readonly string[]).includes(clave),
    )

    expect(faltan).toEqual([])
  })

  it('no guarda frases que ya no dice nadie', () => {
    // Una frase cambia en el componente y la vieja se queda aquí traducida para siempre:
    // no rompe nada, y por eso nadie la quita nunca. Los otros doce ya lo vigilan; este no.
    const fuente = codigo()
    const huerfanas = TEXT_KEYS.filter((clave) => !fuente.includes(clave))

    expect(huerfanas).toEqual([])
  })
})
